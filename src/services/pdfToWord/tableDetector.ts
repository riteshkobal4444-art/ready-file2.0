/**
 * Advanced Table Detection and Grid Reconstruction Engine for Stage 1.5.
 * Combines vector drawing geometry (horizontal/vertical lines, rectangles, paths)
 * with text layout geometry to reconstruct genuine table borders, column widths,
 * row heights, and merged cells.
 */

import {
  VectorLine,
  PDFCharItem,
  ReconstructedTable,
  ReconstructedCell,
  BoundingBox,
} from './types';

interface DetectedGrid {
  boundingBox: BoundingBox;
  xBoundaries: number[];
  yBoundaries: number[];
  horizontalLines: VectorLine[];
  verticalLines: VectorLine[];
}

/**
 * Detects tables on a page by combining vector drawing lines and text alignment geometry.
 */
export function detectTablesOnPage(
  horizontalLines: VectorLine[],
  verticalLines: VectorLine[],
  textItems: PDFCharItem[],
  pageWidthPt: number,
  pageHeightPt: number
): ReconstructedTable[] {
  const tables: ReconstructedTable[] = [];

  // 1. Vector-based Table Detection (Primary & High Fidelity)
  if (horizontalLines.length >= 2 && verticalLines.length >= 2) {
    const grids = findTableGridsFromVectors(horizontalLines, verticalLines);

    for (const grid of grids) {
      const tbl = constructTableFromGrid(grid, pageWidthPt);
      if (tbl) {
        tables.push(tbl);
      }
    }
  }

  // 2. Text-heuristic fallback if no vector tables were detected on page
  if (tables.length === 0 && textItems.length >= 6) {
    const textFallbackTable = detectTableFromTextHeuristics(textItems, pageWidthPt);
    if (textFallbackTable) {
      tables.push(textFallbackTable);
    }
  }

  return tables;
}

/**
 * Groups intersecting and abutting vector lines into discrete table grid bounding boxes.
 */
function findTableGridsFromVectors(
  hLines: VectorLine[],
  vLines: VectorLine[]
): DetectedGrid[] {
  const grids: DetectedGrid[] = [];

  // Filter out tiny lines
  const validHLines = hLines.filter((l) => l.end - l.start >= 20);
  const validVLines = vLines.filter((l) => l.end - l.start >= 20);

  if (validHLines.length < 2 || validVLines.length < 2) return [];

  // Find clusters of intersecting lines
  const usedHLines = new Set<number>();
  const usedVLines = new Set<number>();

  for (let h = 0; h < validHLines.length; h++) {
    if (usedHLines.has(h)) continue;

    const currentHLines: VectorLine[] = [validHLines[h]];
    const currentVLines: VectorLine[] = [];
    usedHLines.add(h);

    let expanded = true;
    while (expanded) {
      expanded = false;

      // Find all vertical lines that intersect any currently collected horizontal line
      for (let v = 0; v < validVLines.length; v++) {
        if (usedVLines.has(v)) continue;
        const vLine = validVLines[v];

        const intersects = currentHLines.some(
          (hLine) =>
            vLine.coord >= hLine.start - 4 &&
            vLine.coord <= hLine.end + 4 &&
            hLine.coord >= vLine.start - 4 &&
            hLine.coord <= vLine.end + 4
        );

        if (intersects) {
          currentVLines.push(vLine);
          usedVLines.add(v);
          expanded = true;
        }
      }

      // Find all horizontal lines that intersect any currently collected vertical line
      for (let h2 = 0; h2 < validHLines.length; h2++) {
        if (usedHLines.has(h2)) continue;
        const hLine = validHLines[h2];

        const intersects = currentVLines.some(
          (vLine) =>
            vLine.coord >= hLine.start - 4 &&
            vLine.coord <= hLine.end + 4 &&
            hLine.coord >= vLine.start - 4 &&
            hLine.coord <= vLine.end + 4
        );

        if (intersects) {
          currentHLines.push(hLine);
          usedHLines.add(h2);
          expanded = true;
        }
      }
    }

    // A valid table grid must have at least 2 horizontal boundaries and 2 vertical boundaries
    if (currentHLines.length >= 2 && currentVLines.length >= 2) {
      const xCoords = Array.from(new Set(currentVLines.map((v) => Math.round(v.coord)))).sort((a, b) => a - b);
      const yCoords = Array.from(new Set(currentHLines.map((h) => Math.round(h.coord)))).sort((a, b) => a - b);

      // Clean close coordinates (within 3 pt)
      const cleanX = deduplicateCoordinates(xCoords, 3);
      const cleanY = deduplicateCoordinates(yCoords, 3);

      if (cleanX.length >= 2 && cleanY.length >= 2) {
        const xMin = cleanX[0];
        const xMax = cleanX[cleanX.length - 1];
        const yMin = cleanY[0];
        const yMax = cleanY[cleanY.length - 1];

        grids.push({
          boundingBox: {
            x: xMin,
            y: yMin,
            width: xMax - xMin,
            height: yMax - yMin,
          },
          xBoundaries: cleanX,
          yBoundaries: cleanY,
          horizontalLines: currentHLines,
          verticalLines: currentVLines,
        });
      }
    }
  }

  return grids;
}

