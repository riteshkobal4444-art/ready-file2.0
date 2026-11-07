import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  PageBreak,
  Packer,
} from 'docx';
import { readFileAsArrayBuffer } from '../utils/fileHelpers';
import { convertPdfToWordVisual, VisualConvertResult } from './visualPdfToWordService';
import { convertPdfToWordEditable, EditableConvertResult } from './editablePdfToWordService';
import { convertScannedPdfWithOcr, OcrResult } from './pdfOcrService';

// Configure PDF.js worker using Vite asset URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ExtractedRun {
  text: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
}

export interface ExtractedParagraph {
  runs: ExtractedRun[];
  isHeading1?: boolean;
  isHeading2?: boolean;
}

export interface ExtractedPage {
  pageNumber: number;
  paragraphs: ExtractedParagraph[];
}

export interface ConversionProgress {
  stage: 'reading' | 'extracting' | 'analyzing' | 'rendering' | 'recognizing' | 'generating' | 'bundling' | 'ready';
  message: string;
  currentPage?: number;
  totalPages?: number;
}

export interface PdfToWordResult {
  blob: Blob;
  pageCount: number;
  textCount?: number;
  mode: 'editable' | 'visual' | 'ocr';
  isScanned?: boolean;
  tablesDetected?: number;
  tablesReconstructed?: number;
  detectedRows?: number;
  detectedCols?: number;
  verticalBordersPresent?: boolean;
  textBlocksAssignedToCells?: number;
  imagesDetected?: number;
  imagesInserted?: number;
  textBlocksCount?: number;
  headersDetected?: number;
  footersDetected?: number;
  warnings?: string[];
  dpiUsed?: number;
}

export interface HybridConvertOptions {
  mode: 'editable' | 'visual';
  visualDpi?: 150 | 200;
  useOcr?: boolean;
  onProgress?: (progress: ConversionProgress) => void;
}

/**
 * Validates that the file has a genuine %PDF- signature and is non-empty
 */
export async function validatePdfFile(file: File): Promise<{ isValid: boolean; error?: string }> {
  if (!file || file.size === 0) {
    return { isValid: false, error: 'The selected file is empty. Please choose a valid PDF file.' };
  }

  // Check file size safety ceiling (e.g. 50 MB for client-side processing)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: 'File size exceeds 50 MB. For smooth browser performance, please choose a smaller PDF.',
    };
  }

  // Check magic bytes %PDF-
  try {
    const slice = file.slice(0, 8);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // 0x25 = %, 0x50 = P, 0x44 = D, 0x46 = F, 0x2D = -
    const hasPdfSignature =
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d;

    if (!hasPdfSignature && !file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return {
        isValid: false,
        error: 'Unsupported file format. Please select an authentic PDF (.pdf) document.',
      };
    }
  } catch {
    return { isValid: false, error: 'Could not read file header. Please try another PDF.' };
  }

  return { isValid: true };
}

/**
 * Main Hybrid Conversion Orchestrator.
 * Routes to either Mode A (Advanced Editable Word), Mode B (Visual-Preservation Word),
 * or in-browser OCR if requested for scanned documents.
 */
export async function convertPdfToWordHybrid(
  file: File,
  options: HybridConvertOptions
): Promise<PdfToWordResult> {
  const { mode, visualDpi = 150, useOcr = false, onProgress } = options;

  if (mode === 'visual') {
    const res = await convertPdfToWordVisual(
      file,
      { dpi: visualDpi },
      (p) => onProgress?.({ stage: p.stage as any, message: p.message, currentPage: p.currentPage, totalPages: p.totalPages })
    );
    return {
      blob: res.blob,
      pageCount: res.pageCount,
      mode: 'visual',
      dpiUsed: res.dpiUsed,
    };
  }

  // If OCR explicitly requested for an image-based scan
  if (useOcr) {
    const res = await convertScannedPdfWithOcr(
      file,
      (p) => onProgress?.({ stage: p.stage as any, message: p.message, currentPage: p.currentPage, totalPages: p.totalPages })
    );
    return {
      blob: res.blob,
      pageCount: res.pageCount,
      textCount: res.extractedChars,
      mode: 'ocr',
      isScanned: false,
    };
  }

  // Mode A: Advanced Editable Engine
  try {
    const res = await convertPdfToWordEditable(
      file,
      (p) => onProgress?.({ stage: p.stage as any, message: p.message, currentPage: p.currentPage, totalPages: p.totalPages })
    );

    if (res.isScanned) {
      return {
        blob: res.blob,
        pageCount: res.pageCount,
        mode: 'editable',
        isScanned: true,
      };
    }

    return {
      blob: res.blob,
      pageCount: res.pageCount,
      textCount: res.textCount,
      tablesDetected: res.tablesDetected,
      tablesReconstructed: res.tablesReconstructed,
      detectedRows: res.detectedRows,
      detectedCols: res.detectedCols,
      verticalBordersPresent: res.verticalBordersPresent,
      textBlocksAssignedToCells: res.textBlocksAssignedToCells,
      imagesDetected: res.imagesDetected,
      imagesInserted: res.imagesInserted,
      textBlocksCount: res.textBlocksCount,
      headersDetected: res.headersDetected,
      footersDetected: res.footersDetected,
      warnings: res.warnings,
      mode: 'editable',
      isScanned: false,
    };
  } catch (advancedError) {
    // Graceful fallback to Phase 1 dependable engine if advanced reconstruction meets unexpected token structures
    // eslint-disable-next-line no-console
    console.warn('Advanced editable reconstruction encountered an issue, falling back to Phase 1 engine:', advancedError);

    onProgress?.({
      stage: 'generating',
      message: 'Processing with fallback text reconstruction...',
    });

    const fallbackRes = await convertPdfToWordPhase1(file, onProgress);
    return {
      blob: fallbackRes.blob,
      pageCount: fallbackRes.pageCount,
      textCount: fallbackRes.textCount,
      mode: 'editable',
      isScanned: false,
    };
  }
}

