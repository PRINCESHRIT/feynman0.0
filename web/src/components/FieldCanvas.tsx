/**
 * FieldCanvas — Phase 0 integration.
 *
 * Thin React shell around the decoupled RenderLoop + SolveController.
 * React handles input events and state sync. The RAF loop handles rendering.
 * The worker handles solving. They never wait on each other.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../state/store';
import { RenderLoop } from '../renderer/renderLoop';
import { generateId } from '../utils/id';
import type { PointCharge } from '../types/simulation';
import './FieldCanvas.css';

const CHARGE_RADIUS = 12;

export function FieldCanvas() {
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderLoopRef = useRef<RenderLoop | null>(null);

  const activeTool = useStore((s) => s.activeTool);
  const selectedId = useStore((s) => s.selectedId);
  const setSelectedId = useStore((s) => s.setSelectedId);
  const getActiveRun = useStore((s) => s.getActiveRun);
  const forkRun = useStore((s) => s.forkRun);
  const viewport = useStore((s) => s.viewport);
  const showGrid = useStore((s) => s.showGrid);
  const showEquipotentials = useStore((s) => s.showEquipotentials);
  const showVectors = useStore((s) => s.showVectors);

  // Boot render loop once
  useEffect(() => {
    const webgl = webglCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!webgl || !overlay) return;

    const loop = new RenderLoop();
    loop.attach(webgl, overlay);
    loop.start();
    renderLoopRef.current = loop;

    return () => {
      loop.dispose();
      renderLoopRef.current = null;
    };
  }, []);

  // Sync React state → render loop (cheap writes, no renders)
  useEffect(() => {
    const loop = renderLoopRef.current;
    if (!loop) return;

    const run = getActiveRun();
    loop.updateState({
      viewport,
      gridWidth: run?.config.grid.width ?? 128,
      gridHeight: run?.config.grid.height ?? 128,
      charges: run?.config.charges ?? [],
      selectedId,
      showGrid,
      showEquipotentials,
      showVectors,
    });
  }, [viewport, selectedId, showGrid, showEquipotentials, showVectors, getActiveRun]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    const webgl = webglCanvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!container || !webgl || !overlay) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const w = Math.floor(width);
      const h = Math.floor(height);
      webgl.width = w;
      webgl.height = h;
      overlay.width = w;
      overlay.height = h;
      renderLoopRef.current?.invalidate();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
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
  }, [activeTool, viewport, getActiveRun, forkRun, setSelectedId]);

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
