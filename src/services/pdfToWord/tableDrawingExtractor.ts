/**
 * Table Drawing and Vector Line Extractor for Stage 1.5.
 * Traverses PDF.js drawing operators (constructPath, rectangle, moveTo, lineTo, stroke, fill)
 * to reconstruct genuine horizontal and vertical table grid lines and boundaries.
 */

import * as pdfjsLib from 'pdfjs-dist';
import { VectorLine } from './types';

interface Point {
  x: number;
  y: number;
}

/**
 * Extracts and merges all horizontal and vertical vector lines from a PDF page.
 */
export async function extractVectorLinesFromPage(
  page: pdfjsLib.PDFPageProxy,
  viewport: pdfjsLib.PageViewport
): Promise<{ horizontalLines: VectorLine[]; verticalLines: VectorLine[] }> {
  const rawHorizontal: VectorLine[] = [];
  const rawVertical: VectorLine[] = [];

  try {
    const operatorList = await page.getOperatorList();
    const fnArray = operatorList.fnArray;
    const argsArray = operatorList.argsArray;

    let currentMatrix = [1, 0, 0, 1, 0, 0];
    const matrixStack: number[][] = [];
    let currentLineWidth = 1;
    let currentColorHex = '000000';

    const OPS = pdfjsLib.OPS;

    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];
      const args = argsArray[i];

      if (fn === OPS.save) {
        matrixStack.push([...currentMatrix]);
      } else if (fn === OPS.restore) {
        if (matrixStack.length > 0) {
          currentMatrix = matrixStack.pop()!;
        }
      } else if (fn === OPS.transform) {
        if (Array.isArray(args)) {
          currentMatrix = multiplyMatrices(currentMatrix, args as number[]);
        }
      } else if (fn === OPS.setLineWidth) {
        if (Array.isArray(args) && typeof args[0] === 'number') {
          currentLineWidth = Math.max(0.5, args[0]);
        }
      } else if (fn === OPS.setStrokeRGBColor) {
        if (Array.isArray(args) && args.length >= 3) {
          const r = Math.round(Number(args[0]) <= 1 ? Number(args[0]) * 255 : Number(args[0]));
          const g = Math.round(Number(args[1]) <= 1 ? Number(args[1]) * 255 : Number(args[1]));
          const b = Math.round(Number(args[2]) <= 1 ? Number(args[2]) * 255 : Number(args[2]));
          currentColorHex = [r, g, b]
            .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
        }
      } else if (fn === OPS.setStrokeGray) {
        if (Array.isArray(args) && typeof args[0] === 'number') {
          const g = Math.round(args[0] <= 1 ? args[0] * 255 : args[0]);
          const hex = Math.max(0, Math.min(255, g)).toString(16).padStart(2, '0').toUpperCase();
          currentColorHex = `${hex}${hex}${hex}`;
        }
      } else if (fn === OPS.constructPath) {
        // Modern PDF.js vector drawing path operator
        // args: [op, data, minMax]
        const drawData = args?.[1] || args?.[0];
        const commands = Array.isArray(drawData) ? (Array.isArray(drawData[0]) ? drawData[0] : drawData) : null;

        if (commands && commands.length > 0) {
          parseDrawOps(
            commands,
            currentMatrix,
            viewport,
            currentLineWidth,
            currentColorHex,
            rawHorizontal,
            rawVertical
          );
        }
      } else if (fn === OPS.rectangle) {
        // args: [x, y, w, h]
        if (Array.isArray(args) && args.length >= 4) {
          parseRectangleOp(
            args[0],
            args[1],
            args[2],
            args[3],
            currentMatrix,
            viewport,
            currentLineWidth,
            currentColorHex,
            rawHorizontal,
            rawVertical
          );
        }
      }
    }
  } catch (err) {
    // Non-fatal: if vector line extraction encounters an issue, fallback to text-geometry
    // eslint-disable-next-line no-console
    console.warn('Vector line extraction warning:', err);
  }

  // Merge colinear lines and eliminate tiny fragments (< 12 pt)
  const mergedHorizontal = mergeColinearLines(rawHorizontal, false);
  const mergedVertical = mergeColinearLines(rawVertical, true);

  return {
    horizontalLines: mergedHorizontal,
    verticalLines: mergedVertical,
  };
}

/**
 * Parses DrawOPS commands (moveTo, lineTo, curveTo, closePath) into horizontal and vertical segments.
 */
function parseDrawOps(
  data: number[],
  currentMatrix: number[],
  viewport: pdfjsLib.PageViewport,
  lineWidth: number,
  colorHex: string,
  outHorizontal: VectorLine[],
  outVertical: VectorLine[]
) {
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;

  let i = 0;
  while (i < data.length) {
    const op = data[i++];
    if (op === 0) {
      // DrawOPS.moveTo
      curX = data[i++];
      curY = data[i++];
      startX = curX;
      startY = curY;
    } else if (op === 1) {
      // DrawOPS.lineTo
      const nextX = data[i++];
      const nextY = data[i++];

      processSegment(
        curX,
        curY,
        nextX,
        nextY,
        currentMatrix,
        viewport,
        lineWidth,
        colorHex,
        outHorizontal,
        outVertical
      );

      curX = nextX;
      curY = nextY;
    } else if (op === 2) {
      // DrawOPS.curveTo (skip 6 coords)
      i += 4;
      curX = data[i++];
      curY = data[i++];
    } else if (op === 3) {
      // DrawOPS.quadraticCurveTo (skip 4 coords)
      i += 2;
      curX = data[i++];
      curY = data[i++];
    } else if (op === 4) {
      // DrawOPS.closePath
      processSegment(
        curX,
        curY,
        startX,
        startY,
        currentMatrix,
        viewport,
        lineWidth,
        colorHex,
        outHorizontal,
        outVertical
      );
      curX = startX;
      curY = startY;
    }
  }
}