/**
 * Slices a detected grid into rows and cells, computing column widths and merged cells.
 */
function constructTableFromGrid(
  grid: DetectedGrid,
  pageWidthPt: number
): ReconstructedTable | null {
  const { xBoundaries, yBoundaries, horizontalLines, verticalLines, boundingBox } = grid;

  const rowCount = yBoundaries.length - 1;
  const colCount = xBoundaries.length - 1;

  if (rowCount < 1 || colCount < 1 || colCount > 20 || rowCount > 150) {
    return null;
  }

  // Calculate physical column widths in DXA twips (1 pt = 20 dxa)
  const columnWidthsDxa: number[] = [];
  for (let c = 0; c < colCount; c++) {
    const widthPt = xBoundaries[c + 1] - xBoundaries[c];
    columnWidthsDxa.push(Math.round(widthPt * 20));
  }

  // Border presence check:
  // Are there lines covering outer and inner boundaries?
  const hasLeftBorder = verticalLines.some((v) => Math.abs(v.coord - xBoundaries[0]) <= 3);
  const hasRightBorder = verticalLines.some((v) => Math.abs(v.coord - xBoundaries[colCount]) <= 3);
  const hasTopBorder = horizontalLines.some((h) => Math.abs(h.coord - yBoundaries[0]) <= 3);
  const hasBottomBorder = horizontalLines.some((h) => Math.abs(h.coord - yBoundaries[rowCount]) <= 3);
  const hasInsideHorizontal = horizontalLines.some(
    (h) => h.coord > yBoundaries[0] + 3 && h.coord < yBoundaries[rowCount] - 3
  );
  const hasInsideVertical = verticalLines.some(
    (v) => v.coord > xBoundaries[0] + 3 && v.coord < xBoundaries[colCount] - 3
  );

  // Border color and stroke size
  const dominantColor = verticalLines[0]?.colorHex || horizontalLines[0]?.colorHex || '000000';
  const dominantStroke = verticalLines[0]?.strokeWidth || horizontalLines[0]?.strokeWidth || 1;
  const borderSize = dominantStroke >= 1.5 ? 8 : 4; // 8 = 1pt, 4 = 0.5pt

  // Build the 2D cell grid
  const rows: ReconstructedCell[][] = [];

  for (let r = 0; r < rowCount; r++) {
    const y1 = yBoundaries[r];
    const y2 = yBoundaries[r + 1];
    const isFirstRow = r === 0;

    const rowCells: ReconstructedCell[] = [];

    for (let c = 0; c < colCount; c++) {
      const x1 = xBoundaries[c];
      const x2 = xBoundaries[c + 1];

      // Check for horizontal merged cell (colSpan):
      // If there is NO vertical line dividing column c and c+1 across this row's Y span
      let colSpan = 1;
      while (c + colSpan < colCount) {
        const dividerX = xBoundaries[c + colSpan];
        const hasDivider = verticalLines.some(
          (v) =>
            Math.abs(v.coord - dividerX) <= 3 &&
            v.start <= (y1 + y2) / 2 &&
            v.end >= (y1 + y2) / 2
        );
        if (!hasDivider) {
          colSpan++;
        } else {
          break;
        }
      }

      const cellBox: BoundingBox = {
        x: x1,
        y: y1,
        width: xBoundaries[c + colSpan] - x1,
        height: y2 - y1,
      };

      rowCells.push({
        text: '',
        runs: [],
        paragraphs: [],
        alignment: 'left',
        isHeader: isFirstRow,
        colSpan: colSpan > 1 ? colSpan : undefined,
        widthDxa: Math.round(cellBox.width * 20),
        boundingBox: cellBox,
      });

      // If merged across columns, insert placeholders for Word OpenXML
      if (colSpan > 1) {
        for (let extra = 1; extra < colSpan; extra++) {
          rowCells.push({
            text: '',
            runs: [],
            paragraphs: [],
            alignment: 'left',
            isMergedPlaceholder: true,
          });
        }
        c += colSpan - 1;
      }
    }

    rows.push(rowCells);
  }

  return {
    type: 'table',
    rows,
    columnWidthsDxa,
    hasHeaderRow: true,
    rowCount,
    columnCount: colCount,
    originalY: boundingBox.y,
    boundingBox,
    hasTopBorder,
    hasBottomBorder,
    hasLeftBorder,
    hasRightBorder,
    hasInsideHorizontal,
    hasInsideVertical,
    borderColor: dominantColor,
    borderSize,
  };
}

