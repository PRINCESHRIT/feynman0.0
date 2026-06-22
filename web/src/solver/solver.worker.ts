/// Web Worker for running WASM field solvers off the main thread.

import init, {
  init_field_solver,
  step_field_solver,
  extract_potential,
  get_grid_size,
  free_field_solver,
} from './wasm-pkg/feynman_solver';

let wasmReady = false;
let currentHandle: number | null = null;
let cancelled = false;

async function ensureWasm() {
  if (!wasmReady) {
    await init();
    wasmReady = true;
  }
}

export type WorkerMessage =
  | { type: 'init'; config: string }
  | { type: 'solve'; chunkSize: number; maxIterations: number; tolerance: number }
  | { type: 'cancel' };

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'progress'; iterations: number; residual: number }
  | { type: 'done'; potential: Float32Array; width: number; height: number; iterations: number; residual: number; converged: boolean }
  | { type: 'error'; message: string }
  | { type: 'cancelled' };

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  try {
    await ensureWasm();

    switch (msg.type) {
      case 'init': {
        // Free previous solver if any
        if (currentHandle !== null) {
          free_field_solver(currentHandle);
        }
        currentHandle = init_field_solver(msg.config);
        cancelled = false;
        self.postMessage({ type: 'ready' } satisfies WorkerResponse);
        break;
      }

      case 'solve': {
        if (currentHandle === null) {
          self.postMessage({ type: 'error', message: 'No solver initialized' } satisfies WorkerResponse);
          return;
        }

        cancelled = false;
        let totalIterations = 0;

        while (totalIterations < msg.maxIterations && !cancelled) {
          const n = Math.min(msg.chunkSize, msg.maxIterations - totalIterations);
          const resultJson = step_field_solver(currentHandle, n);
          const result = JSON.parse(resultJson);
          totalIterations = result.iterations;

          // Post progress
          self.postMessage({
            type: 'progress',
            iterations: result.iterations,
            residual: result.residual,
          } satisfies WorkerResponse);

          if (result.converged) {
            break;
          }

          // Yield to allow cancel messages to be processed
          await new Promise((r) => setTimeout(r, 0));
        }

        if (cancelled) {
          self.postMessage({ type: 'cancelled' } satisfies WorkerResponse);
          return;
        }

        // Extract result
        const potential = new Float32Array(extract_potential(currentHandle));
        const size = get_grid_size(currentHandle);
        const lastJson = step_field_solver(currentHandle, 0);
        const last = JSON.parse(lastJson);

        self.postMessage({
          type: 'done',
          potential,
          width: size[0],
          height: size[1],
          iterations: last.iterations,
          residual: last.residual,
          converged: last.residual < msg.tolerance,
        } satisfies WorkerResponse);
        break;
      }

      case 'cancel': {
        cancelled = true;
        break;
      }
    }
  } catch (err: any) {
    self.postMessage({ type: 'error', message: err.message || String(err) } satisfies WorkerResponse);
  }
};