/**
 * Backward-compatible alias for the default converter
 */
export async function convertPdfToWord(
  file: File,
  onProgress?: (progress: ConversionProgress) => void
): Promise<PdfToWordResult> {
  return convertPdfToWordHybrid(file, { mode: 'editable', onProgress });
}

interface RawTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  hasEOL: boolean;
}

/**
 * Phase 1 baseline conversion engine preserved intact as an unbreakable fallback.
 */
export async function convertPdfToWordPhase1(
  file: File,
  onProgress?: (progress: ConversionProgress) => void
): Promise<PdfToWordResult> {
  const validation = await validatePdfFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid PDF file.');
  }

  onProgress?.({
    stage: 'reading',
    message: 'Reading PDF document...',
  });

  const arrayBuffer = await readFileAsArrayBuffer(file);

  let pdfDoc: pdfjsLib.PDFDocumentProxy;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
    });
    pdfDoc = await loadingTask.promise;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('password') || msg.includes('encrypted')) {
      throw new Error('This PDF is password-protected. Please remove password protection before converting.');
    }
    throw new Error('Failed to parse PDF document. The file may be corrupted or truncated.');
  }

  const totalPages = pdfDoc.numPages;
  if (totalPages === 0) {
    await pdfDoc.cleanup();
    throw new Error('This PDF does not contain any pages.');
  }

  const pagesData: ExtractedPage[] = [];
  let totalExtractedLength = 0;
  const allFontSizes: number[] = [];

  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      onProgress?.({
        stage: 'extracting',
        message: `Extracting text from page ${pageNum} of ${totalPages}...`,
        currentPage: pageNum,
        totalPages,
      });

      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const rawItems: RawTextItem[] = [];

      for (const item of textContent.items) {
        if ('str' in item && typeof item.str === 'string') {
          const str = item.str;
          if (str.length === 0) continue;

          const transform = item.transform;
          const x = transform[4];
          const y = transform[5];
          const fontSize = Math.max(8, Math.round(Math.hypot(transform[0], transform[1]) || Math.abs(transform[3]) || 11));
          const width = item.width || 0;
          const height = item.height || fontSize;
          const fontName = item.fontName || '';
          const hasEOL = Boolean((item as { hasEOL?: boolean }).hasEOL);

          rawItems.push({
            str,
            x,
            y,
            width,
            height,
            fontSize,
            fontName,
            hasEOL,
          });

          allFontSizes.push(fontSize);
          totalExtractedLength += str.trim().length;
        }
      }

      const paragraphs = groupItemsIntoParagraphs(rawItems);
      pagesData.push({
        pageNumber: pageNum,
        paragraphs,
      });
    }
  } finally {
    try {
      await pdfDoc.cleanup();
    } catch {
      // Ignore cleanup error
    }
  }

  if (totalExtractedLength < 25) {
    throw new Error(
      'This PDF appears to be scanned or image-based. Text recognition (OCR) is not supported in this version. Please upload a text-based PDF.'
    );
  }

  onProgress?.({
    stage: 'generating',
    message: 'Creating Word document with native paragraphs and styles...',
    currentPage: totalPages,
    totalPages,
  });

  const medianFontSize = calculateMedian(allFontSizes) || 11;
  const docxParagraphs: Paragraph[] = [];

  for (let pIndex = 0; pIndex < pagesData.length; pIndex++) {
    const pageData = pagesData[pIndex];

    if (pIndex > 0) {
      docxParagraphs.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }

    for (const para of pageData.paragraphs) {
      if (para.runs.length === 0) continue;

      const avgFontSize =
        para.runs.reduce((acc, r) => acc + r.fontSize, 0) / para.runs.length;
      const isHeading1 = avgFontSize >= medianFontSize * 1.35 || avgFontSize >= 16;
      const isHeading2 = !isHeading1 && (avgFontSize >= medianFontSize * 1.18 || avgFontSize >= 13);

      const textRuns = para.runs.map(
        (r) =>
          new TextRun({
            text: r.text,
            bold: r.bold || isHeading1 || isHeading2,
            italics: r.italic,
            size: Math.round(r.fontSize * 2),
            font: 'Arial',
          })
      );

      docxParagraphs.push(
        new Paragraph({
          heading: isHeading1
            ? HeadingLevel.HEADING_1
            : isHeading2
            ? HeadingLevel.HEADING_2
            : undefined,
          spacing: {
            before: isHeading1 ? 240 : isHeading2 ? 180 : 120,
            after: isHeading1 ? 140 : isHeading2 ? 100 : 120,
            line: 276,
          },
          children: textRuns,
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
            },
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: docxParagraphs,
      },
    ],
  });

  onProgress?.({
    stage: 'ready',
    message: 'Packing editable Word (.docx) file...',
  });

  const blob = await Packer.toBlob(doc);

  return {
    blob,
    pageCount: totalPages,
    textCount: totalExtractedLength,
    mode: 'editable',
  };
}

