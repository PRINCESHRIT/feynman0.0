/**
 * Export/Import Tests — Phase 7.
 *
 * Tests JSON round-trip, import validation, and share link logic.
 * DOM-dependent tests (CSV download, PNG export) are skipped in Node env.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { importConfigJSON } from '../src/utils/exporters';
import type { FieldConfig } from '../src/types/simulation';

const testConfig: FieldConfig = {
  grid: { width: 33, height: 33 },
  charges: [
    { id: 'q1', x: 16, y: 16, q: 1.0 },
    { id: 'q2', x: 10, y: 10, q: -0.5 },
  ],
  boundary: { type: 'dirichlet_zero' },
  engine: 'gauss_seidel',
  maxIterations: 10000,
  tolerance: 1e-6,
};

describe('importConfigJSON', () => {
  it('valid JSON parses correctly', () => {
    const json = JSON.stringify(testConfig);
    const { config, error } = importConfigJSON(json);

    expect(error).toBeNull();
    expect(config).not.toBeNull();
    expect(config!.grid.width).toBe(33);
    expect(config!.charges.length).toBe(2);
  });

  it('missing grid returns error', () => {
    const { config, error } = importConfigJSON('{"charges": []}');
    expect(config).toBeNull();
    expect(error).toContain('missing grid');
  });

  it('missing charges returns error', () => {
    const { config, error } = importConfigJSON('{"grid": {"width": 33, "height": 33}}');
    expect(config).toBeNull();
    expect(error).toContain('missing grid or charges');
  });

  it('invalid JSON returns parse error', () => {
    const { config, error } = importConfigJSON('not json at all');
    expect(config).toBeNull();
    expect(error).toContain('Invalid JSON');
  });

  it('empty string returns parse error', () => {
    const { config, error } = importConfigJSON('');
    expect(config).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe('JSON round-trip determinism', () => {
  it('stringify → parse → stringify produces identical output', () => {
    const json1 = JSON.stringify(testConfig, null, 2);
    const { config } = importConfigJSON(json1);
    expect(config).not.toBeNull();
    const json2 = JSON.stringify(config, null, 2);
    expect(json2).toBe(json1);
  });

  it('config values are preserved exactly', () => {
    const json = JSON.stringify(testConfig);
    const { config } = importConfigJSON(json);

    expect(config!.grid).toEqual(testConfig.grid);
    expect(config!.charges).toEqual(testConfig.charges);
    expect(config!.boundary).toEqual(testConfig.boundary);
    expect(config!.engine).toBe(testConfig.engine);
    expect(config!.maxIterations).toBe(testConfig.maxIterations);
    expect(config!.tolerance).toBe(testConfig.tolerance);
  });
});

describe('Share link encode/decode logic', () => {
  // Test the underlying Base64 encode/decode logic without window dependency
  it('btoa(encodeURIComponent(json)) is deterministic', () => {
    const json = JSON.stringify(testConfig);
    const encoded1 = btoa(encodeURIComponent(json));
    const encoded2 = btoa(encodeURIComponent(json));
    expect(encoded1).toBe(encoded2);
  });

  it('encode → decode round-trips the config', () => {
    const json = JSON.stringify(testConfig);
    const encoded = btoa(encodeURIComponent(json));
    const decoded = decodeURIComponent(atob(encoded));
    const { config, error } = importConfigJSON(decoded);

    expect(error).toBeNull();
    expect(config).not.toBeNull();
    expect(config!.grid).toEqual(testConfig.grid);
    expect(config!.charges).toEqual(testConfig.charges);
    expect(config!.boundary).toEqual(testConfig.boundary);
  });

  it('corrupted base64 throws on atob', () => {
    expect(() => atob('!!!invalid!!!')).toThrow();
  });

  it('empty config encodes to non-empty string', () => {
    const minConfig: FieldConfig = {
      grid: { width: 5, height: 5 },
      charges: [],
      boundary: { type: 'dirichlet_zero' },
      engine: 'gauss_seidel',
      maxIterations: 100,
      tolerance: 1e-4,
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(minConfig)));
    expect(encoded.length).toBeGreaterThan(0);
  });

  it('large config with many charges produces valid encoding', () => {
    const charges = Array.from({ length: 50 }, (_, i) => ({
      id: `q${i}`,
      x: i % 30 + 1,
      y: Math.floor(i / 30) + 1,
      q: (i % 2 === 0 ? 1 : -1) * (i * 0.1 + 0.5),
    }));
    const bigConfig: FieldConfig = {
      ...testConfig,
      charges,
    };
    const json = JSON.stringify(bigConfig);
    const encoded = btoa(encodeURIComponent(json));
    const decoded = decodeURIComponent(atob(encoded));
    const { config } = importConfigJSON(decoded);

    expect(config).not.toBeNull();
    expect(config!.charges.length).toBe(50);
  });
});

describe('CSV format logic', () => {
  it('generates correct CSV string from potential data', () => {
    const potential = new Float32Array([1, 2, 3, 4]);
    const width = 2;
    const height = 2;

    // Replicate the CSV generation logic from exportDataCSV
    const lines: string[] = [];
    const header = Array.from({ length: width }, (_, i) => `x${i}`).join(',');
    lines.push(`y/x,${header}`);

    for (let y = 0; y < height; y++) {
      const row = Array.from({ length: width }, (_, x) => {
        const val = potential[y * width + x];
        return val.toFixed(6);
      }).join(',');
      lines.push(`${y},${row}`);
    }

    const csv = lines.join('\n');
    expect(csv).toBe('y/x,x0,x1\n0,1.000000,2.000000\n1,3.000000,4.000000');
  });

  it('CSV has correct number of rows and columns', () => {
    const width = 4;
    const height = 3;
    const potential = new Float32Array(width * height).fill(0);

    const lines: string[] = [];
    const header = Array.from({ length: width }, (_, i) => `x${i}`).join(',');
    lines.push(`y/x,${header}`);
    for (let y = 0; y < height; y++) {
      const row = Array.from({ length: width }, (_, x) =>
        potential[y * width + x].toFixed(6),
      ).join(',');
      lines.push(`${y},${row}`);
    }

    expect(lines.length).toBe(height + 1); // header + data rows
    expect(lines[0].split(',').length).toBe(width + 1); // y/x label + x columns
  });

  it('6-digit precision in CSV values', () => {
    const potential = new Float32Array([Math.PI]);
    const val = potential[0].toFixed(6);
    expect(val).toMatch(/^\d+\.\d{6}$/);
  });
});
