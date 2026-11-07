import { 
  PDFDocument, 
  rgb, 
  StandardFonts, 
  degrees 
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { 
  WatermarkOptions, 
  WatermarkPageInfo, 
  PageSelectionMode 
} from '../types/watermark';

// Register PDF.js worker using Vite asset URL
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

/**
 * Parses hex color string (#RRGGBB) into pdf-lib rgb format
 */
export function hexToRgb(hex: string = '#687386') {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return rgb(isNaN(r) ? 0.4 : r, isNaN(g) ? 0.4 : g, isNaN(b) ? 0.4 : b);
  }
  return rgb(0.4, 0.45, 0.5);
}

/**
 * Sanitizes text for standard WinAnsi PDF fonts to prevent unhandled encoding errors
 */
export function sanitizeWinAnsi(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '*')
    .replace(/[^\x00-\xFF]/g, '?');
}

/**
 * Normalizes an image data URL into clean PNG bytes for pdf-lib
 */
export async function dataUrlToCleanPngBytes(dataUrl: string): Promise<Uint8Array> {
  if (dataUrl.startsWith('data:image/png;base64,')) {
    const base64Data = dataUrl.replace('data:image/png;base64,', '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 200;
        canvas.height = img.naturalHeight || 200;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const pngDataUrl = canvas.toDataURL('image/png');
        const base64 = pngDataUrl.replace('data:image/png;base64,', '');
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        resolve(bytes);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for watermark embedding'));
    img.src = dataUrl;
  });
}

/**
 * Parses custom page ranges (e.g. "1-3, 5, 8") into a Set of 0-based page indices
 */
export function parsePageRange(rangeStr: string, totalPages: number): Set<number> {
  const result = new Set<number>();
  if (!rangeStr.trim()) return result;

  const parts = rangeStr.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        for (let i = min; i <= max; i++) {
          result.add(i - 1);
        }
      }
    } else {
      const pageNum = parseInt(trimmed, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        result.add(pageNum - 1);
      }
    }
  }

  return result;
}

/**
 * Checks if a given 0-based page index matches the user's page selection criteria
 */
export function shouldWatermarkPage(
  pageIndex: number,
  mode: PageSelectionMode,
  customRange: string,
  totalPages: number
): boolean {
  if (mode === 'all') return true;
  if (mode === 'first') return pageIndex === 0;
  if (mode === 'odd') return (pageIndex + 1) % 2 === 1;
  if (mode === 'even') return (pageIndex + 1) % 2 === 0;
  if (mode === 'custom') {
    const pagesSet = parsePageRange(customRange, totalPages);
    return pagesSet.has(pageIndex);
  }
  return true;
}

/**
 * Inspects uploaded PDF and prepares isolated bytes and cached PDF.js proxy
 */
export async function inspectAndLoadPdfForWatermark(file: File): Promise<{
  originalBytes: Uint8Array;
  pdfjsDoc: pdfjsLib.PDFDocumentProxy;
  pageCount: number;
  pages: WatermarkPageInfo[];
}> {
  const rawBuffer = await file.arrayBuffer();
  // Clone bytes into an isolated typed array so it can never be detached
  const originalBytes = new Uint8Array(rawBuffer.slice(0));

  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(originalBytes.slice(), { ignoreEncryption: false });
  } catch (err: any) {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('password') || msg.includes('encrypt')) {
      throw new Error('This PDF is password-protected. Please remove the password before adding watermarks.');
    }
    throw new Error('Could not open PDF file. The document may be corrupted or in an unsupported format.');
  }

  const pageCount = pdfDoc.getPageCount();
  if (pageCount === 0) {
    throw new Error('The uploaded PDF contains no pages.');
  }

  const pages: WatermarkPageInfo[] = [];
  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    const rotation = page.getRotation().angle || 0;
    pages.push({
      pageNumber: i + 1,
      pageIndex: i,
      width,
      height,
      rotation,
    });
  }

  const loadingTask = pdfjsLib.getDocument({
    data: originalBytes.slice(),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfjsDoc = await loadingTask.promise;

  return {
    originalBytes,
    pdfjsDoc,
    pageCount,
    pages,
  };
}

/**
 * Renders a base PDF page directly onto a DOM canvas element
 */
export async function renderPdfPageToCanvas(
  pdfjsDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<{ width: number; height: number }> {
  const page = await pdfjsDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  });

  await renderTask.promise;
  return { width: canvas.width, height: canvas.height };
}

/**
 * Applies text or image watermark to target pages and exports completed PDF
 */
