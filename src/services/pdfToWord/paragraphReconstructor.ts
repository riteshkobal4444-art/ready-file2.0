/**
 * Paragraph Reconstructor.
 * Analyzes line gaps, alignment, indentation, bullet points, and heading hierarchy
 * to group text lines into native, editable Word paragraphs and runs.
 */

import { TextLine } from './readingOrderAnalyzer';
import { clusterLineIntoRuns } from './fontAnalyzer';
import { ReconstructedParagraph, TextAlignment, ReconstructedRun } from './types';

const BULLET_REGEX = /^([•–—*▪▫\u2022\u25E6\u25AA]|\d+[\.\)]|[a-zA-Z][\.\)]|\(\d+\)|\([a-zA-Z]\))\s+/;

/**
 * Reconstructs lines into structured paragraphs with formatting, alignment, and headings.
 */
export function reconstructParagraphs(
  lines: TextLine[],
  pageWidthPt: number,
  medianFontSize: number
): ReconstructedParagraph[] {
  if (lines.length === 0) return [];

  const paragraphs: ReconstructedParagraph[] = [];
  let currentLines: TextLine[] = [];
  let prevLine: TextLine | null = null;

  const flushCurrentParagraph = () => {
    if (currentLines.length === 0) return;

    const p = buildSingleParagraph(currentLines, pageWidthPt, medianFontSize);
    if (p) paragraphs.push(p);
    currentLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (prevLine !== null) {
      const verticalGap = Math.abs(line.y - prevLine.y);
      const expectedGap = Math.max(12, prevLine.lineHeight * 1.6);
      const isLargeGap = verticalGap > expectedGap;

      // Font size shift indicates heading or new section
      const fontSizeShift = Math.abs(line.avgFontSize - prevLine.avgFontSize) > 2.5;

      // Check if line starts with bullet or number list
      const firstText = line.items[0]?.str.trim() || '';
      const isNewListItem = BULLET_REGEX.test(firstText);

      // Significant indentation jump on new line
      const indentJump = line.xMin - prevLine.xMin > 14;

      if (isLargeGap || fontSizeShift || isNewListItem || indentJump) {
        flushCurrentParagraph();
      }
    }

    currentLines.push(line);
    prevLine = line;
  }

  flushCurrentParagraph();
  return paragraphs;
}

/**
 * Converts a cluster of lines into a single native Word paragraph.
 */
function buildSingleParagraph(
  lines: TextLine[],
  pageWidthPt: number,
  medianFontSize: number
): ReconstructedParagraph | null {
  if (lines.length === 0) return null;

  // Flatten all runs from the lines
  const allRuns: ReconstructedRun[] = [];
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const lineRuns = clusterLineIntoRuns(line.items, medianFontSize);

    // If not the last line, ensure separation with a trailing space
    if (lineRuns.length > 0 && l < lines.length - 1) {
      const lastRun = lineRuns[lineRuns.length - 1];
      if (!lastRun.text.endsWith(' ') && !lastRun.text.endsWith('-')) {
        lastRun.text += ' ';
      }
    }
    allRuns.push(...lineRuns);
  }

  if (allRuns.length === 0) return null;

  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1];
  const avgFontSize =
    lines.reduce((sum, l) => sum + l.avgFontSize, 0) / lines.length;

  // 1. Heading Detection
  const isH1 = avgFontSize >= medianFontSize * 1.45 || avgFontSize >= 18;
  const isH2 = !isH1 && (avgFontSize >= medianFontSize * 1.25 || avgFontSize >= 14);
  const isH3 = !isH1 && !isH2 && (avgFontSize >= medianFontSize * 1.12 || avgFontSize >= 12) && allRuns.some((r) => r.bold);
  const isH4 = !isH1 && !isH2 && !isH3 && lines.length === 1 && allRuns.every((r) => r.bold) && allRuns.reduce((s, r) => s + r.text.length, 0) < 60;

  // 2. Alignment Detection
  const alignment = detectAlignment(lines, pageWidthPt);

  // 3. List Item Detection
  const fullText = allRuns.map((r) => r.text).join('').trim();
  const listMatch = fullText.match(BULLET_REGEX);
  const isListItem = Boolean(listMatch);
  const listBullet = listMatch ? listMatch[1] : undefined;

  // 4. Indentation (first line indent in dxa: 1 pt = 20 dxa)
  let indentFirstLine: number | undefined = undefined;
  if (lines.length > 1) {
    const diff = lines[0].xMin - lines[1].xMin;
    if (diff > 10 && diff < 80) {
      indentFirstLine = Math.round(diff * 20);
    }
  }

  // 5. Paragraph Spacing (dxa)
  let spacingBefore = 100;
  let spacingAfter = 100;

  if (isH1) {
    spacingBefore = 240;
    spacingAfter = 140;
  } else if (isH2) {
    spacingBefore = 200;
    spacingAfter = 120;
  } else if (isH3 || isH4) {
    spacingBefore = 160;
    spacingAfter = 100;
  } else if (isListItem) {
    spacingBefore = 40;
    spacingAfter = 40;
  }

  return {
    type: 'paragraph',
    runs: allRuns,
    alignment,
    isHeading1: isH1,
    isHeading2: isH2,
    isHeading3: isH3,
    isHeading4: isH4,
    isListItem,
    listBullet,
    indentFirstLine,
    spacingBefore,
    spacingAfter,
    lineSpacing: 276, // 1.15 line height
    originalY: firstLine.y,
  };
}

/**
 * Determines text alignment based on horizontal bounds relative to page center.
 */
function detectAlignment(lines: TextLine[], pageWidthPt: number): TextAlignment {
  if (lines.length === 0) return 'left';

  const mid = pageWidthPt / 2;

  // Single short line checking center or right
  if (lines.length === 1) {
    const line = lines[0];
    const lineCenter = (line.xMin + line.xMax) / 2;
    if (Math.abs(lineCenter - mid) < 30 && line.xMax - line.xMin < pageWidthPt * 0.7) {
      return 'center';
    }
    if (line.xMin > pageWidthPt * 0.6) {
      return 'right';
    }
    return 'left';
  }

  // Multi-line alignment checks
  let centerMatches = 0;
  let rightMatches = 0;

  for (const line of lines) {
    const lineCenter = (line.xMin + line.xMax) / 2;
    if (Math.abs(lineCenter - mid) < 25) centerMatches++;
    if (line.xMax > pageWidthPt * 0.85) rightMatches++;
  }

  if (centerMatches >= lines.length * 0.75) return 'center';
  if (rightMatches >= lines.length * 0.75 && lines[0].xMin > pageWidthPt * 0.4) return 'right';

  return 'left';
}
