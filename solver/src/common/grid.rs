use serde::{Deserialize, Serialize};

/// A 2D grid of f64 values stored in row-major order.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Grid {
    pub width: usize,
    pub height: usize,
    pub data: Vec<f64>,
}

impl Grid {
    pub fn new(width: usize, height: usize) -> Self {
        Self {
            width,
            height,
            data: vec![0.0; width * height],
        }
    }

    #[inline]
    pub fn get(&self, x: usize, y: usize) -> f64 {
        self.data[y * self.width + x]
    }

    #[inline]
    pub fn set(&mut self, x: usize, y: usize, value: f64) {
        self.data[y * self.width + x] = value;
    }

    /// Return data as f32 slice for WebGL consumption.
    pub fn as_f32_vec(&self) -> Vec<f32> {
        self.data.iter().map(|&v| v as f32).collect()
    }
}
