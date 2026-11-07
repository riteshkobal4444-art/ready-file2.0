import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  Document,
  Paragraph,
  ImageRun,
  Packer,
  PageOrientation,
} from 'docx';
import { readFileAsArrayBuffer } from '../utils/fileHelpers';
import { validatePdfFile } from './pdfToWordService';

// Ensure PDF.js worker is configured
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface VisualConvertOptions {
  dpi?: 150 | 200; // Standard (150) or High (200)
  quality?: number; // JPEG compression ratio (e.g. 0.90)
}

export interface VisualProgress {
  stage: 'reading' | 'rendering' | 'bundling' | 'ready';
  message: string;
  currentPage?: number;
  totalPages?: number;
}

export interface VisualConvertResult {
  blob: Blob;
  pageCount: number;
  mode: 'visual';
  dpiUsed: number;
}

/**
 * Converts a PDF into a high-fidelity visual Word document (.docx).
 * Every PDF page is rendered at 150 or 200 DPI and embedded into a matching
 * zero-margin page section inside a genuine Word document, preserving exact
 * fonts, graphics, backgrounds, layouts, and page proportions.
 */
export async function convertPdfToWordVisual(
  file: File,
  options?: VisualConvertOptions,
  onProgress?: (progress: VisualProgress) => void
): Promise<VisualConvertResult> {
  const validation = await validatePdfFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid PDF file.');
  }

  const dpi = options?.dpi || 150;
  const jpegQuality = options?.quality || 0.90;

  onProgress?.({
    stage: 'reading',
    message: 'Reading PDF document structure...',
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
      throw new Error('This PDF is password-protected. Please unlock it before converting.');
    }
    throw new Error('Failed to parse PDF document. The file may be damaged or corrupted.');
  }

  const totalPages = pdfDoc.numPages;
  if (totalPages === 0) {
    await pdfDoc.cleanup();
    throw new Error('This PDF does not contain any pages.');
  }

  // Pre-calculate scale based on DPI (PDF default is 72 DPI)
  const scale = dpi / 72;

  // We will build one Section per PDF page
  const sections: any[] = [];

  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      onProgress?.({
        stage: 'rendering',
        message: `Rendering page ${pageNum} of ${totalPages} at ${dpi} DPI...`,
        currentPage: pageNum,
        totalPages,
      });

      const page = await pdfDoc.getPage(pageNum);
      const rotation = page.rotate || 0;

      // 1. Unscaled viewport gives page dimensions in standard PDF points (1/72 inch)
      const unscaledViewport = page.getViewport({ scale: 1.0, rotation });
      const pageWidthPt = unscaledViewport.width;
      const pageHeightPt = unscaledViewport.height;

      // 2. High-res viewport for rendering to canvas
      const renderViewport = page.getViewport({ scale, rotation });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(renderViewport.width);
      canvas.height = Math.floor(renderViewport.height);

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        throw new Error('Canvas 2D context unavailable in browser.');
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport: renderViewport,
        canvas,
      }).promise;

      // 3. Export canvas as high-quality JPEG
      const pageBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to capture canvas buffer'))),
          'image/jpeg',
          jpegQuality
        );
      });

      const pageBuffer = await pageBlob.arrayBuffer();

      // Free canvas memory immediately
      canvas.width = 1;
      canvas.height = 1;

      // 4. Calculate DOCX page size & margins
      // In DOCX:
      // Page size is measured in dxa (twips): 1 pt = 20 dxa.
      // Image transformation is measured in pixels at 96 DPI: 1 pt = 96/72 px.
      const pageWidthDxa = Math.round(pageWidthPt * 20);
      const pageHeightDxa = Math.round(pageHeightPt * 20);

      const imgWidthPx = Math.round(pageWidthPt * (96 / 72));
      const imgHeightPx = Math.round(pageHeightPt * (96 / 72));

      const isLandscape = pageWidthPt > pageHeightPt;

      sections.push({
        properties: {
          page: {
            size: {
              width: pageWidthDxa,
              height: pageHeightDxa,
              orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            },
          },
        },
        children: [
          new Paragraph({
            spacing: { before: 0, after: 0, line: 240 },
            children: [
              new ImageRun({
                type: 'jpg',
                data: new Uint8Array(pageBuffer),
                transformation: {
                  width: imgWidthPx,
                  height: imgHeightPx,
                },
              }),
            ],
          }),
        ],
      });
    }
  } finally {
    try {
      await pdfDoc.cleanup();
    } catch {
      // Ignore cleanup error
    }
  }

  onProgress?.({
    stage: 'bundling',
    message: 'Packing Word document package (.docx)...',
    currentPage: totalPages,
    totalPages,
  });

  const doc = new Document({
    sections,
  });

  const docxBlob = await Packer.toBlob(doc);

  onProgress?.({
    stage: 'ready',
    message: 'Word document ready.',
  });

  return {
    blob: docxBlob,
    pageCount: totalPages,
    mode: 'visual',
    dpiUsed: dpi,
  };
}
