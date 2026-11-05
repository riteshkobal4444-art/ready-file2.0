import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Initialize PDF.js worker using the Vite URL asset import
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface RenderPageOptions {
  pageNumber: number; // 1-based
  scale?: number; // default 1.0 (72 DPI)
  dpi?: number; // 72, 150, 300
  rotation?: number; // 0, 90, 180, 270
}

/**
 * Loads a PDF Document using PDF.js from a File or ArrayBuffer
 */
export async function loadPdfJsDoc(fileOrBuffer: File | ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  let arrayBuffer: ArrayBuffer;
  if (fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  return loadingTask.promise;
}

/**
 * Renders a specific page of a PDF document to an HTML Canvas
 */
export async function renderPdfPageToCanvas(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  options?: { dpi?: number; scale?: number; rotationOffset?: number }
): Promise<HTMLCanvasElement> {
  const page = await pdfDoc.getPage(pageNumber);

  // Default PDF resolution is 72 DPI.
  // If dpi is 150, scale is 150 / 72 ≈ 2.083. If 300, scale is 300 / 72 ≈ 4.166
  const targetDpi = options?.dpi || 72;
  const dpiScale = options?.scale ? options.scale : targetDpi / 72;

  // Viewport calculation with rotation
  const currentRotation = page.rotate || 0;
  const rotationOffset = options?.rotationOffset || 0;
  const finalRotation = (currentRotation + rotationOffset) % 360;

  const viewport = page.getViewport({
    scale: dpiScale,
    rotation: finalRotation,
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Failed to get 2D context for PDF page render');

  // Fill white background for PDF rendering
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: ctx,
    viewport,
    canvas,
  };

  await page.render(renderContext).promise;
  return canvas;
}

/**
 * Renders a lightweight thumbnail (e.g. max 250px height) of a PDF page as a Data URL
 */
export async function renderPdfPageThumbnail(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  rotationOffset = 0
): Promise<string> {
  const page = await pdfDoc.getPage(pageNumber);
  const unscaledViewport = page.getViewport({ scale: 1.0, rotation: (page.rotate + rotationOffset) % 360 });

  // Calculate scale so thumbnail height is ~240px
  const maxDim = 240;
  const scale = Math.min(maxDim / unscaledViewport.height, maxDim / unscaledViewport.width, 1.0);

  const viewport = page.getViewport({ scale, rotation: (page.rotate + rotationOffset) % 360 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return '';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL('image/jpeg', 0.85);
}