/**
 * Parses a rectangle operator into horizontal and vertical segments.
 */
function parseRectangleOp(
  x: number,
  y: number,
  w: number,
  h: number,
  currentMatrix: number[],
  viewport: pdfjsLib.PageViewport,
  lineWidth: number,
  colorHex: string,
  outHorizontal: VectorLine[],
  outVertical: VectorLine[]
) {
  const p1 = transformPoint(x, y, currentMatrix, viewport);
  const p2 = transformPoint(x + w, y + h, currentMatrix, viewport);

  const xMin = Math.min(p1.x, p2.x);
  const xMax = Math.max(p1.x, p2.x);
  const yMin = Math.min(p1.y, p2.y);
  const yMax = Math.max(p1.y, p2.y);

  const width = xMax - xMin;
  const height = yMax - yMin;

  // Thin filled line check
  if (width >= 15 && height <= 3.5) {
    outHorizontal.push({
      isVertical: false,
      coord: (yMin + yMax) / 2,
      start: xMin,
      end: xMax,
      strokeWidth: height || lineWidth,
      colorHex,
    });
    return;
  }

  if (height >= 15 && width <= 3.5) {
    outVertical.push({
      isVertical: true,
      coord: (xMin + xMax) / 2,
      start: yMin,
      end: yMax,
      strokeWidth: width || lineWidth,
      colorHex,
    });
    return;
  }

  // Standard box with 4 sides
  if (width >= 15 && height >= 15) {
    // Top & Bottom
    outHorizontal.push({ isVertical: false, coord: yMin, start: xMin, end: xMax, strokeWidth: lineWidth, colorHex });
    outHorizontal.push({ isVertical: false, coord: yMax, start: xMin, end: xMax, strokeWidth: lineWidth, colorHex });
    // Left & Right
    outVertical.push({ isVertical: true, coord: xMin, start: yMin, end: yMax, strokeWidth: lineWidth, colorHex });
    outVertical.push({ isVertical: true, coord: xMax, start: yMin, end: yMax, strokeWidth: lineWidth, colorHex });
  }
}

/**
 * Transforms a point through the graphics matrix and viewport transformation.
 */
function transformPoint(
  x: number,
  y: number,
  matrix: number[],
  viewport: pdfjsLib.PageViewport
): Point {
  const ux = matrix[0] * x + matrix[2] * y + matrix[4];
  const uy = matrix[1] * x + matrix[3] * y + matrix[5];

  const [vx, vy] = viewport.convertToViewportPoint(ux, uy);
  return { x: vx, y: vy };
}

/**
 * Evaluates a segment and adds to horizontal or vertical lists if it aligns with an axis.
 */
function processSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  matrix: number[],
  viewport: pdfjsLib.PageViewport,
  lineWidth: number,
  colorHex: string,
  outHorizontal: VectorLine[],
  outVertical: VectorLine[]
) {
  const p1 = transformPoint(x1, y1, matrix, viewport);
  const p2 = transformPoint(x2, y2, matrix, viewport);

  const dx = Math.abs(p1.x - p2.x);
  const dy = Math.abs(p1.y - p2.y);

  // Horizontal segment (dy <= 2.5 pt)
  if (dy <= 2.5 && dx >= 12) {
    outHorizontal.push({
      isVertical: false,
      coord: (p1.y + p2.y) / 2,
      start: Math.min(p1.x, p2.x),
      end: Math.max(p1.x, p2.x),
      strokeWidth: lineWidth,
      colorHex,
    });
  }
  // Vertical segment (dx <= 2.5 pt)
  else if (dx <= 2.5 && dy >= 12) {
    outVertical.push({
      isVertical: true,
      coord: (p1.x + p2.x) / 2,
      start: Math.min(p1.y, p2.y),
      end: Math.max(p1.y, p2.y),
      strokeWidth: lineWidth,
      colorHex,
    });
  }
}

/**
 * Merges colinear overlapping or abutting line segments.
 */
function mergeColinearLines(lines: VectorLine[], isVertical: boolean): VectorLine[] {
  if (lines.length <= 1) return lines;

  // Sort by coord, then by start
  const sorted = [...lines].sort((a, b) => {
    if (Math.abs(a.coord - b.coord) <= 2) {
      return a.start - b.start;
    }
    return a.coord - b.coord;
  });

  const merged: VectorLine[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // Same coordinate line within 2.5 pt tolerance
    if (Math.abs(current.coord - next.coord) <= 2.5) {
      // Check if segments overlap or have small gap <= 5 pt
      if (next.start <= current.end + 5) {
        current.end = Math.max(current.end, next.end);
        current.strokeWidth = Math.max(current.strokeWidth, next.strokeWidth);
        continue;
      }
    }

    if (current.end - current.start >= 12) {
      merged.push(current);
    }
    current = { ...next };
  }

  if (current.end - current.start >= 12) {
    merged.push(current);
  }

  return merged;
}

function multiplyMatrices(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}