export async function applyWatermarkAndExport(
  originalBytes: Uint8Array,
  options: WatermarkOptions
): Promise<Blob> {
  const pdfDoc = await PDFDocument.load(originalBytes.slice(), { ignoreEncryption: false });
  const totalPages = pdfDoc.getPageCount();

  // Load fonts if text watermark
  let font: any = null;
  if (options.type === 'text') {
    if (options.fontFamily === 'TimesRoman') {
      font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    } else if (options.fontFamily === 'Courier') {
      font = await pdfDoc.embedFont(StandardFonts.Courier);
    } else if (options.fontFamily === 'Helvetica') {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    } else {
      font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }
  }

  // Load image if image watermark
  let embeddedImage: any = null;
  let imageAspectRatio = 1.0;
  if (options.type === 'image' && options.imageDataUrl) {
    const cleanPngBytes = await dataUrlToCleanPngBytes(options.imageDataUrl);
    embeddedImage = await pdfDoc.embedPng(cleanPngBytes);
    imageAspectRatio = embeddedImage.width / (embeddedImage.height || 1);
  }

  const textColor = hexToRgb(options.color || '#687386');
  const safeText = sanitizeWinAnsi(options.text || 'CONFIDENTIAL');
  const angleRad = (options.rotation * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  // Apply to eligible pages
  for (let i = 0; i < totalPages; i++) {
    if (!shouldWatermarkPage(i, options.pageSelection, options.customPageRange, totalPages)) {
      continue;
    }

    const page = pdfDoc.getPage(i);
    const { width: pageWidth, height: pageHeight } = page.getSize();

    if (options.type === 'text' && font && safeText.trim()) {
      const fontSize = options.fontSize || 48;
      let textWidth = 0;
      try {
        textWidth = font.widthOfTextAtSize(safeText, fontSize);
      } catch {
        textWidth = safeText.length * (fontSize * 0.55);
      }
      const textHeight = fontSize * 0.7;

      // Mathematical offset for rotated text centering
      const dx = -textWidth / 2;
      const dy = -textHeight / 2;
      const offsetX = dx * cosA - dy * sinA;
      const offsetY = dx * sinA + dy * cosA;

      if (options.position === 'center') {
        const cx = pageWidth / 2;
        const cy = pageHeight / 2;
        page.drawText(safeText, {
          x: cx + offsetX,
          y: cy + offsetY,
          size: fontSize,
          font,
          color: textColor,
          opacity: options.opacity,
          rotate: degrees(options.rotation),
        });
      } else {
        // Tiled repeating grid across page (3 columns x 3 rows)
        const cols = 3;
        const rows = 3;
        for (let c = 1; c <= cols; c++) {
          for (let r = 1; r <= rows; r++) {
            const cx = (pageWidth * c) / (cols + 1);
            const cy = (pageHeight * r) / (rows + 1);
            page.drawText(safeText, {
              x: cx + offsetX,
              y: cy + offsetY,
              size: fontSize * 0.65, // scale slightly smaller for repeating tiles
              font,
              color: textColor,
              opacity: options.opacity * 0.85,
              rotate: degrees(options.rotation),
            });
          }
        }
      }
    } else if (options.type === 'image' && embeddedImage) {
      const imgWidth = Math.max(40, pageWidth * (options.imageScale || 0.45));
      const imgHeight = imgWidth / imageAspectRatio;

      const dx = -imgWidth / 2;
      const dy = -imgHeight / 2;
      const offsetX = dx * cosA - dy * sinA;
      const offsetY = dx * sinA + dy * cosA;

      if (options.position === 'center') {
        const cx = pageWidth / 2;
        const cy = pageHeight / 2;
        page.drawImage(embeddedImage, {
          x: cx + offsetX,
          y: cy + offsetY,
          width: imgWidth,
          height: imgHeight,
          opacity: options.opacity,
          rotate: degrees(options.rotation),
        });
      } else {
        // Tiled grid (3 columns x 3 rows)
        const cols = 3;
        const rows = 3;
        const tileW = imgWidth * 0.65;
        const tileH = imgHeight * 0.65;
        const tdx = -tileW / 2;
        const tdy = -tileH / 2;
        const tOffsetX = tdx * cosA - tdy * sinA;
        const tOffsetY = tdx * sinA + tdy * cosA;

        for (let c = 1; c <= cols; c++) {
          for (let r = 1; r <= rows; r++) {
            const cx = (pageWidth * c) / (cols + 1);
            const cy = (pageHeight * r) / (rows + 1);
            page.drawImage(embeddedImage, {
              x: cx + tOffsetX,
              y: cy + tOffsetY,
              width: tileW,
              height: tileH,
              opacity: options.opacity * 0.85,
              rotate: degrees(options.rotation),
            });
          }
        }
      }
    }
  }

  const outputBytes = await pdfDoc.save();
  if (!outputBytes || outputBytes.byteLength === 0) {
    throw new Error('Watermark export produced an empty PDF.');
  }

  const header = String.fromCharCode(outputBytes[0], outputBytes[1], outputBytes[2], outputBytes[3], outputBytes[4]);
  if (!header.startsWith('%PDF-')) {
    throw new Error('Generated file does not have a valid PDF header.');
  }

  return new Blob([outputBytes as BlobPart], { type: 'application/pdf' });
}