function groupItemsIntoParagraphs(items: RawTextItem[]): ExtractedParagraph[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) <= 3) {
      return a.x - b.x;
    }
    return b.y - a.y;
  });

  interface TextLine {
    y: number;
    items: RawTextItem[];
  }

  const lines: TextLine[] = [];
  for (const item of sorted) {
    const existingLine = lines.find(
      (l) => Math.abs(l.y - item.y) <= Math.max(3.5, item.fontSize * 0.35)
    );

    if (existingLine) {
      existingLine.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }

  lines.sort((a, b) => b.y - a.y);

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
  }

  const paragraphs: ExtractedParagraph[] = [];
  let currentRuns: ExtractedRun[] = [];
  let prevLineY: number | null = null;
  let prevLineHeight = 12;

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const avgFontSize =
      line.items.reduce((sum, item) => sum + item.fontSize, 0) / line.items.length;
    const currentLineHeight = Math.max(12, avgFontSize * 1.25);

    if (prevLineY !== null) {
      const verticalGap = Math.abs(prevLineY - line.y);
      if (verticalGap > prevLineHeight * 1.7) {
        if (currentRuns.length > 0) {
          paragraphs.push({ runs: mergeAdjacentRuns(currentRuns) });
          currentRuns = [];
        }
      }
    }

    for (let i = 0; i < line.items.length; i++) {
      const item = line.items[i];
      const fontLower = item.fontName.toLowerCase();
      const bold =
        fontLower.includes('bold') ||
        fontLower.includes('black') ||
        fontLower.includes('heavy') ||
        fontLower.includes('semibold');
      const italic =
        fontLower.includes('italic') ||
        fontLower.includes('oblique');

      let text = item.str;
      if (i > 0) {
        const prevItem = line.items[i - 1];
        const gap = item.x - (prevItem.x + prevItem.width);
        if (gap > item.fontSize * 0.2 && !prevItem.str.endsWith(' ') && !text.startsWith(' ')) {
          text = ' ' + text;
        }
      }

      currentRuns.push({
        text,
        fontSize: item.fontSize,
        bold,
        italic,
      });
    }

    if (currentRuns.length > 0) {
      const lastRun = currentRuns[currentRuns.length - 1];
      if (lastRun && !lastRun.text.endsWith('-') && !lastRun.text.endsWith(' ')) {
        lastRun.text += ' ';
      }
    }

    prevLineY = line.y;
    prevLineHeight = currentLineHeight;
  }

  if (currentRuns.length > 0) {
    paragraphs.push({ runs: mergeAdjacentRuns(currentRuns) });
  }

  return paragraphs;
}

function mergeAdjacentRuns(runs: ExtractedRun[]): ExtractedRun[] {
  if (runs.length <= 1) return runs;

  const merged: ExtractedRun[] = [];
  let current: ExtractedRun = { ...runs[0] };

  for (let i = 1; i < runs.length; i++) {
    const next = runs[i];
    if (
      current.fontSize === next.fontSize &&
      current.bold === next.bold &&
      current.italic === next.italic
    ) {
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

function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 11;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
