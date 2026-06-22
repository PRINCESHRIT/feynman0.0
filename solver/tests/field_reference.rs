use feynman_solver::common::config::*;
use feynman_solver::field::engine::FieldSolver;
use feynman_solver::field::jacobi::JacobiSolver;
use feynman_solver::field::gauss_seidel::GaussSeidelSolver;
use feynman_solver::field::sor::SORSolver;

// Use 33x33 so center (16,16) has equal distance to all boundaries
const N: usize = 33;
const CENTER: usize = 16;

fn make_point_charge_config(engine: FieldEngine) -> FieldConfig {
    FieldConfig {
        width: N,
        height: N,
        charges: vec![PointCharge { x: CENTER, y: CENTER, q: 1.0 }],
        boundary: BoundaryCondition::DirichletZero,
        engine,
        max_iterations: 50000,
        tolerance: 1e-8,
    }
}

fn make_dipole_config(engine: FieldEngine) -> FieldConfig {
    FieldConfig {
        width: N,
        height: N,
        charges: vec![
            PointCharge { x: CENTER - 4, y: CENTER, q: 1.0 },
            PointCharge { x: CENTER + 4, y: CENTER, q: -1.0 },
        ],
        boundary: BoundaryCondition::DirichletZero,
        engine,
        max_iterations: 50000,
        tolerance: 1e-8,
    }
}

fn make_uniform_dirichlet_config(engine: FieldEngine) -> FieldConfig {
    FieldConfig {
        width: N,
        height: N,
        charges: vec![],
        boundary: BoundaryCondition::DirichletFixed { voltages: [1.0, 1.0, 1.0, 1.0] },
        engine,
        max_iterations: 50000,
        tolerance: 1e-8,
    }
}

fn solve_to_convergence(solver: &mut dyn FieldSolver) -> usize {
    let mut total = 0;
    loop {
        let result = solver.step(100);
        total += 100;
        if result.converged || total > 100000 {
            return total;
        }
    }
}

// ── Point charge symmetry (Jacobi — should be perfectly symmetric) ──

#[test]
fn test_point_charge_symmetry_jacobi() {
    let config = make_point_charge_config(FieldEngine::Jacobi);
    let mut solver = JacobiSolver::new(&config);
    solve_to_convergence(&mut solver);
    let grid = solver.potential();

    for d in 1..10 {
        let right = grid.get(CENTER + d, CENTER);
        let left = grid.get(CENTER - d, CENTER);
        let up = grid.get(CENTER, CENTER + d);
        let down = grid.get(CENTER, CENTER - d);

        assert!((right - left).abs() < 1e-10, "Jacobi LR symmetry broken at d={d}: {left} vs {right}");
        assert!((up - down).abs() < 1e-10, "Jacobi UD symmetry broken at d={d}");
        assert!((right - up).abs() < 1e-10, "Jacobi diagonal symmetry broken at d={d}");
    }

    assert!(grid.get(CENTER, CENTER) > 0.0, "Center should be positive");
}

// GS and SOR have directional bias — use relaxed tolerance
#[test]
fn test_point_charge_symmetry_gs() {
    let config = make_point_charge_config(FieldEngine::GaussSeidel);
    let mut solver = GaussSeidelSolver::new(&config);
    solve_to_convergence(&mut solver);
    let grid = solver.potential();

    for d in 1..10 {
        let right = grid.get(CENTER + d, CENTER);
        let left = grid.get(CENTER - d, CENTER);
        // GS has sweep-direction bias, so symmetry is approximate
        assert!((right - left).abs() < 1e-4, "GS LR symmetry broken at d={d}: {left} vs {right}");
    }
    assert!(grid.get(CENTER, CENTER) > 0.0);
}

#[test]
fn test_point_charge_symmetry_sor() {
    let config = make_point_charge_config(FieldEngine::SOR { omega: None });
    let mut solver = SORSolver::new(&config);
    solve_to_convergence(&mut solver);
    let grid = solver.potential();

    for d in 1..10 {
        let right = grid.get(CENTER + d, CENTER);
        let left = grid.get(CENTER - d, CENTER);
        // SOR red-black ordering preserves symmetry better than GS
        assert!((right - left).abs() < 1e-4, "SOR LR symmetry broken at d={d}: {left} vs {right}");
    }
    assert!(grid.get(CENTER, CENTER) > 0.0);
}

