pub mod common;
pub mod field;
pub mod circuit;

use wasm_bindgen::prelude::*;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::LazyLock;

use common::config::{FieldConfig, FieldEngine, BoundaryCondition, PointCharge};
use field::engine::FieldSolver;
use field::jacobi::JacobiSolver;
use field::gauss_seidel::GaussSeidelSolver;
use field::sor::SORSolver;

// ── Handle-based solver storage ──

static SOLVERS: LazyLock<Mutex<HashMap<u32, Box<dyn FieldSolver>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static NEXT_HANDLE: LazyLock<Mutex<u32>> = LazyLock::new(|| Mutex::new(1));

fn alloc_handle() -> u32 {
    let mut h = NEXT_HANDLE.lock().unwrap();
    let id = *h;
    *h += 1;
    id
}

// ── JSON config for WASM boundary ──

#[derive(Deserialize)]
struct WasmFieldConfig {
    width: usize,
    height: usize,
    charges: Vec<WasmCharge>,
    boundary: String,        // "zero" | "fixed"
    boundary_voltages: Option<[f64; 4]>,
    engine: String,          // "jacobi" | "gauss_seidel" | "sor"
    omega: Option<f64>,
    max_iterations: usize,
    tolerance: f64,
}

#[derive(Deserialize)]
struct WasmCharge {
    x: usize,
    y: usize,
    q: f64,
}

impl From<WasmFieldConfig> for FieldConfig {
    fn from(w: WasmFieldConfig) -> Self {
        let boundary = match w.boundary.as_str() {
            "fixed" => BoundaryCondition::DirichletFixed {
                voltages: w.boundary_voltages.unwrap_or([0.0; 4]),
            },
            "neumann" => BoundaryCondition::Neumann,
            _ => BoundaryCondition::DirichletZero,
        };
        let engine = match w.engine.as_str() {
            "jacobi" => FieldEngine::Jacobi,
            "sor" => FieldEngine::SOR { omega: w.omega },
            _ => FieldEngine::GaussSeidel,
        };
        FieldConfig {
            width: w.width,
            height: w.height,
            charges: w.charges.into_iter().map(|c| PointCharge { x: c.x, y: c.y, q: c.q }).collect(),
            boundary,
            engine,
            max_iterations: w.max_iterations,
            tolerance: w.tolerance,
        }
    }
}

// ── WASM Entry Points ──

/// Trivial function to verify WASM pipeline works end-to-end.
#[wasm_bindgen]
pub fn add(a: f64, b: f64) -> f64 {
    a + b
}

/// Create a new field solver from JSON config. Returns a handle.
#[wasm_bindgen]
pub fn init_field_solver(config_json: &str) -> Result<u32, JsValue> {
    let wasm_config: WasmFieldConfig = serde_json::from_str(config_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid config: {e}")))?;
    let config: FieldConfig = wasm_config.into();

    let solver: Box<dyn FieldSolver> = match &config.engine {
        FieldEngine::Jacobi => Box::new(JacobiSolver::new(&config)),
        FieldEngine::GaussSeidel => Box::new(GaussSeidelSolver::new(&config)),
        FieldEngine::SOR { .. } => Box::new(SORSolver::new(&config)),
    };

    let handle = alloc_handle();
    SOLVERS.lock().unwrap().insert(handle, solver);
    Ok(handle)
}

/// Step the solver N iterations. Returns JSON: { residual, converged, iterations }
#[wasm_bindgen]
pub fn step_field_solver(handle: u32, n: usize) -> Result<String, JsValue> {
    let mut solvers = SOLVERS.lock().unwrap();
    let solver = solvers.get_mut(&handle)
        .ok_or_else(|| JsValue::from_str("Invalid solver handle"))?;

    let result = solver.step(n);
    let json = format!(
        r#"{{"residual":{},"converged":{},"iterations":{}}}"#,
        result.residual,
        result.converged,
        solver.iterations(),
    );
    Ok(json)
}

/// Extract the potential grid as a Float32Array (zero-copy via shared WASM memory).
#[wasm_bindgen]
pub fn extract_potential(handle: u32) -> Result<Vec<f32>, JsValue> {
    let solvers = SOLVERS.lock().unwrap();
    let solver = solvers.get(&handle)
        .ok_or_else(|| JsValue::from_str("Invalid solver handle"))?;

    Ok(solver.potential().as_f32_vec())
}

/// Get grid dimensions as [width, height].
#[wasm_bindgen]
pub fn get_grid_size(handle: u32) -> Result<Vec<usize>, JsValue> {
    let solvers = SOLVERS.lock().unwrap();
    let solver = solvers.get(&handle)
        .ok_or_else(|| JsValue::from_str("Invalid solver handle"))?;

    let grid = solver.potential();
    Ok(vec![grid.width, grid.height])
}

/// Free a solver instance.
#[wasm_bindgen]
pub fn free_field_solver(handle: u32) {
    SOLVERS.lock().unwrap().remove(&handle);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add() {
        assert_eq!(add(2.0, 3.0), 5.0);
        assert_eq!(add(-1.0, 1.0), 0.0);
    }
}
