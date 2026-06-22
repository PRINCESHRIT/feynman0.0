import init, { add } from './wasm-pkg/feynman_solver';

let initialized = false;

export async function initSolver(): Promise<void> {
  if (initialized) return;
  await init();
  initialized = true;
}

export function wasmAdd(a: number, b: number): number {
  return add(a, b);
}
