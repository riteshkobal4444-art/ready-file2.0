export interface SignaturePoint {
  x: number;
  y: number;
}

export interface SignatureStroke {
  points: SignaturePoint[];
  color: string;
  width: number;
}

export const SIGNATURE_FONTS = [
  { id: 'dancing-script', name: 'Dancing Script', font: "'Dancing Script', cursive" },
  { id: 'caveat', name: 'Caveat', font: "'Caveat', cursive" },
  { id: 'great-vibes', name: 'Great Vibes', font: "'Great Vibes', cursive" },
  { id: 'sacramento', name: 'Sacramento', font: "'Sacramento', cursive" },
  { id: 'marck-script', name: 'Marck Script', font: "'Marck Script', cursive" },
];

export const SIGNATURE_COLORS = [
  { name: 'Dark Ink', hex: '#182230' },
  { name: 'Royal Blue', hex: '#2451CD' },
  { name: 'Classic Navy', hex: '#1E3A8A' },
  { name: 'Deep Burgundy', hex: '#8B0000' },
  { name: 'Forest Green', hex: '#006A47' },
];

/**
 * Renders an array of drawn strokes onto a Canvas
 */
export function renderStrokesToCanvas(
  canvas: HTMLCanvasElement,
  strokes: SignatureStroke[],
  backgroundColor: 'transparent' | 'white' = 'transparent'
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (backgroundColor === 'white') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const stroke of strokes) {
    if (stroke.points.length < 1) continue;

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;

    if (stroke.points.length === 1) {
      // Single dot
      ctx.beginPath();
      ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color;
      ctx.fill();
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      const p1 = stroke.points[i - 1];
      const p2 = stroke.points[i];
      const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
    }

    const lastPoint = stroke.points[stroke.points.length - 1];
    ctx.lineTo(lastPoint.x, lastPoint.y);
    ctx.stroke();
  }
}

/**
 * Trims transparent margins around signature for clean bounds
 */
export function trimCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let minX = w, minY = h, maxX = 0, maxY = 0;
  let hasContent = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const alpha = data[idx + 3];
      // If not completely transparent and not pure white
      if (alpha > 10) {
        hasContent = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasContent) return canvas;

  // Add a small 20px padding
  const pad = 24;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w, maxX + pad);
  maxY = Math.min(h, maxY + pad);

  const trimmedWidth = maxX - minX;
  const trimmedHeight = maxY - minY;

  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = trimmedWidth;
  trimmedCanvas.height = trimmedHeight;
  const tCtx = trimmedCanvas.getContext('2d');
  if (!tCtx) return canvas;

  tCtx.drawImage(canvas, minX, minY, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);
  return trimmedCanvas;
}

/**
 * Renders typed text signature onto Canvas
 */
export async function renderTypedSignature(
  text: string,
  fontFamily: string,
  fontSize: number,
  color: string,
  backgroundColor: 'transparent' | 'white'
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  if (backgroundColor === 'white') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Set font
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText(text || 'Your Signature', canvas.width / 2, canvas.height / 2);

  return trimCanvas(canvas);
}

/**
 * Process uploaded paper signature to extract transparent ink
 */
export async function extractPaperSignature(
  imageSource: HTMLImageElement,
  threshold: number = 190, // threshold for white paper vs dark ink (0-255)
  inkColor: string | null = null,
  backgroundColor: 'transparent' | 'white' = 'transparent'
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = imageSource.naturalWidth;
  canvas.height = imageSource.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas error');

  ctx.drawImage(imageSource, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;

  // Convert hex color to rgb if provided
  let targetR = 24, targetG = 34, targetB = 48; // default dark ink
  if (inkColor && inkColor.startsWith('#')) {
    const hex = inkColor.replace('#', '');
    targetR = parseInt(hex.substring(0, 2), 16) || 0;
    targetG = parseInt(hex.substring(2, 4), 16) || 0;
    targetB = parseInt(hex.substring(4, 6), 16) || 0;
  }

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    if (luminance >= threshold) {
      // Paper background -> transparent or white
      if (backgroundColor === 'transparent') {
        d[i + 3] = 0; // alpha 0
      } else {
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
        d[i + 3] = 255;
      }
    } else {
      // Ink pixel: calculate smoothness alpha
      const alphaVal = Math.min(255, Math.max(0, Math.round(((threshold - luminance) / threshold) * 255 * 1.5)));
      d[i] = targetR;
      d[i + 1] = targetG;
      d[i + 2] = targetB;
      d[i + 3] = alphaVal;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return trimCanvas(canvas);
}
