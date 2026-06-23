/**
 * SolveController — The latency spine (Phase 0).
 *
 * Owns the worker lifecycle, job superseding, warm-start, and zero-copy
 * result transfer. The main thread never blocks on a solve.
 *
 * Three rules:
 *   1. Render loop ≠ solve loop (decoupled via latestResult)
 *   2. Interactive solve is preview-only (128², warm-started)
 *   3. Latest input wins (monotonic job IDs, supersede in-flight)
 */

import type { FieldConfig, SolveResult, SolverProgress } from '../types/simulation';
import { solveGaussSeidel } from './gaussSeidel';

// ── Result buffer shared between solve and render ──

export interface VersionedResult {
  version: number;
  result: SolveResult;
}

/** The latest result. Render reads this; solve writes it. */
let latestResult: VersionedResult | null = null;
let resultVersion = 0;

export function getLatestResult(): VersionedResult | null {
  return latestResult;
}

// ── Job tracking ──

let nextJobId = 1;
let activeJobId = 0;

// ── Worker state ──

let worker: Worker | null = null;
let workerReady = false;
let inlineMode = false;
let resolveActive: ((r: SolveResult | null) => void) | null = null;
let activeStartTime = 0;

// ── Warm-start buffer ──

let warmStartBuffer: Float32Array | null = null;

// ── Callbacks ──

type StatusCb = (status: 'idle' | 'solving' | 'converged' | 'failed' | 'cancelled' | 'inline_fallback') => void;
type ProgressCb = (p: SolverProgress | null) => void;
type ResultCb = (r: SolveResult) => void;

let onStatusChange: StatusCb = () => {};
let onProgressChange: ProgressCb = () => {};
let onResultLanded: ResultCb = () => {};

export function setSolveCallbacks(cbs: {
  onStatus?: StatusCb;
  onProgress?: ProgressCb;
  onResult?: ResultCb;
}) {
  if (cbs.onStatus) onStatusChange = cbs.onStatus;
  if (cbs.onProgress) onProgressChange = cbs.onProgress;
  if (cbs.onResult) onResultLanded = cbs.onResult;
}

// ── F0.1: Worker bootstrap ──

function createWorker(): Worker {
  return new Worker(
    new URL('./solver.worker.ts', import.meta.url),
    { type: 'module' },
  );
}

function spawnWorker(): boolean {
  try {
    worker = createWorker();
    worker.onerror = (e) => {
      console.error('[SolveController] Worker error:', e);
      handleWorkerDeath();
    };
    setupWorkerListener();
    workerReady = true;
    return true;
  } catch {
    return false;
  }
}

function handleWorkerDeath() {
  worker = null;
  workerReady = false;
  // Resolve any pending promise
  if (resolveActive) {
    resolveActive(null);
    resolveActive = null;
  }
  // Retry once
  if (!spawnWorker()) {
    // Fall back to inline mode
    inlineMode = true;
    onStatusChange('inline_fallback');
    console.warn('[SolveController] Workers unavailable — inline fallback mode');
  }
}

/** Boot the worker at app load. Call this once from app init. */
export function bootWorker() {
  if (worker || inlineMode) return;
  if (!spawnWorker()) {
    // Retry once
    if (!spawnWorker()) {
      inlineMode = true;
      onStatusChange('inline_fallback');
    }
  }
}

// ── F0.2 + F0.4: Worker message handling with zero-copy + job IDs ──

function setupWorkerListener() {
  if (!worker) return;

  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data;
    const jobId = msg.jobId as number | undefined;

    // F0.4: Discard superseded job responses
    if (jobId !== undefined && jobId !== activeJobId) {
      return;
    }

    switch (msg.type) {
      case 'ready':
        // Solver initialized in worker, send solve command
        if (worker && msg.jobId === activeJobId) {
          worker.postMessage({
            type: 'solve',
            jobId: activeJobId,
          });
        }
        break;

      case 'progress':
        onProgressChange({
          iterations: msg.iterations,
          residual: msg.residual,
        });
        break;

      case 'result': {
        // F0.2: Result arrives as transferable Float32Array
        const potential = msg.potential as Float32Array;
        const result: SolveResult = {
          potential,
          width: msg.width,
          height: msg.height,
          iterations: msg.iterations,
          residual: msg.residual,
          converged: msg.converged,
          timeMs: performance.now() - activeStartTime,
        };

        // Update warm-start buffer
        warmStartBuffer = potential;

        // Publish to the versioned latest-result handle (F0.3)
        resultVersion++;
        latestResult = { version: resultVersion, result };

        onStatusChange(result.converged ? 'converged' : 'failed');
        onProgressChange(null);
        onResultLanded(result);

        if (resolveActive) {
          resolveActive(result);
          resolveActive = null;
        }
        break;
      }

      case 'cancelled':
        onStatusChange('cancelled');
        if (resolveActive) {
          resolveActive(null);
          resolveActive = null;
        }
        break;

      case 'error':
        console.error('[SolveController] Worker solve error:', msg.message);
        // Fall back to inline TS solver
        if (resolveActive) {
          resolveActive(null);
          resolveActive = null;
        }
        break;
    }
  };
}

