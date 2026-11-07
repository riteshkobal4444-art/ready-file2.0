/**
 * Font and Typography Analyzer for PDF-to-Word Engine.
 * Analyzes font family, size, weight, styles, alignment, and maps them to clean Word typography.
 */

import { ReconstructedRun, PDFCharItem } from './types';

/**
 * Standard Word font fallbacks mapped from common PDF font families.
 */
const FONT_MAP: Array<{ match: RegExp; font: string }> = [
  { match: /times|roman|cambria|minion|baskerville/i, font: 'Times New Roman' },
  { match: /georgia/i, font: 'Georgia' },
  { match: /garamond/i, font: 'Garamond' },
  { match: /courier|monospace|consola|menlo|sourcecodepro/i, font: 'Courier New' },
  { match: /verdana/i, font: 'Verdana' },
  { match: /trebuchet/i, font: 'Trebuchet MS' },
  { match: /tahoma/i, font: 'Tahoma' },
  { match: /arial|helvetica|liberation|dejavusans/i, font: 'Arial' },
  { match: /calibri|segoe|roboto|opensans|lato/i, font: 'Calibri' },
];

/**
 * Maps a PDF font name to a reliable Microsoft Word font.
 */
export function mapToWordFont(pdfFontName: string): string {
  if (!pdfFontName) return 'Calibri';
  for (const entry of FONT_MAP) {
    if (entry.match.test(pdfFontName)) {
      return entry.font;
    }
  }
  return 'Calibri';
}

/**
 * Detects if a font name or weight indicator represents bold text.
 */
export function isBoldFont(fontName: string): boolean {
  if (!fontName) return false;
  const f = fontName.toLowerCase();
  return (
    f.includes('bold') ||
    f.includes('black') ||
    f.includes('heavy') ||
    f.includes('semibold') ||
    f.includes('demi') ||
    f.includes('medium') ||
    f.includes('w7') ||
    f.includes('w8') ||
    f.includes('w9')
  );
}

/**
 * Detects if a font name represents italic or oblique text.
 */
export function isItalicFont(fontName: string): boolean {
  if (!fontName) return false;
  const f = fontName.toLowerCase();
  return f.includes('italic') || f.includes('oblique') || f.includes('slanted');
}

/**
 * Detects if a text run represents a superscript or subscript based on
 * relative font size decrease and baseline elevation.
 */
export function checkScriptAdjustment(
  currItem: PDFCharItem,
  prevItem: PDFCharItem | null,
  baselineFontSize: number
): { subScript?: boolean; superScript?: boolean } {
  if (!prevItem || baselineFontSize <= 0) return {};

  const sizeRatio = currItem.fontSize / baselineFontSize;
  // Subscript/superscript is usually 50% - 75% of base font size
  if (sizeRatio > 0.85 || sizeRatio < 0.4) return {};

  const yDiff = currItem.y - prevItem.y; // Top-down y: positive means lower down (subscript), negative means higher up (superscript)

  if (yDiff < -1.5 && yDiff > -currItem.fontSize * 1.5) {
    return { superScript: true };
  } else if (yDiff > 1.5 && yDiff < currItem.fontSize * 1.5) {
    return { subScript: true };
  }

  return {};
}

/**
 * Formats color into a 6-character hex string without '#' for Word DOCX
 */
export function sanitizeColorHex(color?: string): string | undefined {
  if (!color) return undefined;
  const clean = color.replace(/^#/, '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    // Ignore pure black or default text color to keep documents standard
    if (clean.toLowerCase() === '000000') return undefined;
    return clean.toUpperCase();
  }
  return undefined;
}

/**
 * Groups raw character/text items of a line into unified text runs with consistent formatting.
 */
export function clusterLineIntoRuns(
  items: PDFCharItem[],
  baselineFontSize: number
): ReconstructedRun[] {
  if (items.length === 0) return [];

  const rawRuns: ReconstructedRun[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const prev = i > 0 ? items[i - 1] : null;

    let text = item.str;
    if (i > 0 && prev) {
      const charGap = item.x - (prev.x + prev.width);
      if (charGap > item.fontSize * 0.22 && !prev.str.endsWith(' ') && !text.startsWith(' ')) {
        text = ' ' + text;
      }
    }

    const scriptInfo = checkScriptAdjustment(item, prev, baselineFontSize);
    const font = mapToWordFont(item.fontName);
    const bold = isBoldFont(item.fontName);
    const italic = isItalicFont(item.fontName);
    const color = sanitizeColorHex(item.colorHex);

    rawRuns.push({
      text,
      font,
      size: item.fontSize,
      bold,
      italic,
      underline: false,
      color,
      subScript: scriptInfo.subScript,
      superScript: scriptInfo.superScript,
    });
  }

  return mergeSimilarRuns(rawRuns);
}

/**
 * Merges adjacent text runs that share identical formatting to avoid fragmented Word XML.
 */
export function mergeSimilarRuns(runs: ReconstructedRun[]): ReconstructedRun[] {
  if (runs.length <= 1) return runs;

  const merged: ReconstructedRun[] = [];
  let current: ReconstructedRun = { ...runs[0] };

  for (let i = 1; i < runs.length; i++) {
    const next = runs[i];
    const canMerge =
      Math.abs(current.size - next.size) < 0.5 &&
      current.bold === next.bold &&
      current.italic === next.italic &&
      current.font === next.font &&
      current.underline === next.underline &&
      current.color === next.color &&
      current.subScript === next.subScript &&
      current.superScript === next.superScript;

    if (canMerge) {
      current.text += next.text;
    } else {
      if (current.text.length > 0) {
        merged.push(current);
      }
      current = { ...next };
    }
  }

  if (current.text.length > 0) {
    merged.push(current);
  }

  return merged;
}
