import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../state/store';
import { renderHeatmap2D } from '../renderer/heatmapCanvas2D';
import { WebGLHeatmapRenderer } from '../renderer/webglHeatmap';
import { extractContours, autoContourLevels } from '../renderer/contours';
import { computeFieldVectors } from '../solver/fieldVectors';
import { generateId } from '../utils/id';
import type { PointCharge } from '../types/simulation';
import './FieldCanvas.css';

const CHARGE_RADIUS = 12;
const VECTOR_SUBSAMPLE = 4; // draw every Nth cell
const VECTOR_MAX_LEN = 20;

export function FieldCanvas() {
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const glRendererRef = useRef<WebGLHeatmapRenderer | null>(null);

  const activeTool = useStore((s) => s.activeTool);
  const selectedId = useStore((s) => s.selectedId);
  const setSelectedId = useStore((s) => s.setSelectedId);
  const solveResult = useStore((s) => s.solveResult);
  const getActiveRun = useStore((s) => s.getActiveRun);
  const forkRun = useStore((s) => s.forkRun);
  const viewport = useStore((s) => s.viewport);
  const showGrid = useStore((s) => s.showGrid);
  const showEquipotentials = useStore((s) => s.showEquipotentials);
  const showVectors = useStore((s) => s.showVectors);

  // Initialize WebGL renderer
  useEffect(() => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return;
    try {
      glRendererRef.current = new WebGLHeatmapRenderer(canvas);
    } catch {
      // WebGL2 not available, fall back to Canvas 2D
      console.warn('WebGL2 not available, using Canvas 2D fallback');
    }
    return () => {
      glRendererRef.current?.dispose();
      glRendererRef.current = null;
    };
  }, []);

  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const run = getActiveRun();
    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);

    if (!run) return;
    const config = run.config;
    const cellW = (width / config.grid.width) * viewport.scale;
    const cellH = (height / config.grid.height) * viewport.scale;

    // Grid
    if (showGrid && cellW > 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= config.grid.width; x++) {
        const px = x * cellW + viewport.offsetX;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
        ctx.stroke();
      }
      for (let y = 0; y <= config.grid.height; y++) {
        const py = y * cellH + viewport.offsetY;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(width, py);
        ctx.stroke();
      }
    }

    // Contour lines
    if (showEquipotentials && solveResult) {
      const levels = autoContourLevels(solveResult.potential);
      const contours = extractContours(
        solveResult.potential,
        solveResult.width,
        solveResult.height,
        levels,
      );

      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;

      for (const level of contours) {
        for (const seg of level.segments) {
          const x1 = seg.x1 * cellW + viewport.offsetX;
          const y1 = seg.y1 * cellH + viewport.offsetY;
          const x2 = seg.x2 * cellW + viewport.offsetX;
          const y2 = seg.y2 * cellH + viewport.offsetY;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    }

    // Field vectors
    if (showVectors && solveResult) {
      const field = computeFieldVectors(
        solveResult.potential,
        solveResult.width,
        solveResult.height,
      );

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

          // Scale arrow length by magnitude, capped
          const len = Math.min(mag * cellW * 2, VECTOR_MAX_LEN);
          const nx = ex / mag;
          const ny = ey / mag;

          const tx = cx + nx * len;
          const ty = cy + ny * len;

          // Arrow line
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(tx, ty);
          ctx.stroke();

          // Arrowhead
          const headLen = 4;
          const angle = Math.atan2(ny, nx);
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(
            tx - headLen * Math.cos(angle - 0.4),
            ty - headLen * Math.sin(angle - 0.4),
          );
          ctx.lineTo(
            tx - headLen * Math.cos(angle + 0.4),
            ty - headLen * Math.sin(angle + 0.4),
          );
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // Charges
    for (const charge of config.charges) {
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
  }, [solveResult, viewport, showGrid, showEquipotentials, showVectors, selectedId, getActiveRun]);

  const drawWebGL = useCallback(() => {
    const renderer = glRendererRef.current;
    if (!renderer || !solveResult) return;

    // Compute min/max for normalization
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < solveResult.potential.length; i++) {
      if (solveResult.potential[i] < min) min = solveResult.potential[i];
      if (solveResult.potential[i] > max) max = solveResult.potential[i];
    }

    renderer.updatePotential(solveResult.potential, solveResult.width, solveResult.height);
    renderer.setMinMax(min, max);
    renderer.render(viewport);
  }, [solveResult, viewport]);

  const drawFallback = useCallback(() => {
    if (glRendererRef.current) return; // WebGL available, skip fallback
    const canvas = webglCanvasRef.current;
    if (!canvas || !solveResult) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderHeatmap2D(
      ctx,
      solveResult.potential,
      solveResult.width,
      solveResult.height,
      canvas.width,
      canvas.height,
      viewport,
    );
  }, [solveResult, viewport]);

  // Resize
  useEffect(() => {
    const container = containerRef.current;
    const webglCanvas = webglCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!container || !webglCanvas || !overlayCanvas) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const w = Math.floor(width);
      const h = Math.floor(height);
      webglCanvas.width = w;
      webglCanvas.height = h;
      overlayCanvas.width = w;
      overlayCanvas.height = h;
      drawWebGL();
      drawFallback();
      drawOverlay();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [drawWebGL, drawFallback, drawOverlay]);

  // Redraw on state changes
  useEffect(() => {
    drawWebGL();
    drawFallback();
    drawOverlay();
  }, [drawWebGL, drawFallback, drawOverlay]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const run = getActiveRun();
    if (!run) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const cellW = (canvas.width / run.config.grid.width) * viewport.scale;
    const cellH = (canvas.height / run.config.grid.height) * viewport.scale;
    const gx = Math.floor((px - viewport.offsetX) / cellW);
    const gy = Math.floor((py - viewport.offsetY) / cellH);

    if (activeTool === 'select') {
      let found: string | null = null;
      for (const charge of run.config.charges) {
        const cx = (charge.x + 0.5) * cellW + viewport.offsetX;
        const cy = (charge.y + 0.5) * cellH + viewport.offsetY;
        if (Math.hypot(px - cx, py - cy) <= CHARGE_RADIUS + 4) {
          found = charge.id;
          break;
        }
      }
      setSelectedId(found);
    } else if (activeTool === 'place_positive' || activeTool === 'place_negative') {
      if (gx < 0 || gx >= run.config.grid.width || gy < 0 || gy >= run.config.grid.height) return;

      const q = activeTool === 'place_positive' ? 1.0 : -1.0;
      const newCharge: PointCharge = { id: generateId(), x: gx, y: gy, q };
      forkRun(run.id, { charges: [...run.config.charges, newCharge] });
    }
  };

  return (
    <div ref={containerRef} className="field-canvas-container">
      <canvas ref={webglCanvasRef} className="field-canvas webgl-layer" />
      <canvas
        ref={overlayCanvasRef}
        className="field-canvas overlay-layer"
        onClick={handleClick}
      />
    </div>
  );
}
