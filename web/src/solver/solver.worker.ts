/**
 * Solver Web Worker — Phase 0 latency spine.
 *
 * Supports:
 *   - Monotonic job IDs (F0.4: supersede stale jobs)
 *   - Zero-copy transferable result buffers (F0.2)
 *   - Warm-start from previous result (F0.4)
 *   - Chunked iteration with cancel check between chunks
 */

let wasmReady = false;
let wasmInit: any = null;
let wasmInitFieldSolver: any = null;
let wasmStepFieldSolver: any = null;
let wasmExtractPotential: any = null;
let wasmGetGridSize: any = null;
let wasmFreeFieldSolver: any = null;

let currentHandle: number | null = null;
let activeJobId = 0;
let cancelled = false;

async function ensureWasm() {
  if (wasmReady) return;
  try {
    const wasm = await import('./wasm-pkg/feynman_solver');
    wasmInit = wasm.default;
    wasmInitFieldSolver = wasm.init_field_solver;
    wasmStepFieldSolver = wasm.step_field_solver;
    wasmExtractPotential = wasm.extract_potential;
    wasmGetGridSize = wasm.get_grid_size;
    wasmFreeFieldSolver = wasm.free_field_solver;
    await wasmInit();
    wasmReady = true;
  } catch (err) {
    // WASM unavailable — worker will report error
    throw new Error('WASM init failed: ' + (err instanceof Error ? err.message : String(err)));
  }
}

// Solve parameters cached from init
let solveConfig: {
  chunkSize: number;
  maxIterations: number;
  tolerance: number;
} | null = null;

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  try {
    await ensureWasm();

    switch (msg.type) {
      case 'init': {
        const jobId = msg.jobId as number;
        activeJobId = jobId;
        cancelled = false;

        // Free previous solver
        if (currentHandle !== null) {
          wasmFreeFieldSolver(currentHandle);
          currentHandle = null;
        }

        // Parse config for chunk/iteration params
        const cfg = JSON.parse(msg.config);
        solveConfig = {
          chunkSize: cfg.chunk_size ?? 500,
          maxIterations: cfg.max_iterations ?? 10000,
          tolerance: cfg.tolerance ?? 1e-6,
        };

        currentHandle = wasmInitFieldSolver(msg.config);

        self.postMessage({ type: 'ready', jobId });
        break;
      }

      case 'solve': {
        const jobId = msg.jobId as number;
        if (currentHandle === null || !solveConfig) {
          self.postMessage({ type: 'error', jobId, message: 'No solver initialized' });
          return;
        }

        // Check if this job is still active
        if (jobId !== activeJobId) return;

        cancelled = false;
        let totalIterations = 0;
        const { chunkSize, maxIterations, tolerance } = solveConfig;

        while (totalIterations < maxIterations && !cancelled && jobId === activeJobId) {
          const n = Math.min(chunkSize, maxIterations - totalIterations);
          const resultJson = wasmStepFieldSolver(currentHandle, n);
          const result = JSON.parse(resultJson);
          totalIterations = result.iterations;

          // Post progress (check job ID)
          if (jobId !== activeJobId) return;
          self.postMessage({
            type: 'progress',
            jobId,
            iterations: result.iterations,
            residual: result.residual,
          });

          if (result.converged) break;

          // Yield to allow cancel/supersede messages
          await new Promise((r) => setTimeout(r, 0));
        }

        // Final check — may have been superseded during yield
        if (cancelled || jobId !== activeJobId) {
          self.postMessage({ type: 'cancelled', jobId });
          return;
        }

        // Extract result
        const rawPotential = wasmExtractPotential(currentHandle);
        const size = wasmGetGridSize(currentHandle);
        const lastJson = wasmStepFieldSolver(currentHandle, 0);
        const last = JSON.parse(lastJson);

        // F0.2: Create a transferable Float32Array
        const potential = new Float32Array(rawPotential);
        const buffer = potential.buffer;

        self.postMessage({
          type: 'result',
          jobId,
          potential,
          width: size[0],
          height: size[1],
          iterations: last.iterations,
          residual: last.residual,
          converged: last.residual < tolerance,
        }, { transfer: [buffer] }); // Zero-copy transfer (F0.2)

        break;
      }

      case 'cancel': {
        cancelled = true;
        break;
      }
    }
  } catch (err: any) {
    self.postMessage({
      type: 'error',
      jobId: msg.jobId,
      message: err.message || String(err),
    });
  }
};
