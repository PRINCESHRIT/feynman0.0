/**
 * Export utilities — Phase 7.
 *
 * All exports are explicit, off-path actions — they never affect
 * interactive latency. They read from the current state snapshot.
 */

import type { FieldConfig, SolveResult } from '../types/simulation';

// ── F7.1: Export PNG ──

export function exportPNG(canvas: HTMLCanvasElement, filename = 'field-export.png') {
  try {
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('[Export] Failed to create PNG blob');
        return;
      }
      downloadBlob(blob, filename);
    }, 'image/png');
  } catch (err) {
    console.error('[Export] Canvas readback failed:', err);
  }
}

/**
 * Composite two canvases (WebGL + overlay) into a single PNG export.
 */
export function exportCompositePNG(
  webglCanvas: HTMLCanvasElement,
  overlayCanvas: HTMLCanvasElement,
  filename = 'field-export.png',
) {
  try {
    const w = webglCanvas.width;
    const h = webglCanvas.height;
    const composite = document.createElement('canvas');
    composite.width = w;
    composite.height = h;
    const ctx = composite.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(webglCanvas, 0, 0);
    ctx.drawImage(overlayCanvas, 0, 0);

    composite.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, filename);
    }, 'image/png');
  } catch (err) {
    console.error('[Export] Composite PNG failed:', err);
  }
}

// ── F7.2: Export Config JSON ──

export function exportConfigJSON(config: FieldConfig, filename = 'config.json') {
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, filename);
}

/**
 * Import a config from a JSON string.
 * Returns null with a message if malformed.
 */
export function importConfigJSON(json: string): { config: FieldConfig | null; error: string | null } {
  try {
    const parsed = JSON.parse(json);
    // Basic validation
    if (!parsed.grid || !Array.isArray(parsed.charges)) {
      return { config: null, error: 'Invalid config: missing grid or charges' };
    }
    return { config: parsed as FieldConfig, error: null };
  } catch (err) {
    return { config: null, error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ── F7.2: Export Data CSV ──

export function exportDataCSV(result: SolveResult, filename = 'potential.csv') {
  const { potential, width, height } = result;
  const lines: string[] = [];

  // Header
  const header = Array.from({ length: width }, (_, i) => `x${i}`).join(',');
  lines.push(`y/x,${header}`);

  // Data rows
  for (let y = 0; y < height; y++) {
    const row = Array.from({ length: width }, (_, x) => {
      const val = potential[y * width + x];
      return val.toFixed(6);
    }).join(',');
    lines.push(`${y},${row}`);
  }

  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, filename);
}

// ── F7.3: Shareable Link ──

const MAX_URL_CONFIG_SIZE = 4000; // Bytes before we switch to hash-based

/**
 * Encode config into a shareable URL fragment.
 * If too large, returns a note suggesting file-based sharing.
 */
export function encodeConfigToURL(config: FieldConfig): string {
  const json = JSON.stringify(config);
  const encoded = btoa(encodeURIComponent(json));

  if (encoded.length > MAX_URL_CONFIG_SIZE) {
    return ''; // Too large — caller should warn
  }

  return `${window.location.origin}${window.location.pathname}#config=${encoded}`;
}

/**
 * Decode config from URL hash fragment.
 * Returns null with clear message if malformed/expired.
 */
export function decodeConfigFromURL(): { config: FieldConfig | null; error: string | null } {
  try {
    const hash = window.location.hash;
    if (!hash.startsWith('#config=')) {
      return { config: null, error: null }; // No config in URL
    }

    const encoded = hash.slice('#config='.length);
    const json = decodeURIComponent(atob(encoded));
    return importConfigJSON(json);
  } catch (err) {
    return { config: null, error: 'Malformed or expired link' };
  }
}

// ── Helpers ──

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