/**
 * Deduplicates numbers within a given spatial tolerance.
 */
function deduplicateCoordinates(coords: number[], tolerance = 3): number[] {
  if (coords.length <= 1) return coords;
  const result: number[] = [coords[0]];

  for (let i = 1; i < coords.length; i++) {
    const last = result[result.length - 1];
    if (Math.abs(coords[i] - last) > tolerance) {
      result.push(coords[i]);
    }
  }

  return result;
}

/**
 * Text-only heuristic fallback for borderless tables when no vector lines exist.
 */
function detectTableFromTextHeuristics(
  textItems: PDFCharItem[],
  pageWidthPt: number
): ReconstructedTable | null {
  // Sort items top-to-bottom, left-to-right
  const sorted = [...textItems].sort((a, b) => {
    if (Math.abs(a.y - b.y) <= 3) return a.x - b.x;
    return a.y - b.y;
  });

  // Group into lines
  const lines: Array<{ y: number; items: PDFCharItem[] }> = [];
  for (const item of sorted) {
    const existing = lines.find((l) => Math.abs(l.y - item.y) <= Math.max(3.5, item.fontSize * 0.35));
    if (existing) {
      existing.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }

  // Filter lines with multiple horizontal spaced items
  const tableLines = lines.filter((l) => {
    if (l.items.length < 2 || l.items.length > 10) return false;
    let wideGutters = 0;
    for (let i = 1; i < l.items.length; i++) {
      if (l.items[i].x - (l.items[i - 1].x + l.items[i - 1].width) >= 16) {
        wideGutters++;
      }
    }
    return wideGutters >= 1;
  });

  if (tableLines.length < 3) return null;

  // Find column coordinates
  const allX: number[] = [];
  for (const l of tableLines) {
    for (const it of l.items) allX.push(Math.round(it.x));
  }
  allX.sort((a, b) => a - b);
  const colStarts = deduplicateCoordinates(allX, 20);

  if (colStarts.length < 2 || colStarts.length > 8) return null;

  const xMin = Math.min(...tableLines.flatMap((l) => l.items.map((it) => it.x)));
  const xMax = Math.max(...tableLines.flatMap((l) => l.items.map((it) => it.x + it.width)));
  const yMin = tableLines[0].y;
  const yMax = tableLines[tableLines.length - 1].y + 14;

  const tableWidthPt = xMax - xMin;
  const colWidthDxa = Math.floor((tableWidthPt * 20) / colStarts.length);
  const columnWidthsDxa = Array.from({ length: colStarts.length }, () => colWidthDxa);

  const rows: ReconstructedCell[][] = [];
  for (let r = 0; r < tableLines.length; r++) {
    const l = tableLines[r];
    const rowCells: ReconstructedCell[] = [];

    for (let c = 0; c < colStarts.length; c++) {
      const cStart = colStarts[c];
      const cEnd = colStarts[c + 1] || xMax;
      const cellItems = l.items.filter((it) => it.x >= cStart - 8 && it.x < cEnd - 8);

      rowCells.push({
        text: cellItems.map((it) => it.str).join(' ').trim(),
        runs: [],
        alignment: 'left',
        isHeader: r === 0,
        widthDxa: colWidthDxa,
        boundingBox: {
          x: cStart,
          y: l.y - 2,
          width: cEnd - cStart,
          height: 16,
        },
      });
    }
    rows.push(rowCells);
  }

  return {
    type: 'table',
    rows,
    columnWidthsDxa,
    hasHeaderRow: true,
    rowCount: rows.length,
    columnCount: colStarts.length,
    originalY: yMin,
    boundingBox: {
      x: xMin,
      y: yMin,
      width: tableWidthPt,
      height: yMax - yMin,
    },
    hasTopBorder: true,
    hasBottomBorder: true,
    hasLeftBorder: false,
    hasRightBorder: false,
    hasInsideHorizontal: true,
    hasInsideVertical: false,
    borderColor: '000000',
    borderSize: 4,
  };
}
