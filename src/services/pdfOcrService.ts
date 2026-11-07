import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  PageBreak,
  Packer,
} from 'docx';
import { readFileAsArrayBuffer } from '../utils/fileHelpers';
import { validatePdfFile } from './pdfToWordService';

// Ensure PDF.js worker is configured
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface OcrProgress {
  stage: 'initializing' | 'rendering' | 'recognizing' | 'generating' | 'ready';
  message: string;
  currentPage?: number;
  totalPages?: number;
}

export interface OcrResult {
  blob: Blob;
  pageCount: number;
  extractedChars: number;
}

/**
 * Optical Character Recognition (OCR) engine for scanned and image-based PDFs.
 * Runs 100% locally in the browser via Tesseract.js WebAssembly without sending
 * documents or images to external servers.
 */
export async function convertScannedPdfWithOcr(
  file: File,
  onProgress?: (progress: OcrProgress) => void
): Promise<OcrResult> {
  const validation = await validatePdfFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid PDF file.');
  }

  onProgress?.({
    stage: 'initializing',
    message: 'Initializing in-browser OCR engine...',
  });

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  let worker: any = null;
  const pageParagraphs: string[][] = [];
  let totalChars = 0;

  try {
    // Initialize Tesseract worker in English (standard default)
    worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          const pct = Math.round(m.progress * 100);
          onProgress?.({
            stage: 'recognizing',
            message: `Recognizing text (${pct}%)...`,
          });
        }
      },
    });

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      onProgress?.({
        stage: 'rendering',
        message: `Rendering scanned page ${pageNum} of ${totalPages} for OCR...`,
        currentPage: pageNum,
        totalPages,
      });

      const page = await pdfDoc.getPage(pageNum);
      // Render at ~150 DPI for optimal OCR balance between accuracy and memory
      const scale = 150 / 72;
      const viewport = page.getViewport({ scale, rotation: page.rotate || 0 });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Canvas 2D context unavailable.');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      onProgress?.({
        stage: 'recognizing',
        message: `Performing OCR on page ${pageNum} of ${totalPages}...`,
        currentPage: pageNum,
        totalPages,
      });

      const ret = await worker.recognize(canvas);
      const rawText = ret.data?.text || '';
      totalChars += rawText.trim().length;

      // Clean lines and reconstruct into paragraphs
      const paragraphs = rawText
        .split(/\n\s*\n/)
        .map((p: string) => p.replace(/\s+/g, ' ').trim())
        .filter((p: string) => p.length > 0);

      pageParagraphs.push(paragraphs.length > 0 ? paragraphs : ['[No readable text recognized on this page]']);

      // Cleanup canvas memory immediately
      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    try {
      await pdfDoc.cleanup();
    } catch {
      // Ignore cleanup error
    }
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // Ignore worker termination error
      }
    }
  }

  onProgress?.({
    stage: 'generating',
    message: 'Compiling recognized text into editable Word document...',
    currentPage: totalPages,
    totalPages,
  });

  // Build the docx Document
  const docxParagraphs: Paragraph[] = [];

  for (let pIndex = 0; pIndex < pageParagraphs.length; pIndex++) {
    if (pIndex > 0) {
      docxParagraphs.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }

    const paragraphs = pageParagraphs[pIndex];
    for (let i = 0; i < paragraphs.length; i++) {
      const text = paragraphs[i];
      // Basic heading check (e.g., short first paragraph in all caps or title case)
      const isShortHeading = i === 0 && text.length < 60 && !text.endsWith('.');

      docxParagraphs.push(
        new Paragraph({
          heading: isShortHeading ? HeadingLevel.HEADING_1 : undefined,
          spacing: {
            before: isShortHeading ? 200 : 120,
            after: isShortHeading ? 140 : 120,
            line: 276,
          },
          children: [
            new TextRun({
              text,
              bold: isShortHeading,
              size: isShortHeading ? 28 : 22, // 14pt vs 11pt
              font: 'Arial',
            }),
          ],
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
              width: 11906, // A4
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

  const blob = await Packer.toBlob(doc);

  onProgress?.({
    stage: 'ready',
    message: 'OCR Word document ready.',
  });

  return {
    blob,
    pageCount: totalPages,
    extractedChars: totalChars,
  };
}
