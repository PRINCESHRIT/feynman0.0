use crate::common::config::{BoundaryCondition, FieldConfig, FieldEngine};
use crate::common::grid::Grid;
use super::engine::{FieldSolver, StepResult};

pub struct SORSolver {
    potential: Grid,
    rhs: Grid,
    config: FieldConfig,
    omega: f64,
    total_iterations: usize,
}

impl SORSolver {
    pub fn new(config: &FieldConfig) -> Self {
        let w = config.width;
        let h = config.height;
        let mut potential = Grid::new(w, h);
        let mut rhs = Grid::new(w, h);

        for charge in &config.charges {
            if charge.x < w && charge.y < h {
                rhs.set(charge.x, charge.y, -charge.q);
            }
        }

        apply_boundary(&mut potential, &config.boundary, w, h);

        // Compute optimal omega if not provided
        let omega = match &config.engine {
            FieldEngine::SOR { omega: Some(w) } => *w,
            _ => {
                let n = w.max(h) as f64;
                2.0 / (1.0 + (std::f64::consts::PI / n).sin())
            }
        };

        Self {
            potential,
            rhs,
            config: config.clone(),
            omega,
            total_iterations: 0,
        }
    }
}

impl FieldSolver for SORSolver {
    fn step(&mut self, n: usize) -> StepResult {
        let w = self.config.width;
        let h = self.config.height;
        let omega = self.omega;
        let mut residual = 0.0;

        for _ in 0..n {
            residual = 0.0;

            // Red-black ordering for better convergence
            for color in 0..2 {
                for y in 1..h - 1 {
                    for x in 1..w - 1 {
                        if (x + y) % 2 != color {
                            continue;
                        }
                        let old = self.potential.get(x, y);
                        let gs_val = 0.25 * (
                            self.potential.get(x + 1, y)
                            + self.potential.get(x - 1, y)
                            + self.potential.get(x, y + 1)
                            + self.potential.get(x, y - 1)
                            - self.rhs.get(x, y)
                        );
                        let new_val = old + omega * (gs_val - old);
                        let diff = (new_val - old).abs();
                        if diff > residual {
                            residual = diff;
                        }
                        self.potential.set(x, y, new_val);
                    }
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
