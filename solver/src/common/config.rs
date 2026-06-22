use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointCharge {
    /// Grid x coordinate
    pub x: usize,
    /// Grid y coordinate
    pub y: usize,
    /// Charge magnitude (positive or negative)
    pub q: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BoundaryCondition {
    /// All edges fixed at given voltage
    DirichletZero,
    /// Per-edge fixed voltage: [top, right, bottom, left]
    DirichletFixed { voltages: [f64; 4] },
    /// Zero normal derivative at all edges
    Neumann,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FieldEngine {
    Jacobi,
    GaussSeidel,
    SOR { omega: Option<f64> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldConfig {
    pub width: usize,
    pub height: usize,
    pub charges: Vec<PointCharge>,
    pub boundary: BoundaryCondition,
    pub engine: FieldEngine,
    pub max_iterations: usize,
    pub tolerance: f64,
}

impl Default for FieldConfig {
    fn default() -> Self {
        Self {
            width: 128,
            height: 128,
            charges: vec![],
            boundary: BoundaryCondition::DirichletZero,
            engine: FieldEngine::GaussSeidel,
            max_iterations: 10000,
            tolerance: 1e-6,
        }
    }
}
