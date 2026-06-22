import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../state/store';
import { renderHeatmap2D } from '../renderer/heatmapCanvas2D';
import { generateId } from '../utils/id';
import type { PointCharge } from '../types/simulation';
import './FieldCanvas.css';

const CHARGE_RADIUS = 12;

export function FieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeTool = useStore((s) => s.activeTool);
  const selectedId = useStore((s) => s.selectedId);
  const setSelectedId = useStore((s) => s.setSelectedId);
  const solveResult = useStore((s) => s.solveResult);
  const getActiveRun = useStore((s) => s.getActiveRun);
  const forkRun = useStore((s) => s.forkRun);
  const viewport = useStore((s) => s.viewport);
  const showGrid = useStore((s) => s.showGrid);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const run = getActiveRun();
    const { width, height } = canvas;

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Draw heatmap if result exists
    if (solveResult) {
      renderHeatmap2D(
        ctx,
        solveResult.potential,
        solveResult.width,
        solveResult.height,
        width,
        height,
        viewport,
      );
    }

    if (!run) return;
    const config = run.config;
    const cellW = (width / config.grid.width) * viewport.scale;
    const cellH = (height / config.grid.height) * viewport.scale;

    // Draw grid
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

    // Draw charges
    for (const charge of config.charges) {
      const cx = (charge.x + 0.5) * cellW + viewport.offsetX;
      const cy = (charge.y + 0.5) * cellH + viewport.offsetY;
      const isSelected = selectedId === charge.id;

      ctx.beginPath();
      ctx.arc(cx, cy, CHARGE_RADIUS, 0, Math.PI * 2);

      if (charge.q > 0) {
        ctx.fillStyle = isSelected ? '#ff6b6b' : '#ef5350';
      } else {
        ctx.fillStyle = isSelected ? '#64b5f6' : '#42a5f5';
      }
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(charge.q > 0 ? '+' : '−', cx, cy);
    }
  }, [solveResult, viewport, showGrid, selectedId, getActiveRun]);

  // Resize canvas to container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      canvas.width = width;
      canvas.height = height;
      draw();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  // Redraw on state changes
  useEffect(() => {
    draw();
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
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
      // Check if clicking on a charge
      let found: string | null = null;
      for (const charge of run.config.charges) {
        const cx = (charge.x + 0.5) * cellW + viewport.offsetX;
        const cy = (charge.y + 0.5) * cellH + viewport.offsetY;
        const dist = Math.hypot(px - cx, py - cy);
        if (dist <= CHARGE_RADIUS + 4) {
          found = charge.id;
          break;
        }
      }
      setSelectedId(found);
    } else if (activeTool === 'place_positive' || activeTool === 'place_negative') {
      if (gx < 0 || gx >= run.config.grid.width || gy < 0 || gy >= run.config.grid.height) return;

      const q = activeTool === 'place_positive' ? 1.0 : -1.0;
      const newCharge: PointCharge = { id: generateId(), x: gx, y: gy, q };
      const newCharges = [...run.config.charges, newCharge];
      forkRun(run.id, { charges: newCharges });
    }
  };

  return (
    <div ref={containerRef} className="field-canvas-container">
      <canvas ref={canvasRef} className="field-canvas" onClick={handleClick} />
    </div>
  );
}
