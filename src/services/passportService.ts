import { loadImage } from './cropService';

export type PassportUnit = 'mm' | 'cm' | 'in' | 'px';

export interface PassportPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  unit: PassportUnit;
  description: string;
}

export const PASSPORT_PRESETS: PassportPreset[] = [
  {
    id: 'schengen-35x45',
    name: '35 × 45 mm (Standard International / Schengen / UK)',
    width: 35,
    height: 45,
    unit: 'mm',
    description: 'Used for UK, European Schengen visas, Australia, New Zealand, India passport',
  },
  {
    id: 'us-2x2',
    name: '2 × 2 inches (51 × 51 mm - US Passport & Visa)',
    width: 2,
    height: 2,
    unit: 'in',
    description: 'Standard square format required by US State Dept, India OCI, and US Visas',
  },
  {
    id: 'id-30x40',
    name: '30 × 40 mm (Standard Photo ID)',
    width: 30,
    height: 40,
    unit: 'mm',
    description: 'Common format for student IDs, driver permits, and company badges',
  },
  {
    id: 'canada-50x70',
    name: '50 × 70 mm (Canadian Passport)',
    width: 50,
    height: 70,
    unit: 'mm',
    description: 'Official size for Canadian passport and citizenship applications',
  },
];

export interface PassportOptions {
  width: number;
  height: number;
  unit: PassportUnit;
  dpi: 300 | 600;
  format: 'image/jpeg' | 'image/png';
  backgroundColor: 'white' | 'light-blue' | 'light-grey' | 'original';
  maxSizeKB?: number;
  cropRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PassportResult {
  blob: Blob;
  previewUrl: string;
  pixelWidth: number;
  pixelHeight: number;
  printWidthMm: number;
  printHeightMm: number;
  fileSize: number;
  mimeType: string;
}

export function convertToPixels(val: number, unit: PassportUnit, dpi: number): number {
  if (unit === 'px') return Math.max(1, Math.round(val));
  if (unit === 'in') return Math.max(1, Math.round(val * dpi));
  if (unit === 'cm') return Math.max(1, Math.round(((val * 10) / 25.4) * dpi));
  // mm
  return Math.max(1, Math.round((val / 25.4) * dpi));
}

export function convertToMm(val: number, unit: PassportUnit): number {
  if (unit === 'mm') return val;
  if (unit === 'cm') return val * 10;
  if (unit === 'in') return val * 25.4;
  // px @ 300 DPI approx
  return Math.round((val / 300) * 25.4);
}

/**
 * Generate a passport photograph with exact physical dimensions and optional file size cap
 */
export async function generatePassportPhoto(
  source: File | HTMLImageElement,
  options: PassportOptions
): Promise<PassportResult> {
  const img = source instanceof HTMLImageElement ? source : await loadImage(source);

  const targetWidth = convertToPixels(options.width, options.unit, options.dpi);
  const targetHeight = convertToPixels(options.height, options.unit, options.dpi);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context error');

  // Background color fill
  if (options.backgroundColor === 'white') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  } else if (options.backgroundColor === 'light-blue') {
    ctx.fillStyle = '#E8F1FC';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  } else if (options.backgroundColor === 'light-grey') {
    ctx.fillStyle = '#F0F2F5';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw cropped region scaled to target canvas
  ctx.drawImage(
    img,
    Math.round(options.cropRect.x),
    Math.round(options.cropRect.y),
    Math.round(options.cropRect.width),
    Math.round(options.cropRect.height),
    0,
    0,
    targetWidth,
    targetHeight
  );

  // If maxSizeKB is set and format is JPEG, iteratively compress
  let quality = 0.95;
  const maxBytes = options.maxSizeKB ? options.maxSizeKB * 1024 : Infinity;

  let blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Export failed'))),
      options.format,
      quality
    );
  });

  if (options.format === 'image/jpeg' && options.maxSizeKB && blob.size > maxBytes) {
    // Loop down quality to fit target size
    while (blob.size > maxBytes && quality > 0.25) {
      quality -= 0.1;
      const nextBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Export failed'))),
          options.format,
          quality
        );
      });
      blob = nextBlob;
    }
  }

  const previewUrl = URL.createObjectURL(blob);
  const printWidthMm = convertToMm(options.width, options.unit);
  const printHeightMm = convertToMm(options.height, options.unit);

  return {
    blob,
    previewUrl,
    pixelWidth: targetWidth,
    pixelHeight: targetHeight,
    printWidthMm: Math.round(printWidthMm * 10) / 10,
    printHeightMm: Math.round(printHeightMm * 10) / 10,
    fileSize: blob.size,
    mimeType: options.format,
  };
}
