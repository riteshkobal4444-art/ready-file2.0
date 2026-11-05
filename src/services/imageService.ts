import { getImageDimensions } from '../utils/fileHelpers';

export interface CompressionOptions {
  quality: number; // 0.1 to 1.0
  outputFormat?: 'auto' | 'image/jpeg' | 'image/png' | 'image/webp';
  targetSizeKB?: number; // optional target
}

export interface CompressionResult {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  reductionPercentage: number;
  mimeType: string;
}

export interface ResizeOptions {
  width: number;
  height: number;
  maintainAspectRatio: boolean;
  outputFormat?: 'auto' | 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: number;
}

export interface ResizeResult {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
}

/**
 * Loads an image element safely from a File or Blob
 */
function loadImageElement(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image. The file may be corrupted or in an unsupported format.'));
    };
    img.src = url;
  });
}

/**
 * Checks if an image has alpha transparency
 */
export async function hasTransparency(file: File | Blob): Promise<boolean> {
  if (file.type !== 'image/png' && file.type !== 'image/webp') {
    return false;
  }
  try {
    const img = await loadImageElement(file);
    const canvas = document.createElement('canvas');
    // Sample a smaller thumbnail for speed
    const sampleWidth = Math.min(img.naturalWidth, 200);
    const sampleHeight = Math.min(img.naturalHeight, 200);
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight);
    const imgData = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
    for (let i = 3; i < imgData.length; i += 4) {
      if (imgData[i] < 255) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Compress an image using Browser Canvas
 */
export async function compressImage(
  file: File,
  options: CompressionOptions
): Promise<CompressionResult> {
  const { naturalWidth, naturalHeight } = await getImageDimensions(file).then((d) => ({
    naturalWidth: d.width,
    naturalHeight: d.height,
  }));

  const img = await loadImageElement(file);

  const canvas = document.createElement('canvas');
  canvas.width = naturalWidth;
  canvas.height = naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context could not be created');
  }

  // Determine output format
  let targetMime = file.type || 'image/jpeg';
  if (options.outputFormat && options.outputFormat !== 'auto') {
    targetMime = options.outputFormat;
  } else {
    // If auto, keep PNG if PNG, WebP if WebP, else JPEG
    if (file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/jpeg') {
      targetMime = file.type;
    } else {
      targetMime = 'image/jpeg';
    }
  }

  // Check transparency
  const hasAlpha = await hasTransparency(file);

  // If user selected JPEG for a transparent image, fill canvas with white background so it doesn't turn black
  if (targetMime === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, naturalWidth, naturalHeight);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, naturalWidth, naturalHeight);

  // For PNG, canvas.toBlob ignores quality in many browsers. If user wants smaller PNG and it has transparency,
  // we can use standard toBlob or convert to WebP with alpha if requested.
  // In standard browser canvas, PNG is lossless so toBlob ignores quality argument.
  // We can also allow converting PNG with transparency to WebP for massive reduction if quality is adjusted.
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to generate compressed image blob'));
      },
      targetMime,
      options.quality
    );
  });

  const originalSize = file.size;
  const compressedSize = blob.size;
  const reductionPercentage = Math.round(((originalSize - compressedSize) / originalSize) * 100);

  const previewUrl = URL.createObjectURL(blob);

  return {
    blob,
    previewUrl,
    width: naturalWidth,
    height: naturalHeight,
    originalSize,
    compressedSize,
    reductionPercentage: Number.isFinite(reductionPercentage) ? reductionPercentage : 0,
    mimeType: targetMime,
  };
}

/**
 * Resize an image using Canvas
 */
export async function resizeImage(
  file: File,
  options: ResizeOptions
): Promise<ResizeResult> {
  const img = await loadImageElement(file);

  let targetWidth = Math.max(1, Math.round(options.width));
  let targetHeight = Math.max(1, Math.round(options.height));

  if (options.maintainAspectRatio) {
    const origRatio = img.naturalWidth / img.naturalHeight;
    // Keep width dominant or height dominant
    if (options.width && !options.height) {
      targetHeight = Math.round(targetWidth / origRatio);
    } else if (options.height && !options.width) {
      targetWidth = Math.round(targetHeight * origRatio);
    }
  }

  // Safety caps: max 12000px
  if (targetWidth > 12000 || targetHeight > 12000) {
    throw new Error('Requested dimensions exceed the safe browser canvas limit (12,000 px).');
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context could not be created');
  }

  let targetMime = file.type || 'image/jpeg';
  if (options.outputFormat && options.outputFormat !== 'auto') {
    targetMime = options.outputFormat;
  }

  if (targetMime === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const quality = options.quality !== undefined ? options.quality : 0.92;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to render resized image'));
      },
      targetMime,
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
    mimeType: targetMime,
  };
}
