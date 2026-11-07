/**
 * Text-to-Cell Mapping Engine for Stage 1.5.
 * Maps extracted PDF character tokens and lines into their exact geometric table cells.
 * Preserves multi-line product descriptions, numeric alignment, and removes assigned
 * text from the body stream to eliminate duplicate/separated paragraphs.
 */

import { PDFCharItem, ReconstructedTable, ReconstructedParagraph, ReconstructedRun, TextAlignment } from './types';
import { clusterLineIntoRuns } from './fontAnalyzer';
import { groupItemsIntoLines } from './readingOrderAnalyzer';

export interface MappingResult {
  reconstructedTables: ReconstructedTable[];
  remainingBodyItems: PDFCharItem[];
  textBlocksAssigned: number;
  uncertainAssignments: number;
}

const NUMERIC_REGEX = /^[\$€£¥₹]?\s*[\d,]+(\.\d+)?%?$/;
const DATE_REGEX = /^\d{1,4}[/\-\.]\d{1,2}[/\-\.]\d{1,4}$/;

/**
 * Maps raw text items into table cells based on geometric coordinates.
 */
export function mapTextItemsToTableCells(
  tables: ReconstructedTable[],
  textItems: PDFCharItem[],
  medianFontSize: number
): MappingResult {
  if (tables.length === 0 || textItems.length === 0) {
    return {
      reconstructedTables: tables,
      remainingBodyItems: textItems,
      textBlocksAssigned: 0,
      uncertainAssignments: 0,
    };
  }

  const assignedItemIndices = new Set<number>();
  let textBlocksAssigned = 0;
  let uncertainAssignments = 0;

  // Clone tables to avoid mutating inputs
  const populatedTables: ReconstructedTable[] = tables.map((tbl) => ({
    ...tbl,
    rows: tbl.rows.map((row) =>
      row.map((cell) => ({
        ...cell,
        runs: [...cell.runs],
        paragraphs: cell.paragraphs ? [...cell.paragraphs] : [],
      }))
    ),
  }));

  for (const tbl of populatedTables) {
    const tblBox = tbl.boundingBox;

    // Fast check: find items within the table's overall bounding box
    for (let itIdx = 0; itIdx < textItems.length; itIdx++) {
      if (assignedItemIndices.has(itIdx)) continue;

      const it = textItems[itIdx];
      const itMidX = it.x + it.width / 2;
      const itMidY = it.y + it.height / 2;

      // Check if point is inside table bounding box (with 2 pt tolerance)
      if (
        itMidX >= tblBox.x - 2 &&
        itMidX <= tblBox.x + tblBox.width + 2 &&
        itMidY >= tblBox.y - 2 &&
        itMidY <= tblBox.y + tblBox.height + 2
      ) {
        // Find specific cell containing this item
        let bestCell = null;
        let bestDistance = 9999;
        let isAmbiguous = false;

        for (let r = 0; r < tbl.rows.length; r++) {
          const row = tbl.rows[r];
          for (let c = 0; c < row.length; c++) {
            const cell = row[c];
            if (cell.isMergedPlaceholder || !cell.boundingBox) continue;

            const cBox = cell.boundingBox;
            const inX = itMidX >= cBox.x - 1.5 && itMidX <= cBox.x + cBox.width + 1.5;
            const inY = itMidY >= cBox.y - 1.5 && itMidY <= cBox.y + cBox.height + 1.5;

            if (inX && inY) {
              bestCell = cell;
              isAmbiguous = false;
              break;
            } else {
              // Edge-case distance check for boundary items
              const dist = Math.hypot(
                Math.max(0, cBox.x - itMidX, itMidX - (cBox.x + cBox.width)),
                Math.max(0, cBox.y - itMidY, itMidY - (cBox.y + cBox.height))
              );
              if (dist < 4 && dist < bestDistance) {
                bestDistance = dist;
                bestCell = cell;
                isAmbiguous = true;
              }
            }
          }
          if (bestCell && !isAmbiguous) break;
        }

        if (bestCell) {
          if (!bestCell.runs) bestCell.runs = [];
          // Store raw item in cell for line clustering
          (bestCell as any)._rawItems = (bestCell as any)._rawItems || [];
          (bestCell as any)._rawItems.push(it);

          assignedItemIndices.add(itIdx);
          textBlocksAssigned++;
          if (isAmbiguous) uncertainAssignments++;
        }
      }
    }

    // Now format each cell's assigned items into proper multi-line paragraphs
    for (let r = 0; r < tbl.rows.length; r++) {
      const row = tbl.rows[r];
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        const rawItems: PDFCharItem[] = (cell as any)._rawItems || [];

        if (rawItems.length > 0) {
          // Group cell items into lines
          const cellLines = groupItemsIntoLines(rawItems);
          const cellParagraphs: ReconstructedParagraph[] = [];
          const allCellRuns: ReconstructedRun[] = [];

          for (const line of cellLines) {
            const lineRuns = clusterLineIntoRuns(line.items, medianFontSize);
            allCellRuns.push(...lineRuns);

            cellParagraphs.push({
              type: 'paragraph',
              runs: lineRuns,
              alignment: cell.alignment || 'left',
              spacingBefore: 20,
              spacingAfter: 20,
              lineSpacing: 240,
              originalY: line.y,
            });
          }

          cell.runs = allCellRuns;
          cell.paragraphs = cellParagraphs;
          cell.text = allCellRuns.map((r) => r.text).join(' ').trim();

          // Classify cell alignment
          const cleanText = cell.text.replace(/[\s\r\n]+/g, ' ').trim();
          if (NUMERIC_REGEX.test(cleanText)) {
            cell.alignment = 'right';
            for (const p of cell.paragraphs) p.alignment = 'right';
          } else if (DATE_REGEX.test(cleanText) || cleanText.length <= 4) {
            cell.alignment = 'center';
            for (const p of cell.paragraphs) p.alignment = 'center';
          } else {
            cell.alignment = 'left';
            for (const p of cell.paragraphs) p.alignment = 'left';
          }
        }
      }
    }
  }

  // Filter out all items that were assigned to tables
  const remainingBodyItems = textItems.filter((_, idx) => !assignedItemIndices.has(idx));

  return {
    reconstructedTables: populatedTables,
    remainingBodyItems,
    textBlocksAssigned,
    uncertainAssignments,
  };
}
