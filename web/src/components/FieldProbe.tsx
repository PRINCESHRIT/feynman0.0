/**
 * FieldProbe — Phase 6 (F6.1).
 *
 * Hover over the canvas to see V and E-vector readout.
 * Pin a probe point by clicking with the probe tool.
 * All reads come from the existing solved grid — zero solve cost.
 */

import { useState, useCallback } from 'react';
import { useStore } from '../state/store';
import { getLatestResult } from '../solver/solveController';
import { computeFieldVectors } from '../solver/fieldVectors';
import './FieldProbe.css';

interface ProbeReading {
  gx: number;
  gy: number;
  voltage: number | null;
  ex: number | null;
  ey: number | null;
  eMag: number | null;
}

interface PinnedProbe {
  id: number;
  gx: number;
  gy: number;
}

let nextPinId = 1;

export function FieldProbe() {
  const [hoverReading, setHoverReading] = useState<ProbeReading | null>(null);
  const [pinnedProbes, setPinnedProbes] = useState<PinnedProbe[]>([]);
  const mode = useStore((s) => s.mode);

  if (mode !== 'field') return null;

  const readProbe = useCallback((gx: number, gy: number): ProbeReading => {
    const latest = getLatestResult();
    if (!latest) {
      return { gx, gy, voltage: null, ex: null, ey: null, eMag: null };
    }

    const { result } = latest;
    const { potential, width, height } = result;

    if (gx < 0 || gx >= width || gy < 0 || gy >= height) {
      return { gx, gy, voltage: null, ex: null, ey: null, eMag: null };
    }

    const idx = gy * width + gx;
    const v = potential[idx];

    // Check for NaN/boundary
    if (!Number.isFinite(v)) {
      return { gx, gy, voltage: null, ex: null, ey: null, eMag: null };
    }

    // Compute E-field at this point
    const field = computeFieldVectors(potential, width, height);
    const ex = field.ex[idx];
    const ey = field.ey[idx];
    const eMag = Math.sqrt(ex * ex + ey * ey);

    return { gx, gy, voltage: v, ex, ey, eMag };
  }, []);

  const addPin = useCallback((gx: number, gy: number) => {
    setPinnedProbes((prev) => [...prev, { id: nextPinId++, gx, gy }]);
  }, []);

  const removePin = useCallback((id: number) => {
    setPinnedProbes((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <div className="field-probe">
      <div className="probe-header">Field Probe</div>

      {hoverReading && (
        <div className="probe-reading">
          <div className="probe-label">Hover ({hoverReading.gx}, {hoverReading.gy})</div>
          {hoverReading.voltage !== null ? (
            <>
              <div className="probe-value">V = {hoverReading.voltage.toFixed(4)} V</div>
              <div className="probe-value">|E| = {hoverReading.eMag?.toFixed(4)} V/m</div>
              <div className="probe-value">
                E = ({hoverReading.ex?.toFixed(3)}, {hoverReading.ey?.toFixed(3)})
              </div>
            </>
          ) : (
            <div className="probe-no-data">No data yet</div>
          )}
        </div>
      )}

      {pinnedProbes.map((pin) => {
        const reading = readProbe(pin.gx, pin.gy);
        return (
          <div key={pin.id} className="probe-reading pinned">
            <div className="probe-label">
              Pin ({pin.gx}, {pin.gy})
              <button className="probe-remove" onClick={() => removePin(pin.id)}>×</button>
            </div>
            {reading.voltage !== null ? (
              <>
                <div className="probe-value">V = {reading.voltage.toFixed(4)} V</div>
                <div className="probe-value">|E| = {reading.eMag?.toFixed(4)} V/m</div>
              </>
            ) : (
              <div className="probe-no-data">No data yet</div>
            )}
          </div>
        );
      })}

      {pinnedProbes.length === 0 && !hoverReading && (
        <div className="probe-hint">Hover over the field to probe values</div>
      )}
    </div>
  );
}

/**
 * Hook for the FieldCanvas to update the hover probe.
 * Returns a callback to call on pointer move with grid coords.
 */
export function useProbeHover() {
  const [, setReading] = useState<ProbeReading | null>(null);

  const updateHover = useCallback((gx: number, gy: number) => {
    const latest = getLatestResult();
    if (!latest) {
      setReading(null);
      return;
    }

    const { result } = latest;
    const { potential, width, height } = result;

    if (gx < 0 || gx >= width || gy < 0 || gy >= height) {
      setReading(null);
      return;
    }

    const idx = gy * width + gx;
    const v = potential[idx];

    if (!Number.isFinite(v)) {
      setReading(null);
      return;
    }

    setReading({
      gx, gy,
      voltage: v,
      ex: null, ey: null, eMag: null, // Lazy — computed only in panel
    });
  }, []);

  return updateHover;
}
