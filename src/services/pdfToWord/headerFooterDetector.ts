/**
 * Header and Footer Detector.
 * Identifies repeated top running headers, bottom confidentiality notices,
 * copyright lines, and page numbers across pages, separating them from the main flow
 * to be rendered as native Word headers and footers.
 */

import { TextLine } from './readingOrderAnalyzer';

export interface PageHeaderFooterInfo {
  headerLine?: TextLine;
  footerLine?: TextLine;
  hasPageNumber: boolean;
  filteredBodyLines: TextLine[];
}

const PAGE_NUM_REGEX = /^(page\s+\d+(\s+of\s+\d+)?|\d+(\s*\/\s*\d+)?|\-\s*\d+\s*\-)$/i;

/**
 * Inspects a page's lines, isolates top headers and bottom footers, and filters body lines.
 */
export function extractHeaderFooter(
  lines: TextLine[],
  pageHeightPt: number
): PageHeaderFooterInfo {
  if (lines.length === 0) {
    return { hasPageNumber: false, filteredBodyLines: [] };
  }

  const topLimit = pageHeightPt * 0.10; // Top 10%
  const bottomLimit = pageHeightPt * 0.90; // Bottom 10%

  let headerLine: TextLine | undefined = undefined;
  let footerLine: TextLine | undefined = undefined;
  let hasPageNumber = false;

  const filteredBodyLines: TextLine[] = [];

  for (const line of lines) {
    const text = line.items.map((it) => it.str).join('').trim();

    // Check top header candidate
    if (line.y <= topLimit && !headerLine && text.length > 0 && text.length < 120) {
      headerLine = line;
      continue;
    }

    // Check bottom footer candidate
    if (line.y >= bottomLimit && !footerLine && text.length > 0) {
      if (PAGE_NUM_REGEX.test(text) || text.toLowerCase().includes('page') || text.toLowerCase().includes('copyright') || text.length < 80) {
        footerLine = line;
        if (PAGE_NUM_REGEX.test(text) || text.toLowerCase().includes('page')) {
          hasPageNumber = true;
        }
        continue;
      }
    }

    filteredBodyLines.push(line);
  }

  return {
    headerLine,
    footerLine,
    hasPageNumber,
    filteredBodyLines,
  };
}
