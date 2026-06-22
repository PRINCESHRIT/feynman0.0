/**
 * Marching squares contour extraction.
 * Returns line segments for each contour level.
 */

export interface ContourSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ContourLevel {
  value: number;
  segments: ContourSegment[];
}

/**
 * Extract contour lines from a scalar field using marching squares.
 * @param data - scalar field values (row-major)
 * @param width - grid width
 * @param height - grid height
 * @param levels - array of contour level values
 */
export function extractContours(
  data: Float32Array,
  width: number,
  height: number,
  levels: number[],
): ContourLevel[] {
  return levels.map((value) => ({
    value,
    segments: marchingSquares(data, width, height, value),
  }));
}

/**
 * Auto-generate contour levels from data range.
 */
export function autoContourLevels(data: Float32Array, count: number = 15): number[] {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }

  // Symmetric range for diverging data
  const absMax = Math.max(Math.abs(min), Math.abs(max), 1e-10);
  const levels: number[] = [];
  for (let i = 1; i < count; i++) {
    const t = i / count;
    levels.push(-absMax + 2 * absMax * t);
  }
  return levels;
}

function marchingSquares(
  data: Float32Array,
  width: number,
  height: number,
  level: number,
): ContourSegment[] {
  const segments: ContourSegment[] = [];

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const tl = data[y * width + x];
      const tr = data[y * width + x + 1];
      const br = data[(y + 1) * width + x + 1];
      const bl = data[(y + 1) * width + x];

      // Build case index (4-bit): TL=8, TR=4, BR=2, BL=1
      let caseIdx = 0;
      if (tl >= level) caseIdx |= 8;
      if (tr >= level) caseIdx |= 4;
      if (br >= level) caseIdx |= 2;
      if (bl >= level) caseIdx |= 1;

      if (caseIdx === 0 || caseIdx === 15) continue;

      // Interpolation helpers
      const lerpX = (v1: number, v2: number) => {
        const d = v2 - v1;
        return Math.abs(d) < 1e-12 ? 0.5 : (level - v1) / d;
      };

      // Edge midpoints with linear interpolation
      const top = lerpX(tl, tr);    // top edge
      const right = lerpX(tr, br);  // right edge
      const bottom = lerpX(bl, br); // bottom edge
      const left = lerpX(tl, bl);   // left edge

      // Point positions (in grid coordinates)
      const pTop = { x: x + top, y };
      const pRight = { x: x + 1, y: y + right };
      const pBottom = { x: x + bottom, y: y + 1 };
      const pLeft = { x, y: y + left };

      // 16-case lookup
      const addSeg = (p1: {x:number,y:number}, p2: {x:number,y:number}) => {
        segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      };

      switch (caseIdx) {
        case 1: addSeg(pLeft, pBottom); break;
        case 2: addSeg(pBottom, pRight); break;
        case 3: addSeg(pLeft, pRight); break;
        case 4: addSeg(pTop, pRight); break;
        case 5: addSeg(pLeft, pTop); addSeg(pBottom, pRight); break;
        case 6: addSeg(pTop, pBottom); break;
        case 7: addSeg(pLeft, pTop); break;
        case 8: addSeg(pTop, pLeft); break;
        case 9: addSeg(pTop, pBottom); break;
        case 10: addSeg(pTop, pRight); addSeg(pLeft, pBottom); break;
        case 11: addSeg(pTop, pRight); break;
        case 12: addSeg(pLeft, pRight); break;
        case 13: addSeg(pBottom, pRight); break;
        case 14: addSeg(pLeft, pBottom); break;
      }
    }
  }

  return segments;
}
