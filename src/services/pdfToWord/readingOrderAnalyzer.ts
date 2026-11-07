/**
 * Reading Order and Column Layout Analyzer.
 * Reconstructs the natural human reading sequence across multi-column, single-column,
 * and mixed-layout PDF pages.
 */

import { PDFCharItem } from './types';

export interface TextLine {
  y: number; // Top-down coordinate
  items: PDFCharItem[];
  xMin: number;
  xMax: number;
  avgFontSize: number;
  lineHeight: number;
}

export interface ColumnGroup {
  columnIndex: number;
  xStart: number;
  xEnd: number;
  lines: TextLine[];
}

export interface StructuredPageLayout {
  isMultiColumn: boolean;
  columnCount: number;
  spanningHeaderLines: TextLine[];
  columns: ColumnGroup[];
  spanningFooterLines: TextLine[];
  orderedLines: TextLine[];
}

/**
 * Normalizes and groups text items into lines based on baseline tolerances.
 */
export function groupItemsIntoLines(
  rawItems: PDFCharItem[],
  pageHeightPt?: number
): TextLine[] {
  if (rawItems.length === 0) return [];

  // Sort initially by top-down y, then by left-to-right x
  const sorted = [...rawItems].sort((a, b) => {
    if (Math.abs(a.y - b.y) <= 3) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  const lines: TextLine[] = [];

  for (const item of sorted) {
    const baselineTolerance = Math.max(3.5, item.fontSize * 0.35);
    const existing = lines.find((l) => Math.abs(l.y - item.y) <= baselineTolerance);

    if (existing) {
      existing.items.push(item);
      existing.xMin = Math.min(existing.xMin, item.x);
      existing.xMax = Math.max(existing.xMax, item.x + item.width);
      existing.avgFontSize =
        existing.items.reduce((s, it) => s + it.fontSize, 0) / existing.items.length;
      existing.lineHeight = Math.max(existing.lineHeight, item.height || item.fontSize * 1.2);
    } else {
      lines.push({
        y: item.y,
        items: [item],
        xMin: item.x,
        xMax: item.x + item.width,
        avgFontSize: item.fontSize,
        lineHeight: item.height || item.fontSize * 1.2,
      });
    }
  }

  // Sort lines top to bottom
  lines.sort((a, b) => a.y - b.y);

  // Sort items within each line left to right
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
  }

  return lines;
}

/**
 * Analyzes items and detects multi-column reading order vs single-column flow.
 */
export function analyzeReadingOrder(
  itemsOrLines: PDFCharItem[] | TextLine[],
  pageWidthPt: number,
  pageHeightPt: number
): StructuredPageLayout {
  if (itemsOrLines.length === 0) {
    return {
      isMultiColumn: false,
      columnCount: 1,
      spanningHeaderLines: [],
      columns: [],
      spanningFooterLines: [],
      orderedLines: [],
    };
  }

  // If input is TextLine[], extract raw items
  let rawItems: PDFCharItem[] = [];
  if ('items' in itemsOrLines[0]) {
    for (const l of itemsOrLines as TextLine[]) {
      rawItems.push(...l.items);
    }
  } else {
    rawItems = itemsOrLines as PDFCharItem[];
  }

  const colMid = pageWidthPt / 2;
  const topThreshold = pageHeightPt * 0.15;
  const bottomThreshold = pageHeightPt * 0.88;

  // 1. Identify Spanning items (headings, titles spanning across center)
  const spanningHeaderItems: PDFCharItem[] = [];
  const spanningFooterItems: PDFCharItem[] = [];
  const bodyItems: PDFCharItem[] = [];

  for (const item of rawItems) {
    const isHeaderZone = item.y <= topThreshold;
    const isFooterZone = item.y >= bottomThreshold;
    const isWideSpan = item.width > pageWidthPt * 0.55 || (item.x < colMid - 20 && item.x + item.width > colMid + 20);

    if (isWideSpan && isHeaderZone) {
      spanningHeaderItems.push(item);
    } else if (isWideSpan && isFooterZone) {
      spanningFooterItems.push(item);
    } else {
      bodyItems.push(item);
    }
  }

  // 2. Check 2-column layout: items on left (x + width < colMid - 6) vs items on right (x > colMid + 6)
  const col1Items = bodyItems.filter((it) => it.x + it.width < colMid - 6);
  const col2Items = bodyItems.filter((it) => it.x > colMid + 6);

  const isTwoColumn =
    bodyItems.length >= 8 &&
    col1Items.length >= bodyItems.length * 0.28 &&
    col2Items.length >= bodyItems.length * 0.28;

  // 3. Check 3-column layout
  const oneThird = pageWidthPt * 0.33;
  const twoThirds = pageWidthPt * 0.66;
  const col3_1 = bodyItems.filter((it) => it.x + it.width < oneThird - 4);
  const col3_2 = bodyItems.filter((it) => it.x > oneThird + 4 && it.x + it.width < twoThirds - 4);
  const col3_3 = bodyItems.filter((it) => it.x > twoThirds + 4);

  const isThreeColumn =
    !isTwoColumn &&
    bodyItems.length >= 15 &&
    col3_1.length >= bodyItems.length * 0.2 &&
    col3_2.length >= bodyItems.length * 0.2 &&
    col3_3.length >= bodyItems.length * 0.2;

  const headerLines = groupItemsIntoLines(spanningHeaderItems);
  const footerLines = groupItemsIntoLines(spanningFooterItems);

  if (isTwoColumn) {
    const col1Lines = groupItemsIntoLines(col1Items);
    const col2Lines = groupItemsIntoLines(col2Items);
    const remainingItems = bodyItems.filter(
      (it) => !col1Items.includes(it) && !col2Items.includes(it)
    );
    const remainingLines = groupItemsIntoLines(remainingItems);

    const orderedLines: TextLine[] = [
      ...headerLines,
      ...remainingLines.filter((l) => l.y < Math.min(col1Lines[0]?.y ?? 9999, col2Lines[0]?.y ?? 9999)),
      ...col1Lines,
      ...col2Lines,
      ...remainingLines.filter((l) => l.y >= Math.max(col1Lines[col1Lines.length - 1]?.y ?? 0, col2Lines[col2Lines.length - 1]?.y ?? 0)),
      ...footerLines,
    ];

    return {
      isMultiColumn: true,
      columnCount: 2,
      spanningHeaderLines: headerLines,
      columns: [
        { columnIndex: 0, xStart: 0, xEnd: colMid, lines: col1Lines },
        { columnIndex: 1, xStart: colMid, xEnd: pageWidthPt, lines: col2Lines },
      ],
      spanningFooterLines: footerLines,
      orderedLines,
    };
  }

  if (isThreeColumn) {
    const col1Lines = groupItemsIntoLines(col3_1);
    const col2Lines = groupItemsIntoLines(col3_2);
    const col3Lines = groupItemsIntoLines(col3_3);

    const orderedLines: TextLine[] = [
      ...headerLines,
      ...col1Lines,
      ...col2Lines,
      ...col3Lines,
      ...footerLines,
    ];

    return {
      isMultiColumn: true,
      columnCount: 3,
      spanningHeaderLines: headerLines,
      columns: [
        { columnIndex: 0, xStart: 0, xEnd: oneThird, lines: col1Lines },
        { columnIndex: 1, xStart: oneThird, xEnd: twoThirds, lines: col2Lines },
        { columnIndex: 2, xStart: twoThirds, xEnd: pageWidthPt, lines: col3Lines },
      ],
      spanningFooterLines: footerLines,
      orderedLines,
    };
  }

  // Standard single column
  const allLines = groupItemsIntoLines(rawItems);
  return {
    isMultiColumn: false,
    columnCount: 1,
    spanningHeaderLines: headerLines,
    columns: [{ columnIndex: 0, xStart: 0, xEnd: pageWidthPt, lines: allLines }],
    spanningFooterLines: footerLines,
    orderedLines: allLines,
  };
}
