use serde::{Deserialize, Serialize};

/// Component in a DC circuit.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Component {
    Resistor { id: String, node_a: usize, node_b: usize, resistance: f64 },
    VoltageSource { id: String, node_pos: usize, node_neg: usize, voltage: f64 },
    CurrentSource { id: String, node_pos: usize, node_neg: usize, current: f64 },
    Wire { id: String, node_a: usize, node_b: usize },
    Ground { node: usize },
}

/// Circuit configuration for MNA solver.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitConfig {
    pub num_nodes: usize,
    pub components: Vec<Component>,
    pub ground_node: usize,
}

/// Result of MNA solve.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitResult {
    pub node_voltages: Vec<f64>,
    pub branch_currents: Vec<(String, f64)>, // (component_id, current)
    pub success: bool,
    pub error: Option<String>,
}

/// Solve DC circuit using Modified Nodal Analysis.
///
/// Builds the MNA matrix [G B; C D] x [v; i] = [s1; s2] and solves via
/// Gaussian elimination with partial pivoting.
pub fn solve_mna(config: &CircuitConfig) -> CircuitResult {
    let n = config.num_nodes; // number of nodes (excluding ground)

    // Count voltage sources for extra MNA variables
    let voltage_sources: Vec<_> = config.components.iter().filter_map(|c| {
        match c {
            Component::VoltageSource { id, node_pos, node_neg, voltage } =>
                Some((id.clone(), *node_pos, *node_neg, *voltage)),
            Component::Wire { id, node_a, node_b } =>
                Some((id.clone(), *node_a, *node_b, 0.0)), // Wire = 0V source
            _ => None,
        }
    }).collect();

    let m = voltage_sources.len(); // number of voltage sources
    let size = n + m; // total matrix size

    if size == 0 {
        return CircuitResult {
            node_voltages: vec![],
            branch_currents: vec![],
            success: true,
            error: None,
        };
    }

    let mut matrix = vec![vec![0.0; size + 1]; size]; // augmented [A | b]
    let ground = config.ground_node;

    // Helper: map node to matrix index (ground node is eliminated)
    let node_idx = |node: usize| -> Option<usize> {
        if node == ground { None } else if node < ground { Some(node) } else { Some(node - 1) }
    };

    // Stamp resistors into G matrix
    for component in &config.components {
        if let Component::Resistor { node_a, node_b, resistance, .. } = component {
            if *resistance <= 0.0 { continue; }
            let g = 1.0 / resistance;

            if let Some(i) = node_idx(*node_a) {
                matrix[i][i] += g;
            }
            if let Some(j) = node_idx(*node_b) {
                matrix[j][j] += g;
            }
            if let (Some(i), Some(j)) = (node_idx(*node_a), node_idx(*node_b)) {
                matrix[i][j] -= g;
                matrix[j][i] -= g;
            }
        }
    }

    // Stamp current sources into RHS
    for component in &config.components {
        if let Component::CurrentSource { node_pos, node_neg, current, .. } = component {
            if let Some(i) = node_idx(*node_pos) {
                matrix[i][size] -= current; // Current flows out of node_pos
            }
            if let Some(j) = node_idx(*node_neg) {
                matrix[j][size] += current; // Current flows into node_neg
            }
        }
    }

    // Stamp voltage sources
    for (k, (_, node_pos, node_neg, voltage)) in voltage_sources.iter().enumerate() {
        let col = n + k; // column/row index for this voltage source current

        if let Some(i) = node_idx(*node_pos) {
            matrix[i][col] += 1.0;
            matrix[col][i] += 1.0;
        }
        if let Some(j) = node_idx(*node_neg) {
            matrix[j][col] -= 1.0;
            matrix[col][j] -= 1.0;
        }

        // RHS: voltage constraint
        matrix[col][size] = *voltage;
    }

    // Gaussian elimination with partial pivoting
    for col in 0..size {
        // Find pivot
        let mut max_row = col;
        let mut max_val = matrix[col][col].abs();
        for row in (col + 1)..size {
            if matrix[row][col].abs() > max_val {
                max_val = matrix[row][col].abs();
                max_row = row;
            }
        }

        if max_val < 1e-15 {
            return CircuitResult {
                node_voltages: vec![0.0; n],
                branch_currents: vec![],
                success: false,
                error: Some("Singular matrix — check circuit connectivity".to_string()),
            };
        }

        // Swap rows
        matrix.swap(col, max_row);

        // Eliminate below
        for row in (col + 1)..size {
            let factor = matrix[row][col] / matrix[col][col];
            for j in col..=size {
                matrix[row][j] -= factor * matrix[col][j];
            }
        }
    }

    // Back substitution
    let mut solution = vec![0.0; size];
    for i in (0..size).rev() {
        let mut sum = matrix[i][size];
        for j in (i + 1)..size {
            sum -= matrix[i][j] * solution[j];
        }
        solution[i] = sum / matrix[i][i];
    }

    // Extract node voltages (re-insert ground = 0)
    let mut node_voltages = vec![0.0; config.num_nodes + 1];
    for node in 0..=n {
        if node == ground {
            node_voltages[node] = 0.0;
        } else {
            let idx = if node < ground { node } else { node - 1 };
            if idx < n {
                node_voltages[node] = solution[idx];
            }
        }
    }

    // Extract branch currents
    let mut branch_currents = Vec::new();

    // Voltage source currents from solution
    for (k, (id, _, _, _)) in voltage_sources.iter().enumerate() {
        branch_currents.push((id.clone(), solution[n + k]));
    }

    // Resistor currents from voltage differences
    for component in &config.components {
        if let Component::Resistor { id, node_a, node_b, resistance } = component {
            if *resistance > 0.0 {
                let current = (node_voltages[*node_a] - node_voltages[*node_b]) / resistance;
                branch_currents.push((id.clone(), current));
            }
        }
    }

    CircuitResult {
        node_voltages: node_voltages[..=n].to_vec(),
        branch_currents,
        success: true,
        error: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_resistor_divider() {
        // 5V source, two 1kΩ resistors in series
        // Node 0 = ground, Node 1 = top, Node 2 = middle
        let config = CircuitConfig {
            num_nodes: 2,
            components: vec![
                Component::VoltageSource { id: "V1".into(), node_pos: 1, node_neg: 0, voltage: 5.0 },
                Component::Resistor { id: "R1".into(), node_a: 1, node_b: 2, resistance: 1000.0 },
                Component::Resistor { id: "R2".into(), node_a: 2, node_b: 0, resistance: 1000.0 },
            ],
            ground_node: 0,
        };
        let result = solve_mna(&config);
        assert!(result.success);
        assert!((result.node_voltages[1] - 5.0).abs() < 1e-10);
        assert!((result.node_voltages[2] - 2.5).abs() < 1e-10);
    }

    #[test]
    fn test_single_resistor() {
        // 10V across a 100Ω resistor: I = V/R = 0.1A
        let config = CircuitConfig {
            num_nodes: 1,
            components: vec![
                Component::VoltageSource { id: "V1".into(), node_pos: 1, node_neg: 0, voltage: 10.0 },
                Component::Resistor { id: "R1".into(), node_a: 1, node_b: 0, resistance: 100.0 },
            ],
            ground_node: 0,
        };
        let result = solve_mna(&config);
        assert!(result.success);
        assert!((result.node_voltages[1] - 10.0).abs() < 1e-10);

        // Find R1 current
        let r1_current = result.branch_currents.iter()
            .find(|(id, _)| id == "R1")
            .map(|(_, i)| *i)
            .unwrap();
        assert!((r1_current - 0.1).abs() < 1e-10);
    }

    #[test]
    fn test_current_source() {
        // 1A current source through 10Ω: V = I*R = 10V
        let config = CircuitConfig {
            num_nodes: 1,
            components: vec![
                Component::CurrentSource { id: "I1".into(), node_pos: 0, node_neg: 1, current: 1.0 },
                Component::Resistor { id: "R1".into(), node_a: 1, node_b: 0, resistance: 10.0 },
            ],
            ground_node: 0,
        };
        let result = solve_mna(&config);
        assert!(result.success);
        assert!((result.node_voltages[1] - 10.0).abs() < 1e-10);
    }
}