// ── F0.4: Build WASM config JSON ──

function buildWasmConfig(config: FieldConfig, mode: 'preview' | 'commit') {
  const res = mode === 'preview' ? 128 : config.grid.width;
  const scaleX = res / config.grid.width;
  const scaleY = res / config.grid.height;

  return {
    width: res,
    height: mode === 'preview' ? 128 : config.grid.height,
    charges: config.charges.map((c) => ({
      x: Math.round(c.x * scaleX),
      y: Math.round(c.y * scaleY),
      q: c.q,
    })),
    boundary: config.boundary.type === 'dirichlet_zero' ? 'zero'
      : config.boundary.type === 'dirichlet_fixed' ? 'fixed'
      : 'neumann',
    boundary_voltages: config.boundary.type === 'dirichlet_fixed'
      ? config.boundary.voltages : undefined,
    engine: config.engine,
    omega: null,
    max_iterations: mode === 'preview' ? 2000 : config.maxIterations,
    tolerance: config.tolerance,
    chunk_size: mode === 'preview' ? 50 : 500,
  };
}

// ── Public API ──

/**
 * Request a solve. Supersedes any in-flight solve.
 * Returns a promise that resolves when THIS job finishes
 * (or null if superseded/cancelled).
 */
export function requestSolve(
  config: FieldConfig,
  mode: 'preview' | 'commit' = 'preview',
): Promise<SolveResult | null> {
  // F0.4: Supersede any in-flight job
  const jobId = nextJobId++;
  activeJobId = jobId;
  activeStartTime = performance.now();

  onStatusChange('solving');
  onProgressChange(null);

  // If worker unavailable, use inline fallback
  if (inlineMode || !worker) {
    return solveInline(config, mode);
  }

  return new Promise<SolveResult | null>((resolve) => {
    // If there was a pending resolve, null it out (superseded)
    if (resolveActive) {
      resolveActive(null);
    }
    resolveActive = resolve;

    const wasmConfig = buildWasmConfig(config, mode);

    // F0.4: Send warm-start buffer if available
    const initMsg: any = {
      type: 'init',
      jobId,
      config: JSON.stringify(wasmConfig),
    };

    // For preview: send warm-start data as transferable
    if (mode === 'preview' && warmStartBuffer && warmStartBuffer.length === wasmConfig.width * wasmConfig.height) {
      const copy = new Float32Array(warmStartBuffer);
      initMsg.warmStart = copy.buffer;
      worker!.postMessage(initMsg, [copy.buffer]);
    } else {
      worker!.postMessage(initMsg);
    }
  });
}

/** Cancel in-flight solve. */
export function cancelSolve() {
  activeJobId = nextJobId++; // Supersede by incrementing
  if (worker) {
    worker.postMessage({ type: 'cancel' });
  }
  if (resolveActive) {
    resolveActive(null);
    resolveActive = null;
  }
  onStatusChange('cancelled');
}

/** Terminate-and-respawn for aggressive cancel (preview). */
export function cancelHard() {
  activeJobId = nextJobId++;
  if (worker) {
    worker.terminate();
    worker = null;
    workerReady = false;
  }
  if (resolveActive) {
    resolveActive(null);
    resolveActive = null;
  }
  onStatusChange('idle');
  // Respawn
  spawnWorker();
}

/** Get whether we're in inline fallback mode. */
export function isInlineMode(): boolean {
  return inlineMode;
}

/** Clear warm-start buffer (e.g. on config topology change). */
export function clearWarmStart() {
  warmStartBuffer = null;
}

/** Dispose everything. */
export function dispose() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  warmStartBuffer = null;
  latestResult = null;
}

// ── Inline fallback (F0.1 fallback path) ──

function solveInline(config: FieldConfig, mode: 'preview' | 'commit'): Promise<SolveResult | null> {
  return new Promise((resolve) => {
    // Run in next microtask to avoid blocking
    setTimeout(() => {
      try {
        const inlineConfig = mode === 'preview'
          ? { ...config, grid: { width: 128, height: 128 }, maxIterations: 2000 }
          : config;

        const result = solveGaussSeidel(inlineConfig);

        // Check job ID — may have been superseded during inline solve
        if (activeJobId !== nextJobId - 1) {
          resolve(null);
          return;
        }

        warmStartBuffer = result.potential;
        resultVersion++;
        latestResult = { version: resultVersion, result };

        onStatusChange(result.converged ? 'converged' : 'failed');
        onResultLanded(result);
        resolve(result);
      } catch (err) {
        console.error('[SolveController] Inline solve error:', err);
        onStatusChange('failed');
        resolve(null);
      }
    }, 0);
  });
}
