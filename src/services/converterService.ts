import JSZip from 'jszip';
import { loadImage } from './cropService';
import { hasTransparency } from './imageService';

export type OutputFormat = 'jpg' | 'png' | 'webp' | 'bmp' | 'avif';

export interface ConversionItem {
  id: string;
  file: File;
  previewUrl: string;
  sourceFormat: string;
  status: 'idle' | 'converting' | 'done' | 'error';
  convertedBlob?: Blob;
  convertedUrl?: string;
  convertedSize?: number;
  outputFormat?: OutputFormat;
  error?: string;
}

export interface ConvertOptions {
  outputFormat: OutputFormat;
  quality: number; // 0.1 to 1.0
}

/**
 * Checks if browser canvas supports encoding a specific mime type
 */
export function isMimeSupported(mime: string): boolean {
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const url = c.toDataURL(mime);
    return url.startsWith(`data:${mime}`);
  } catch {
    return false;
  }
}

/**
 * Encode a Canvas to standard Windows 24-bit BMP Blob
 */
export function canvasToBmpBlob(canvas: HTMLCanvasElement): Blob {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context for BMP encoding');

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // BMP row size must be a multiple of 4 bytes
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileHeaderSize = 14;
  const infoHeaderSize = 40;
  const fileSize = fileHeaderSize + infoHeaderSize + pixelArraySize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // --- BITMAP FILE HEADER (14 bytes) ---
  // Signature 'BM'
  view.setUint8(0, 0x42);
  view.setUint8(1, 0x4d);
  // File size
  view.setUint32(2, fileSize, true);
  // Reserved
  view.setUint32(6, 0, true);
  // Offset to pixel data
  view.setUint32(10, fileHeaderSize + infoHeaderSize, true);

  // --- BITMAP INFO HEADER (40 bytes) ---
  view.setUint32(14, infoHeaderSize, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive = bottom-to-top
  view.setUint16(26, 1, true); // color planes
  view.setUint16(28, 24, true); // bits per pixel
  view.setUint32(30, 0, true); // no compression (BI_RGB)
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true); // horizontal resolution (~72 DPI)
  view.setInt32(42, 2835, true); // vertical resolution (~72 DPI)
  view.setUint32(46, 0, true); // colors in color table
  view.setUint32(50, 0, true); // important color count

  // --- PIXEL DATA (Bottom-up, BGR format) ---
  let offset = fileHeaderSize + infoHeaderSize;
  for (let y = height - 1; y >= 0; y--) {
    let rowStart = offset;
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      // BMP uses Blue, Green, Red
      view.setUint8(rowStart++, data[srcIdx + 2]); // B
      view.setUint8(rowStart++, data[srcIdx + 1]); // G
      view.setUint8(rowStart++, data[srcIdx + 0]); // R
    }
    // Padding bytes to 4-byte boundary
    while (rowStart % 4 !== 0) {
      view.setUint8(rowStart++, 0);
    }
    offset += rowSize;
  }

  return new Blob([buffer], { type: 'image/bmp' });
}

/**
 * Convert a single image file to the desired output format
 */
export async function convertSingleImage(
  file: File,
  options: ConvertOptions
): Promise<Blob> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context could not be created');

  const isTargetJpg = options.outputFormat === 'jpg';
  const isTargetBmp = options.outputFormat === 'bmp';

  // Check transparency
  const hasAlpha = await hasTransparency(file);

  // Fill white for JPG or BMP if transparency present to avoid black background
  if ((isTargetJpg || isTargetBmp) && hasAlpha) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0);

  // Handle BMP natively
  if (options.outputFormat === 'bmp') {
    return canvasToBmpBlob(canvas);
  }

  // Handle standard MIME types
  let mime = 'image/jpeg';
  if (options.outputFormat === 'png') mime = 'image/png';
  else if (options.outputFormat === 'webp') mime = 'image/webp';
  else if (options.outputFormat === 'avif') {
    if (isMimeSupported('image/avif')) {
      mime = 'image/avif';
    } else {
      // If browser doesn't support encoding AVIF, explain or fallback
      throw new Error('Your browser does not support encoding images to AVIF. Please choose WebP, PNG, or JPG.');
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error(`Failed to convert image to ${options.outputFormat.toUpperCase()}`));
      },
      mime,
      options.quality
    );
  });
}

/**
 * Creates a ZIP file containing all converted images
 */
export async function createConvertedZip(
  items: { filename: string; blob: Blob }[]
): Promise<Blob> {
  const zip = new JSZip();
  for (const item of items) {
    zip.file(item.filename, item.blob);
  }
  return zip.generateAsync({ type: 'blob' });
}
