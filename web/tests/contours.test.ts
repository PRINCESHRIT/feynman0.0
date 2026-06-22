import { describe, it, expect } from 'vitest';
import { extractContours, autoContourLevels } from '../src/renderer/contours';

describe('Marching squares contours', () => {
  it('linear ramp produces horizontal contour lines', () => {
    // V(x,y) = y → contours at constant y values
    const width = 10;
    const height = 10;
    const data = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        data[y * width + x] = y;
      }
    }

    const contours = extractContours(data, width, height, [3.5]);
    expect(contours).toHaveLength(1);
    expect(contours[0].segments.length).toBeGreaterThan(0);

    // All segments should be at y ≈ 3.5
    for (const seg of contours[0].segments) {
      expect(seg.y1).toBeCloseTo(3.5, 5);
      expect(seg.y2).toBeCloseTo(3.5, 5);
    }
  });

  it('no contours for uniform field', () => {
    const data = new Float32Array(25).fill(1.0);
    const contours = extractContours(data, 5, 5, [0.5, 1.5]);
    // Level 0.5 and 1.5 should produce no segments since all values are 1.0
    expect(contours[0].segments).toHaveLength(0);
    expect(contours[1].segments).toHaveLength(0);
  });

  it('autoContourLevels produces symmetric levels', () => {
    const data = new Float32Array([-2, -1, 0, 1, 2]);
    const levels = autoContourLevels(data, 5);
    // Should be symmetric around 0
    expect(levels).toHaveLength(4); // count - 1 levels
    expect(levels[0]).toBeCloseTo(-levels[levels.length - 1], 5);
  });
});
