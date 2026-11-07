import { 
  PDFDocument, 
  rgb, 
  StandardFonts, 
  PDFTextField, 
  PDFCheckBox, 
  PDFDropdown, 
  PDFRadioGroup 
} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { FormElement, InteractiveFormField, PageInfo } from '../types/formFiller';

// Register PDF.js worker using Vite asset URL
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

/**
 * Parses a hex color string (#RRGGBB) into pdf-lib rgb format
 */
export function hexToRgb(hex: string = '#000000') {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
  }
  return rgb(0, 0, 0);
}

/**
 * Sanitizes strings for standard pdf-lib WinAnsi fonts (Helvetica, Times, Courier)
 * to prevent 'WinAnsi cannot encode' runtime crashes on export.
 */
export function sanitizeForWinAnsi(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u2018\u2019]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // smart double quotes
    .replace(/[\u2013\u2014]/g, '-') // en-dash and em-dash
    .replace(/\u2026/g, '...')       // ellipsis
    .replace(/\u2022/g, '*')         // bullet point
    .replace(/[^\x00-\xFF]/g, '?');  // replace unencodable characters with ?
}

/**
 * Normalizes any data URL (PNG, JPEG, canvas) into clean PNG Uint8Array bytes
 * suitable for pdf-lib's embedPng
 */
export async function dataUrlToCleanPngBytes(dataUrl: string): Promise<Uint8Array> {
  // If already clean PNG data URL, decode directly
  if (dataUrl.startsWith('data:image/png;base64,')) {
    const base64Data = dataUrl.replace('data:image/png;base64,', '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Otherwise, render through offscreen image & canvas to get clean PNG bytes
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 100;
        canvas.height = img.naturalHeight || 100;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to create canvas context for image conversion'));
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
    img.onerror = () => reject(new Error('Failed to load image for PDF embedding'));
    img.src = dataUrl;
  });
}

/**
 * Loads and inspects an uploaded PDF document.
 * Returns pristine immutable bytes, page metrics, interactive fields, and a persistent PDF.js proxy.
 */
export async function inspectAndLoadPdf(file: File): Promise<{
  originalBytes: Uint8Array;
  pdfjsDoc: pdfjsLib.PDFDocumentProxy;
  pageCount: number;
  pages: PageInfo[];
  interactiveFields: InteractiveFormField[];
}> {
  const rawBuffer = await file.arrayBuffer();
  // Clone bytes into an isolated Uint8Array so it can NEVER be detached by web workers
  const originalBytes = new Uint8Array(rawBuffer.slice(0));

  if (import.meta.env.DEV) {
    console.log('[PDF Form Filler] Inspecting PDF, size:', originalBytes.byteLength, 'bytes');
  }

  // 1. Verify with pdf-lib to ensure document is valid and non-encrypted
  let pdfLibDoc: PDFDocument;
  try {
    // Pass a copy so originalBytes stays pristine
    pdfLibDoc = await PDFDocument.load(originalBytes.slice(), { ignoreEncryption: false });
  } catch (err: any) {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('password') || msg.includes('encrypt')) {
      throw new Error('This PDF is password-protected. Please remove the password before filling.');
    }
    throw new Error('Could not open PDF file. The document may be corrupted or in an unsupported format.');
  }

  const pageCount = pdfLibDoc.getPageCount();
  if (pageCount === 0) {
    throw new Error('The uploaded PDF contains no pages.');
  }

  // 2. Extract page metrics
  const pages: PageInfo[] = [];
  for (let i = 0; i < pageCount; i++) {
    const page = pdfLibDoc.getPage(i);
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

  // 3. Detect existing AcroForm interactive form fields
  const interactiveFields: InteractiveFormField[] = [];
  try {
    const form = pdfLibDoc.getForm();
    const fields = form.getFields();
    for (const field of fields) {
      const name = field.getName();
      let type: InteractiveFormField['type'] = 'unknown';
      let value: string | boolean = '';
      const readOnly = field.isReadOnly();

      if (field instanceof PDFTextField) {
        type = 'text';
        value = field.getText() || '';
      } else if (field instanceof PDFCheckBox) {
        type = 'checkbox';
        value = field.isChecked();
      } else if (field instanceof PDFDropdown) {
        type = 'dropdown';
        const selected = field.getSelected();
        value = selected ? selected[0] : '';
      } else if (field instanceof PDFRadioGroup) {
        type = 'radio';
        value = field.getSelected() || '';
      }

      interactiveFields.push({
        name,
        type,
        value,
        readOnly,
      });
    }
  } catch {
    // Form fields are optional; safely proceed if not present
  }

  // 4. Initialize persistent PDF.js proxy document for instant workspace and thumbnail rendering
  const loadingTask = pdfjsLib.getDocument({
    data: originalBytes.slice(),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfjsDoc = await loadingTask.promise;

  if (import.meta.env.DEV) {
    console.log('[PDF Form Filler] PDF.js proxy ready, total pages:', pdfjsDoc.numPages);
  }

  return {
    originalBytes,
    pdfjsDoc,
    pageCount,
    pages,
    interactiveFields,
  };
}

/**
 * Renders all page thumbnails using the cached PDF.js document proxy
 */
export async function renderAllThumbnails(
  pdfjsDoc: pdfjsLib.PDFDocumentProxy,
  pageCount: number
): Promise<string[]> {
  const thumbnails: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    try {
      const page = await pdfjsDoc.getPage(i);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const maxDim = 200;
      const scale = Math.min(maxDim / unscaledViewport.height, maxDim / unscaledViewport.width, 1.0);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d', { alpha: false });

      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        thumbnails.push(canvas.toDataURL('image/jpeg', 0.8));
      } else {
        thumbnails.push('');
      }
    } catch {
      thumbnails.push('');
    }
  }
  return thumbnails;
}

