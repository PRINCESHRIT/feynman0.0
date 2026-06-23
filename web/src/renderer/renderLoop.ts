/**
 * Decoupled render loop — Phase 0 (F0.3).
 *
 * Runs on requestAnimationFrame, independent of React's render cycle.
 * Reads the latest solver result and renders it. The solver writes
 * asynchronously; they share only a versioned latest-result handle.
 *
 * Frame budget: 16ms. If exceeded, overlays degrade:
 *   1. Drop field vectors first
 *   2. Drop contour lines
 *   3. Never drop the heatmap or charges
 */

import { WebGLHeatmapRenderer } from './webglHeatmap';
import { renderHeatmap2D } from './heatmapCanvas2D';
import { extractContours, autoContourLevels } from './contours';
import { computeFieldVectors } from '../solver/fieldVectors';
import { getLatestResult, type VersionedResult } from '../solver/solveController';
import type { Viewport } from '../state/uiSlice';
import type { PointCharge } from '../types/simulation';

const FRAME_BUDGET_MS = 14; // Leave 2ms headroom
const CHARGE_RADIUS = 12;
const VECTOR_SUBSAMPLE = 4;
const VECTOR_MAX_LEN = 20;

export interface RenderState {
  viewport: Viewport;
  gridWidth: number;
  gridHeight: number;
  charges: PointCharge[];
  selectedId: string | null;
  showGrid: boolean;
  showEquipotentials: boolean;
  showVectors: boolean;
}

export class RenderLoop {
  private rafId = 0;
  private running = false;

  private webglCanvas: HTMLCanvasElement | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private glRenderer: WebGLHeatmapRenderer | null = null;
  private useWebGL = false;

  // Last rendered version — skip re-render if unchanged
  private lastRenderedVersion = -1;
  private lastRenderState: RenderState | null = null;
  private renderStateDirty = true;

  // Current render state (written by React, read by RAF loop)
  private state: RenderState = {
    viewport: { offsetX: 0, offsetY: 0, scale: 1 },
    gridWidth: 128,
    gridHeight: 128,
    charges: [],
    selectedId: null,
    showGrid: true,
    showEquipotentials: true,
    showVectors: false,
  };

  // Frame budget tracking for adaptive quality
  private lastFrameTime = 0;
  private skipVectors = false;
  private skipContours = false;

  attach(webglCanvas: HTMLCanvasElement, overlayCanvas: HTMLCanvasElement) {
    this.webglCanvas = webglCanvas;
    this.overlayCanvas = overlayCanvas;

    try {
      this.glRenderer = new WebGLHeatmapRenderer(webglCanvas);
      this.useWebGL = true;
    } catch {
      console.warn('[RenderLoop] WebGL2 unavailable, using Canvas 2D fallback');
      this.useWebGL = false;
    }
  }

