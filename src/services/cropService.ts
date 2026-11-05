import { downloadBlob } from '../utils/fileHelpers';

export interface CropRect {
  x: number; // in natural image pixels
  y: number; // in natural image pixels
  width: number; // in natural image pixels
  height: number; // in natural image pixels
}

export interface CropResult {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
}

export interface CropOptions {
  rect: CropRect;
  rotation?: number; // 0, 90, 180, 270
  outputFormat: 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: number; // 0.1 to 1.0 (for jpeg/webp)
}

/**
 * Loads an image from a File or Object URL safely
 */
export function loadImage(src: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let url = '';
    if (typeof src === 'string') {
      url = src;
    } else {
      url = URL.createObjectURL(src);
    }

    img.onload = () => {
      if (typeof src !== 'string') {
        URL.revokeObjectURL(url);
      }
      resolve(img);
    };

    img.onerror = () => {
      if (typeof src !== 'string') {
        URL.revokeObjectURL(url);
      }
      reject(new Error('Failed to load image. The format may be unsupported or corrupted.'));
    };

    img.src = url;
  });
}

/**
 * Perform precision crop and rotation on an HTML image using Canvas
 */
export async function executeCrop(
  imageSource: File | HTMLImageElement,
  options: CropOptions
): Promise<CropResult> {
  const img = imageSource instanceof HTMLImageElement ? imageSource : await loadImage(imageSource);
  const rot = (options.rotation || 0) % 360;

  // Step 1: Render full image rotated to a temp canvas if rotated
  let sourceCanvas: HTMLCanvasElement;
  if (rot !== 0) {
    sourceCanvas = document.createElement('canvas');
    if (rot === 90 || rot === 270) {
      sourceCanvas.width = img.naturalHeight;
      sourceCanvas.height = img.naturalWidth;
    } else {
      sourceCanvas.width = img.naturalWidth;
      sourceCanvas.height = img.naturalHeight;
    }

    const sCtx = sourceCanvas.getContext('2d');
    if (!sCtx) throw new Error('Could not create Canvas context');

    sCtx.translate(sourceCanvas.width / 2, sourceCanvas.height / 2);
    sCtx.rotate((rot * Math.PI) / 180);
    sCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  }

  // Step 2: Now crop from source
  const targetWidth = Math.max(1, Math.round(options.rect.width));
  const targetHeight = Math.max(1, Math.round(options.rect.height));

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = targetWidth;
  cropCanvas.height = targetHeight;
  const ctx = cropCanvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  // Fill white for JPEG when transparent
  if (options.outputFormat === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const source = rot !== 0 ? sourceCanvas! : img;

  ctx.drawImage(
    source,
    Math.round(options.rect.x),
    Math.round(options.rect.y),
    targetWidth,
    targetHeight,
    0,
    0,
    targetWidth,
    targetHeight
  );

  const quality = options.quality !== undefined ? options.quality : 0.92;

  const blob = await new Promise<Blob>((resolve, reject) => {
    cropCanvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to generate cropped image'));
      },
      options.outputFormat,
      quality
    );
  });

  const previewUrl = URL.createObjectURL(blob);

  return {
    blob,
    previewUrl,
    width: targetWidth,
    height: targetHeight,
    fileSize: blob.size,
    mimeType: options.outputFormat,
  };
}