/**
 * Renders a specific page directly into a target HTML Canvas element in the DOM
 */
export async function renderPageDirectToCanvas(
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

  if (import.meta.env.DEV) {
    console.log(`[PDF Form Filler] Rendered page ${pageNumber} to canvas: ${canvas.width}x${canvas.height}`);
  }

  return { width: canvas.width, height: canvas.height };
}

/**
 * Exports the filled PDF document by applying overlays and form values
 * to the original, non-rasterized vector PDF.
 */
export async function exportFilledPdf(
  originalBytes: Uint8Array,
  elements: FormElement[],
  interactiveFieldValues?: Record<string, string | boolean>
): Promise<Blob> {
  if (import.meta.env.DEV) {
    console.log('[PDF Form Filler] Exporting PDF with', elements.length, 'overlay elements...');
  }

  // Load a fresh copy from pristine bytes to preserve original pages, vectors, fonts & dimensions
  const pdfDoc = await PDFDocument.load(originalBytes.slice(), { ignoreEncryption: false });

  // Embed standard typography fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const times = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);

  const getFont = (family?: string) => {
    if (family === 'TimesRoman') return times;
    if (family === 'Courier') return courier;
    return helvetica;
  };

  // 1. Update any interactive form fields if present
  if (interactiveFieldValues) {
    try {
      const form = pdfDoc.getForm();
      for (const [name, val] of Object.entries(interactiveFieldValues)) {
        try {
          const field = form.getField(name);
          if (field instanceof PDFTextField && typeof val === 'string') {
            field.setText(sanitizeForWinAnsi(val));
          } else if (field instanceof PDFCheckBox) {
            if (val === true) field.check();
            else field.uncheck();
          }
        } catch {
          // Field might not exist; ignore safely
        }
      }
    } catch {
      // Safe fallback if AcroForm is absent
    }
  }

  // Cache embedded image objects
  const imageEmbedCache = new Map<string, any>();
  const totalPages = pdfDoc.getPageCount();

  // 2. Overlay user elements onto their target pages
  for (const element of elements) {
    if (element.pageIndex < 0 || element.pageIndex >= totalPages) continue;

    const page = pdfDoc.getPage(element.pageIndex);
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Map normalized (0..1) screen coordinates to native PDF points
    // PDF origin (0,0) is bottom-left; Screen origin (0,0) is top-left
    const elemWidth = Math.max(element.width * pageWidth, 4);
    const elemHeight = Math.max(element.height * pageHeight, 4);
    const x = element.x * pageWidth;
    const y = pageHeight - (element.y * pageHeight) - elemHeight;

    if (element.type === 'text' || element.type === 'date') {
      const rawContent = element.text || '';
      if (!rawContent.trim()) continue;

      const content = sanitizeForWinAnsi(rawContent);
      const font = getFont(element.fontFamily);
      const fontSize = element.fontSize || 12;
      const color = hexToRgb(element.color || '#000000');

      const lines = content.split('\n');
      const lineHeight = fontSize * 1.25;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let lineWidth = 0;
        try {
          lineWidth = font.widthOfTextAtSize(line, fontSize);
        } catch {
          lineWidth = line.length * (fontSize * 0.55);
        }

        let adjustedX = x;
        if (element.textAlign === 'center') {
          adjustedX = x + Math.max(0, (elemWidth - lineWidth) / 2);
        } else if (element.textAlign === 'right') {
          adjustedX = x + Math.max(0, elemWidth - lineWidth);
        }

        const lineY = y + elemHeight - (i + 1) * lineHeight;

        try {
          page.drawText(line, {
            x: adjustedX,
            y: lineY,
            size: fontSize,
            font,
            color,
          });
        } catch (textErr) {
          console.warn('[PDF Form Filler] Text draw warning:', textErr);
        }
      }
    } else if (element.type === 'checkbox') {
      const isChecked = element.checked ?? true;
      const style = element.checkboxStyle || 'check';
      const color = hexToRgb(element.color || '#182230');

      // Subtle border box
      page.drawRectangle({
        x,
        y,
        width: elemWidth,
        height: elemHeight,
        borderColor: color,
        borderWidth: 1.2,
        color: rgb(1, 1, 1),
      });

      if (isChecked) {
        if (style === 'check') {
          // Vector checkmark strokes
          const p1x = x + elemWidth * 0.22;
          const p1y = y + elemHeight * 0.52;
          const p2x = x + elemWidth * 0.44;
          const p2y = y + elemHeight * 0.25;
          const p3x = x + elemWidth * 0.82;
          const p3y = y + elemHeight * 0.78;

          const thickness = Math.max(1.8, elemWidth * 0.08);

          page.drawLine({
            start: { x: p1x, y: p1y },
            end: { x: p2x, y: p2y },
            thickness,
            color,
          });

          page.drawLine({
            start: { x: p2x, y: p2y },
            end: { x: p3x, y: p3y },
            thickness,
            color,
          });
        } else if (style === 'cross') {
          const pad = elemWidth * 0.22;
          const thickness = Math.max(1.8, elemWidth * 0.08);
          page.drawLine({
            start: { x: x + pad, y: y + pad },
            end: { x: x + elemWidth - pad, y: y + elemHeight - pad },
            thickness,
            color,
          });
          page.drawLine({
            start: { x: x + pad, y: y + elemHeight - pad },
            end: { x: x + elemWidth - pad, y: y + pad },
            thickness,
            color,
          });
        } else if (style === 'fill') {
          const pad = elemWidth * 0.2;
          page.drawRectangle({
            x: x + pad,
            y: y + pad,
            width: elemWidth - pad * 2,
            height: elemHeight - pad * 2,
            color,
          });
        }
      }
    } else if (element.type === 'signature' || element.type === 'image') {
      if (!element.imageDataUrl) continue;

      let embeddedImage = imageEmbedCache.get(element.imageDataUrl);
      if (!embeddedImage) {
        const cleanPngBytes = await dataUrlToCleanPngBytes(element.imageDataUrl);
        embeddedImage = await pdfDoc.embedPng(cleanPngBytes);
        imageEmbedCache.set(element.imageDataUrl, embeddedImage);
      }

      page.drawImage(embeddedImage, {
        x,
        y,
        width: elemWidth,
        height: elemHeight,
      });
    }
  }

  // 3. Save final PDF document
  const outputBytes = await pdfDoc.save();

  if (!outputBytes || outputBytes.byteLength === 0) {
    throw new Error('PDF generation produced an empty file.');
  }

  // Validate PDF header (%PDF-)
  const header = String.fromCharCode(outputBytes[0], outputBytes[1], outputBytes[2], outputBytes[3], outputBytes[4]);
  if (!header.startsWith('%PDF-')) {
    throw new Error('Generated file does not have a valid PDF header.');
  }

  if (import.meta.env.DEV) {
    console.log('[PDF Form Filler] PDF save complete! Total size:', outputBytes.byteLength, 'bytes');
  }

  // Create valid PDF Blob using standard BlobPart
  return new Blob([outputBytes as BlobPart], { type: 'application/pdf' });
}