  /** Update render state from React. Cheap — just writes fields. */
  updateState(partial: Partial<RenderState>) {
    Object.assign(this.state, partial);
    this.renderStateDirty = true;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.tick();
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  /** Force a re-render on next frame (e.g., after resize). */
  invalidate() {
    this.lastRenderedVersion = -1;
    this.renderStateDirty = true;
  }

  dispose() {
    this.stop();
    this.glRenderer?.dispose();
    this.glRenderer = null;
    this.webglCanvas = null;
    this.overlayCanvas = null;
  }

  // ── RAF tick ──

  private tick = () => {
    if (!this.running) return;

    const latest = getLatestResult();
    const versionChanged = latest ? latest.version !== this.lastRenderedVersion : false;
    const stateChanged = this.renderStateDirty;

    if (versionChanged || stateChanged) {
      const t0 = performance.now();
      this.renderFrame(latest);
      this.lastFrameTime = performance.now() - t0;

      // Adaptive quality: if over budget, degrade overlays next frame
      if (this.lastFrameTime > FRAME_BUDGET_MS) {
        if (!this.skipVectors) {
          this.skipVectors = true;
        } else if (!this.skipContours) {
          this.skipContours = true;
        }
      } else if (this.lastFrameTime < FRAME_BUDGET_MS * 0.6) {
        // Restore quality when headroom available
        if (this.skipContours) {
          this.skipContours = false;
        } else if (this.skipVectors) {
          this.skipVectors = false;
        }
      }

      if (latest) this.lastRenderedVersion = latest.version;
      this.renderStateDirty = false;
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  // ── Render a single frame ──

  private renderFrame(latest: VersionedResult | null) {
    const result = latest?.result ?? null;

    // 1. Heatmap (WebGL or Canvas 2D) — never skipped
    this.renderHeatmap(result);

    // 2. Overlay (grid, contours, vectors, charges)
    this.renderOverlay(result);
  }

  private renderHeatmap(result: ReturnType<typeof getLatestResult> extends infer R ? R extends VersionedResult ? R['result'] : null : null) {
    if (!result) {
      // Clear
      if (this.useWebGL && this.glRenderer && this.webglCanvas) {
        const gl = (this.glRenderer as any).gl as WebGL2RenderingContext;
        gl.viewport(0, 0, this.webglCanvas.width, this.webglCanvas.height);
        gl.clearColor(0.1, 0.1, 0.18, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      } else if (this.webglCanvas) {
        const ctx = this.webglCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(0, 0, this.webglCanvas.width, this.webglCanvas.height);
        }
      }
      return;
    }

    // Compute min/max
    let min = Infinity;
    let max = -Infinity;
    const p = result.potential;
    for (let i = 0; i < p.length; i++) {
      if (p[i] < min) min = p[i];
      if (p[i] > max) max = p[i];
    }

    if (this.useWebGL && this.glRenderer) {
      this.glRenderer.updatePotential(result.potential, result.width, result.height);
      this.glRenderer.setMinMax(min, max);
      this.glRenderer.render(this.state.viewport);
    } else if (this.webglCanvas) {
      const ctx = this.webglCanvas.getContext('2d');
      if (ctx) {
        renderHeatmap2D(
          ctx, result.potential, result.width, result.height,
          this.webglCanvas.width, this.webglCanvas.height, this.state.viewport,
        );
      }
    }
  }

  private renderOverlay(result: { potential: Float32Array; width: number; height: number } | null) {
    const canvas = this.overlayCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const { viewport, gridWidth, gridHeight, charges, selectedId, showGrid, showEquipotentials, showVectors } = this.state;
    const cellW = (width / gridWidth) * viewport.scale;
    const cellH = (height / gridHeight) * viewport.scale;

    // Grid
    if (showGrid && cellW > 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x = 0; x <= gridWidth; x++) {
        const px = x * cellW + viewport.offsetX;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
      }
      for (let y = 0; y <= gridHeight; y++) {
        const py = y * cellH + viewport.offsetY;
        ctx.moveTo(0, py);
        ctx.lineTo(width, py);
      }
      ctx.stroke();
    }

    if (!result) {
      // Still draw charges even without a solve result
      this.drawCharges(ctx, charges, selectedId, cellW, cellH, viewport);
      return;
    }

    // Contour lines (skip if frame budget demands)
    if (showEquipotentials && !this.skipContours) {
      const levels = autoContourLevels(result.potential);
      const contours = extractContours(result.potential, result.width, result.height, levels);

      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const level of contours) {
        for (const seg of level.segments) {
          ctx.moveTo(seg.x1 * cellW + viewport.offsetX, seg.y1 * cellH + viewport.offsetY);
          ctx.lineTo(seg.x2 * cellW + viewport.offsetX, seg.y2 * cellH + viewport.offsetY);
        }
      }
      ctx.stroke();
    }

    // Field vectors (skip first if frame budget demands)
    if (showVectors && !this.skipVectors) {
      const field = computeFieldVectors(result.potential, result.width, result.height);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;

      const step = VECTOR_SUBSAMPLE;
      for (let gy = step; gy < field.height - step; gy += step) {
        for (let gx = step; gx < field.width - step; gx += step) {
          const idx = gy * field.width + gx;
          const ex = field.ex[idx];
          const ey = field.ey[idx];
          const mag = Math.sqrt(ex * ex + ey * ey);
          if (mag < 1e-10) continue;

          const cx = (gx + 0.5) * cellW + viewport.offsetX;
          const cy = (gy + 0.5) * cellH + viewport.offsetY;
          const len = Math.min(mag * cellW * 2, VECTOR_MAX_LEN);
          const nx = ex / mag;
          const ny = ey / mag;
          const tx = cx + nx * len;
          const ty = cy + ny * len;

          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(tx, ty);
          ctx.stroke();

          const headLen = 4;
          const angle = Math.atan2(ny, nx);
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx - headLen * Math.cos(angle - 0.4), ty - headLen * Math.sin(angle - 0.4));
          ctx.lineTo(tx - headLen * Math.cos(angle + 0.4), ty - headLen * Math.sin(angle + 0.4));
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Charges — always drawn
    this.drawCharges(ctx, charges, selectedId, cellW, cellH, viewport);
  }

  private drawCharges(
    ctx: CanvasRenderingContext2D,
    charges: PointCharge[],
    selectedId: string | null,
    cellW: number,
    cellH: number,
    viewport: Viewport,
  ) {
    for (const charge of charges) {
      const cx = (charge.x + 0.5) * cellW + viewport.offsetX;
      const cy = (charge.y + 0.5) * cellH + viewport.offsetY;
      const isSelected = selectedId === charge.id;

      ctx.beginPath();
      ctx.arc(cx, cy, CHARGE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = charge.q > 0
        ? (isSelected ? '#ff6b6b' : '#ef5350')
        : (isSelected ? '#64b5f6' : '#42a5f5');
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(charge.q > 0 ? '+' : '\u2212', cx, cy);
    }
  }
}
