use crate::common::config::{BoundaryCondition, FieldConfig};
use crate::common::grid::Grid;
use super::engine::{FieldSolver, StepResult};

pub struct JacobiSolver {
    potential: Grid,
    scratch: Grid,
    rhs: Grid,
    config: FieldConfig,
    total_iterations: usize,
}

impl JacobiSolver {
    pub fn new(config: &FieldConfig) -> Self {
        let w = config.width;
        let h = config.height;
        let mut potential = Grid::new(w, h);
        let scratch = Grid::new(w, h);
        let mut rhs = Grid::new(w, h);

        // Set charge density on RHS: ∇²V = -ρ/ε₀
        // Using normalized units where ε₀ = 1, grid spacing h = 1
        for charge in &config.charges {
            if charge.x < w && charge.y < h {
                rhs.set(charge.x, charge.y, -charge.q);
            }
        }

        apply_boundary(&mut potential, &config.boundary, w, h);

        Self {
            potential,
            scratch,
            rhs,
            config: config.clone(),
            total_iterations: 0,
        }
    }
}

impl FieldSolver for JacobiSolver {
    fn step(&mut self, n: usize) -> StepResult {
        let w = self.config.width;
        let h = self.config.height;
        let mut residual = 0.0;

        for _ in 0..n {
            residual = 0.0;

            // Copy current to scratch
            self.scratch.data.copy_from_slice(&self.potential.data);

            for y in 1..h - 1 {
                for x in 1..w - 1 {
                    let avg = 0.25 * (
                        self.scratch.get(x + 1, y)
                        + self.scratch.get(x - 1, y)
                        + self.scratch.get(x, y + 1)
                        + self.scratch.get(x, y - 1)
                        - self.rhs.get(x, y)
                    );
                    let diff = (avg - self.potential.get(x, y)).abs();
                    if diff > residual {
                        residual = diff;
                    }
                    self.potential.set(x, y, avg);
                }
            }

            apply_boundary(&mut self.potential, &self.config.boundary, w, h);
            self.total_iterations += 1;
        }

        StepResult {
            residual,
            converged: residual < self.config.tolerance,
        }
    }

    fn potential(&self) -> &Grid {
        &self.potential
    }

    fn iterations(&self) -> usize {
        self.total_iterations
    }
}

fn apply_boundary(grid: &mut Grid, bc: &BoundaryCondition, w: usize, h: usize) {
    match bc {
        BoundaryCondition::DirichletZero => {
            for x in 0..w {
                grid.set(x, 0, 0.0);
                grid.set(x, h - 1, 0.0);
            }
            for y in 0..h {
                grid.set(0, y, 0.0);
                grid.set(w - 1, y, 0.0);
            }
        }
        BoundaryCondition::DirichletFixed { voltages } => {
            let [top, right, bottom, left] = *voltages;
            for x in 0..w {
                grid.set(x, 0, top);
                grid.set(x, h - 1, bottom);
            }
            for y in 0..h {
                grid.set(0, y, left);
                grid.set(w - 1, y, right);
            }
        }
        BoundaryCondition::Neumann => {
            // Zero normal derivative: copy interior neighbor to boundary
            for x in 1..w - 1 {
                let v = grid.get(x, 1);
                grid.set(x, 0, v);
                let v = grid.get(x, h - 2);
                grid.set(x, h - 1, v);
            }
            for y in 1..h - 1 {
                let v = grid.get(1, y);
                grid.set(0, y, v);
                let v = grid.get(w - 2, y);
                grid.set(w - 1, y, v);
            }
        }
    }
}
