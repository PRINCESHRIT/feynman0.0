import type { FieldConfig, SolveResult, SolverProgress } from '../types/simulation';
import type { WorkerMessage, WorkerResponse } from './solver.worker';

export interface SolveOptions {
  mode: 'preview' | 'commit';
  chunkSize?: number;
  onProgress?: (progress: SolverProgress) => void;
}

export class WorkerManager {
  private worker: Worker | null = null;
  private resolvePromise: ((result: SolveResult | null) => void) | null = null;
  private startTime = 0;

  private createWorker(): Worker {
    const worker = new Worker(
      new URL('./solver.worker.ts', import.meta.url),
      { type: 'module' },
    );
    return worker;
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = this.createWorker();
    }
    return this.worker;
  }

  async solve(config: FieldConfig, options: SolveOptions): Promise<SolveResult | null> {
    const worker = this.ensureWorker();
    const chunkSize = options.chunkSize ?? (options.mode === 'preview' ? 50 : 500);

    // Build WASM config JSON
    const wasmConfig = {
      width: config.grid.width,
      height: config.grid.height,
      charges: config.charges.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), q: c.q })),
      boundary: config.boundary.type === 'dirichlet_zero' ? 'zero'
        : config.boundary.type === 'dirichlet_fixed' ? 'fixed'
        : 'neumann',
      boundary_voltages: config.boundary.type === 'dirichlet_fixed'
        ? config.boundary.voltages : undefined,
      engine: config.engine,
      omega: null,
      max_iterations: config.maxIterations,
      tolerance: config.tolerance,
    };

    return new Promise<SolveResult | null>((resolve) => {
      this.resolvePromise = resolve;
      this.startTime = performance.now();

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        switch (msg.type) {
          case 'ready':
            // Solver initialized, now solve
            worker.postMessage({
              type: 'solve',
              chunkSize,
              maxIterations: config.maxIterations,
              tolerance: config.tolerance,
            } satisfies WorkerMessage);
            break;

          case 'progress':
            options.onProgress?.({ iterations: msg.iterations, residual: msg.residual });
            break;

          case 'done':
            resolve({
              potential: msg.potential,
              width: msg.width,
              height: msg.height,
              iterations: msg.iterations,
              residual: msg.residual,
              converged: msg.converged,
              timeMs: performance.now() - this.startTime,
            });
            break;

          case 'cancelled':
            resolve(null);
            break;

          case 'error':
            console.error('Solver worker error:', msg.message);
            resolve(null);
            break;
        }
      };

      // Initialize solver
      worker.postMessage({
        type: 'init',
        config: JSON.stringify(wasmConfig),
      } satisfies WorkerMessage);
    });
  }

  cancel(): void {
    if (this.worker) {
      // For preview: terminate and respawn (fast, aggressive)
      this.worker.terminate();
      this.worker = null;
      this.resolvePromise?.(null);
      this.resolvePromise = null;
    }
  }

  cancelGraceful(): void {
    // For high-res: send cancel message, let chunked loop handle it
    this.worker?.postMessage({ type: 'cancel' } satisfies WorkerMessage);
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