// ── Dipole antisymmetry ──

#[test]
fn test_dipole_antisymmetry_gs() {
    let config = make_dipole_config(FieldEngine::GaussSeidel);
    let mut solver = GaussSeidelSolver::new(&config);
    solve_to_convergence(&mut solver);
    let grid = solver.potential();

    // Midpoint should be ~0 (GS sweep bias means approximate)
    assert!(grid.get(CENTER, CENTER).abs() < 1e-4,
        "Midpoint should be ~0, got {}", grid.get(CENTER, CENTER));

    for d in 1..8 {
        let right = grid.get(CENTER + d, CENTER);
        let left = grid.get(CENTER - d, CENTER);
        assert!((right + left).abs() < 1e-4,
            "Antisymmetry broken at d={d}: {right} vs {left}");
    }
}

// ── Uniform Dirichlet: V=1 everywhere ──

#[test]
fn test_uniform_dirichlet_gs() {
    let config = make_uniform_dirichlet_config(FieldEngine::GaussSeidel);
    let mut solver = GaussSeidelSolver::new(&config);
    solve_to_convergence(&mut solver);
    let grid = solver.potential();

    for y in 1..N - 1 {
        for x in 1..N - 1 {
            let v = grid.get(x, y);
            assert!((v - 1.0).abs() < 1e-4,
                "Interior ({x},{y}) = {v}, expected 1.0");
        }
    }
}

// ── Convergence ordering: SOR < GS < Jacobi ──

#[test]
fn test_convergence_ordering() {
    let config_j = make_point_charge_config(FieldEngine::Jacobi);
    let config_gs = make_point_charge_config(FieldEngine::GaussSeidel);
    let config_sor = make_point_charge_config(FieldEngine::SOR { omega: None });

    let mut jacobi = JacobiSolver::new(&config_j);
    let mut gs = GaussSeidelSolver::new(&config_gs);
    let mut sor = SORSolver::new(&config_sor);

    let iters_j = solve_to_convergence(&mut jacobi);
    let iters_gs = solve_to_convergence(&mut gs);
    let iters_sor = solve_to_convergence(&mut sor);

    assert!(iters_sor <= iters_gs,
        "SOR ({iters_sor}) should converge no slower than GS ({iters_gs})");
    assert!(iters_gs <= iters_j,
        "GS ({iters_gs}) should converge no slower than Jacobi ({iters_j})");
}

// ── Monotonic residual decrease ──

#[test]
fn test_monotonic_residual_decrease_gs() {
    let config = make_point_charge_config(FieldEngine::GaussSeidel);
    let mut solver = GaussSeidelSolver::new(&config);

    let mut prev_residual = f64::MAX;
    for _ in 0..100 {
        let result = solver.step(1);
        assert!(result.residual <= prev_residual + 1e-15,
            "Residual increased: {} -> {}", prev_residual, result.residual);
        prev_residual = result.residual;
    }
}

// ── Determinism ──

#[test]
fn test_determinism_gs() {
    let config = make_point_charge_config(FieldEngine::GaussSeidel);

    let mut solver1 = GaussSeidelSolver::new(&config);
    let mut solver2 = GaussSeidelSolver::new(&config);

    solve_to_convergence(&mut solver1);
    solve_to_convergence(&mut solver2);

    let grid1 = solver1.potential();
    let grid2 = solver2.potential();

    for i in 0..grid1.data.len() {
        assert_eq!(grid1.data[i], grid2.data[i],
            "Determinism broken at index {i}");
    }
}

// ── Empty grid → all zeros ──

#[test]
fn test_empty_grid_zero() {
    let config = FieldConfig {
        width: 16,
        height: 16,
        charges: vec![],
        boundary: BoundaryCondition::DirichletZero,
        engine: FieldEngine::GaussSeidel,
        max_iterations: 1000,
        tolerance: 1e-6,
    };
    let mut solver = GaussSeidelSolver::new(&config);
    solver.step(100);

    for &v in &solver.potential().data {
        assert_eq!(v, 0.0);
    }
}
