use crate::common::grid::Grid;

/// Result of a solver step.
#[derive(Debug, Clone)]
pub struct StepResult {
    /// Maximum absolute change in potential this step.
    pub residual: f64,
    /// Whether the solver has converged (residual < tolerance).
    pub converged: bool,
}

/// Trait for iterative field solvers.
pub trait FieldSolver: Send {
    /// Perform `n` iterations. Returns the result of the last iteration.
    fn step(&mut self, n: usize) -> StepResult;

    /// Get a reference to the current potential grid.
    fn potential(&self) -> &Grid;

    /// Total number of iterations performed so far.
    fn iterations(&self) -> usize;
}
