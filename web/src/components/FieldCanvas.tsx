/**
 * FieldCanvas — Phase 1: Editable Canvas.
 *
 * - F1.1: Drag-drop placement from palette → snapped grid cell → preview solve
 * - F1.2: Selection (single click, Shift+click multi, marquee rubber-band)
 * - F1.3: Move with live snap — drag selected charges, throttled re-solve
 * - F1.4: Zoom/pan — pure render transform, NEVER re-solves
 *
 * Latency contract: pointer-release to first updated preview ≤ 1 frame;
 * dragging never stutters; zoom/pan is instant.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../state/store';
import { RenderLoop } from '../renderer/renderLoop';
import { requestSolve } from '../solver/solveController';
import { generateId } from '../utils/id';
import type { PointCharge } from '../types/simulation';
import './FieldCanvas.css';

const CHARGE_RADIUS = 12;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 5;
const ZOOM_FACTOR = 1.1;

// Interaction modes
type Interaction =
  | { type: 'none' }
  | { type: 'pan'; startX: number; startY: number; startOX: number; startOY: number }
  | { type: 'marquee'; startX: number; startY: number; curX: number; curY: number }
  | { type: 'move'; startGx: number; startGy: number; origPositions: Map<string, { x: number; y: number }> };

export function FieldCanvas() {
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderLoopRef = useRef<RenderLoop | null>(null);
  const interactionRef = useRef<Interaction>({ type: 'none' });
  const previewTimerRef = useRef<number>(0);

  const activeTool = useStore((s) => s.activeTool);
  const selectedIds = useStore((s) => s.selectedIds);
  const setSelectedIds = useStore((s) => s.setSelectedIds);
  const addSelectedId = useStore((s) => s.addSelectedId);
  const clearSelection = useStore((s) => s.clearSelection);
  const getActiveRun = useStore((s) => s.getActiveRun);
  const forkRun = useStore((s) => s.forkRun);
  const viewport = useStore((s) => s.viewport);
  const setViewport = useStore((s) => s.setViewport);
  const showGrid = useStore((s) => s.showGrid);
  const showEquipotentials = useStore((s) => s.showEquipotentials);
  const showVectors = useStore((s) => s.showVectors);

  // ── Helpers ──

  const getGridCoords = useCallback((px: number, py: number) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { gx: 0, gy: 0 };
    const run = getActiveRun();
    if (!run) return { gx: 0, gy: 0 };
    const vp = useStore.getState().viewport;
    const cellW = (canvas.width / run.config.grid.width) * vp.scale;
    const cellH = (canvas.height / run.config.grid.height) * vp.scale;
    return {
      gx: Math.floor((px - vp.offsetX) / cellW),
      gy: Math.floor((py - vp.offsetY) / cellH),
    };
  }, [getActiveRun]);

  const hitTestCharge = useCallback((px: number, py: number): string | null => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return null;
    const run = getActiveRun();
    if (!run) return null;
    const vp = useStore.getState().viewport;
    const cellW = (canvas.width / run.config.grid.width) * vp.scale;
    const cellH = (canvas.height / run.config.grid.height) * vp.scale;

    for (const charge of run.config.charges) {
      const cx = (charge.x + 0.5) * cellW + vp.offsetX;
      const cy = (charge.y + 0.5) * cellH + vp.offsetY;
      if (Math.hypot(px - cx, py - cy) <= CHARGE_RADIUS + 4) {
        return charge.id;
      }
    }
    return null;
  }, [getActiveRun]);

  const firePreviewSolve = useCallback(() => {
    const run = getActiveRun();
    if (!run) return;
    // Debounce: cancel previous, fire new
    clearTimeout(previewTimerRef.current);
    previewTimerRef.current = window.setTimeout(() => {
      requestSolve(run.config, 'preview');
    }, 16); // One frame debounce
  }, [getActiveRun]);

  // ── Boot render loop ──

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

  // ── Sync React state → render loop ──

  useEffect(() => {
    const loop = renderLoopRef.current;
    if (!loop) return;
    const run = getActiveRun();
    loop.updateState({
      viewport,
      selectedIds,
      gridWidth: run?.config.grid.width ?? 128,
      gridHeight: run?.config.grid.height ?? 128,
      charges: run?.config.charges ?? [],
      selectedId: selectedIds.size === 1 ? selectedIds.values().next().value! : null,
      showGrid,
      showEquipotentials,
      showVectors,
    });
  }, [viewport, selectedIds, showGrid, showEquipotentials, showVectors, getActiveRun]);

  // ── Resize observer ──

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

  // ── F1.4: Zoom (wheel) — pure render transform, never re-solves ──

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const vp = useStore.getState().viewport;
    const rect = overlayCanvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const direction = e.deltaY < 0 ? 1 : -1;
    const factor = direction > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    const newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, vp.scale * factor));
    const ratio = newScale / vp.scale;

    // Zoom toward cursor
    setViewport({
      offsetX: mx - (mx - vp.offsetX) * ratio,
      offsetY: my - (my - vp.offsetY) * ratio,
      scale: newScale,
    });
  }, [setViewport]);

  // ── Pointer events (F1.1, F1.2, F1.3, F1.4) ──

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // F1.4: Middle mouse or Alt+Left → pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      const vp = useStore.getState().viewport;
      interactionRef.current = {
        type: 'pan',
        startX: px,
        startY: py,
        startOX: vp.offsetX,
        startOY: vp.offsetY,
      };
      return;
    }

    if (e.button !== 0) return;

    const run = getActiveRun();
    if (!run) return;

    // F1.1: Placement tools
    if (activeTool === 'place_positive' || activeTool === 'place_negative') {
      const { gx, gy } = getGridCoords(px, py);
      if (gx < 0 || gx >= run.config.grid.width || gy < 0 || gy >= run.config.grid.height) return;

      // F1.1 error: check for overlap
      const overlap = run.config.charges.find((c) => c.x === gx && c.y === gy);
      if (overlap) return; // Snap to nearest free cell would go here

      const q = activeTool === 'place_positive' ? 1.0 : -1.0;
      const newCharge: PointCharge = { id: generateId(), x: gx, y: gy, q };
      forkRun(run.id, { charges: [...run.config.charges, newCharge] });
      setSelectedIds(new Set([newCharge.id]));
      firePreviewSolve();
      return;
    }

    // F1.2: Select tool
    const hitId = hitTestCharge(px, py);

    if (hitId) {
      if (e.shiftKey) {
        // Shift+click: toggle in multi-selection
        const next = new Set(selectedIds);
        if (next.has(hitId)) next.delete(hitId);
        else next.add(hitId);
        setSelectedIds(next);
      } else if (!selectedIds.has(hitId)) {
        // Single click on unselected → select it
        setSelectedIds(new Set([hitId]));
      }
      // In all cases where we clicked a charge, begin move interaction (F1.3)
      const { gx, gy } = getGridCoords(px, py);
      const effectiveSelection = selectedIds.has(hitId) ? selectedIds : new Set([hitId]);
      const origPositions = new Map<string, { x: number; y: number }>();
      for (const id of effectiveSelection) {
        const charge = run.config.charges.find((c) => c.id === id);
        if (charge) origPositions.set(id, { x: charge.x, y: charge.y });
      }
      interactionRef.current = {
        type: 'move',
        startGx: gx,
        startGy: gy,
        origPositions,
      };
    } else {
      if (!e.shiftKey) {
        clearSelection();
      }
      // F1.2: Start marquee
      interactionRef.current = {
        type: 'marquee',
        startX: px,
        startY: py,
        curX: px,
        curY: py,
      };
    }
  }, [activeTool, selectedIds, getActiveRun, forkRun, setSelectedIds, addSelectedId, clearSelection, getGridCoords, hitTestCharge, firePreviewSolve]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const interaction = interactionRef.current;

    switch (interaction.type) {
      case 'pan': {
        // F1.4: Pan — pure render transform
        const dx = px - interaction.startX;
        const dy = py - interaction.startY;
        setViewport({
          ...useStore.getState().viewport,
          offsetX: interaction.startOX + dx,
          offsetY: interaction.startOY + dy,
        });
        break;
      }

      case 'marquee': {
        // F1.2: Update marquee rectangle
        interaction.curX = px;
        interaction.curY = py;
        // Draw marquee on overlay (render loop doesn't handle this — we draw it imperatively)
        drawMarquee(canvas, interaction.startX, interaction.startY, px, py);
        break;
      }

      case 'move': {
        // F1.3: Move selected charges with live snap
        const { gx, gy } = getGridCoords(px, py);
        const dx = gx - interaction.startGx;
        const dy = gy - interaction.startGy;
        if (dx === 0 && dy === 0) break;

        const run = getActiveRun();
        if (!run) break;

        // Move all selected charges — render immediately, throttle re-solve
        const newCharges = run.config.charges.map((c) => {
          const orig = interaction.origPositions.get(c.id);
          if (!orig) return c;
          const nx = Math.max(0, Math.min(run.config.grid.width - 1, orig.x + dx));
          const ny = Math.max(0, Math.min(run.config.grid.height - 1, orig.y + dy));
          return { ...c, x: nx, y: ny };
        });

        // Update render loop immediately (no fork yet — that happens on release)
        renderLoopRef.current?.updateState({ charges: newCharges });
        break;
      }
    }
  }, [getGridCoords, setViewport, getActiveRun]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (canvas) canvas.releasePointerCapture(e.pointerId);

    const rect = canvas?.getBoundingClientRect();
    const px = rect ? e.clientX - rect.left : 0;
    const py = rect ? e.clientY - rect.top : 0;
    const interaction = interactionRef.current;

    switch (interaction.type) {
      case 'marquee': {
        // F1.2: Finish marquee — select all charges inside rectangle
        const run = getActiveRun();
        if (!run || !canvas) break;

        const vp = useStore.getState().viewport;
        const cellW = (canvas.width / run.config.grid.width) * vp.scale;
        const cellH = (canvas.height / run.config.grid.height) * vp.scale;

        const x1 = Math.min(interaction.startX, interaction.curX);
        const y1 = Math.min(interaction.startY, interaction.curY);
        const x2 = Math.max(interaction.startX, interaction.curX);
        const y2 = Math.max(interaction.startY, interaction.curY);

        const ids = new Set<string>();
        for (const charge of run.config.charges) {
          const cx = (charge.x + 0.5) * cellW + vp.offsetX;
          const cy = (charge.y + 0.5) * cellH + vp.offsetY;
          if (cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) {
            ids.add(charge.id);
          }
        }

        if (e.shiftKey) {
          // Shift+marquee: add to existing selection
          const merged = new Set(selectedIds);
          for (const id of ids) merged.add(id);
          setSelectedIds(merged);
        } else {
          setSelectedIds(ids);
        }

        // Clear marquee from overlay
        renderLoopRef.current?.invalidate();
        break;
      }

      case 'move': {
        // F1.3: Commit the move — fork the run with new positions
        const { gx, gy } = getGridCoords(px, py);
        const dx = gx - interaction.startGx;
        const dy = gy - interaction.startGy;

        if (dx !== 0 || dy !== 0) {
          const run = getActiveRun();
          if (run) {
            const newCharges = run.config.charges.map((c) => {
              const orig = interaction.origPositions.get(c.id);
              if (!orig) return c;
              return {
                ...c,
                x: Math.max(0, Math.min(run.config.grid.width - 1, orig.x + dx)),
                y: Math.max(0, Math.min(run.config.grid.height - 1, orig.y + dy)),
              };
            });
            forkRun(run.id, { charges: newCharges });
            firePreviewSolve();
          }
        }
        break;
      }
    }

    interactionRef.current = { type: 'none' };
  }, [selectedIds, getActiveRun, forkRun, setSelectedIds, getGridCoords, firePreviewSolve]);

  return (
    <div ref={containerRef} className="field-canvas-container">
      <canvas ref={webglCanvasRef} className="field-canvas webgl-layer" />
      <canvas
        ref={overlayCanvasRef}
        className="field-canvas overlay-layer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />
    </div>
  );
}

/** Draw a marquee selection rectangle on the overlay canvas */
function drawMarquee(
  canvas: HTMLCanvasElement,
  x1: number, y1: number,
  x2: number, y2: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // Don't clear — the render loop handles that. Just draw on top.
  // Use a thin dashed rectangle
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(79, 195, 247, 0.7)';
  ctx.fillStyle = 'rgba(79, 195, 247, 0.08)';
  ctx.lineWidth = 1;
  const rx = Math.min(x1, x2);
  const ry = Math.min(y1, y2);
  const rw = Math.abs(x2 - x1);
  const rh = Math.abs(y2 - y1);
  ctx.fillRect(rx, ry, rw, rh);
  ctx.strokeRect(rx, ry, rw, rh);
  ctx.restore();
}
