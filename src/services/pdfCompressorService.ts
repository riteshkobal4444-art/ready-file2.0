import { PDFDocument } from 'pdf-lib';
import { loadPdfJsDoc, renderPdfPageToCanvas } from './pdfRenderer';
import { readFileAsArrayBuffer } from '../utils/fileHelpers';

export type CompressionPreset = 'recommended' | 'high' | 'custom';

export interface PdfCompressionOptions {
  preset: CompressionPreset;
  quality: number; // 0.1 to 1.0 (for JPEG stream compression)
  dpi: number; // 72, 96, 120, 150, 200
  onProgress?: (current: number, total: number) => void;
}

export interface PdfCompressResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  spaceSaved: number;
  reductionPercentage: number;
  isReductionAchieved: boolean;
  pageCount: number;
}

/**
 * Compresses a PDF document in the browser by optimizing embedded raster content
 * and object streams while preserving page dimensions and orientations.
 */
export async function compressPdf(
  file: File,
  options: PdfCompressionOptions
): Promise<PdfCompressResult> {
  const originalSize = file.size;
  const pdfJsDoc = await loadPdfJsDoc(file);
  const totalPages = pdfJsDoc.numPages;

  // Create clean new PDF Document using pdf-lib
  const newPdf = await PDFDocument.create();

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    if (options.onProgress) {
      options.onProgress(pageNum, totalPages);
    }

    const pdfJsPage = await pdfJsDoc.getPage(pageNum);
    const unscaledViewport = pdfJsPage.getViewport({ scale: 1.0 });
    const originalWidthPt = unscaledViewport.width;
    const originalHeightPt = unscaledViewport.height;

    // Render page at target DPI
    const canvas = await renderPdfPageToCanvas(pdfJsDoc, pageNum, {
      dpi: options.dpi,
    });

    // Convert canvas to compressed JPEG
    const jpegDataUrl = canvas.toDataURL('image/jpeg', options.quality);
    const base64Data = jpegDataUrl.split(',')[1];
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    // Embed into new PDF
    const embeddedImage = await newPdf.embedJpg(imageBytes);

    // Add page matching exact original dimensions in points
    const newPage = newPdf.addPage([originalWidthPt, originalHeightPt]);
    newPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: originalWidthPt,
      height: originalHeightPt,
    });
  }

  // Save new PDF with object streams enabled
  const compressedBytes = await newPdf.save({ useObjectStreams: true });
  const compressedBlob = new Blob([compressedBytes as unknown as BlobPart], { type: 'application/pdf' });
  const compressedSize = compressedBlob.size;

  const isReductionAchieved = compressedSize < originalSize;
  const spaceSaved = isReductionAchieved ? originalSize - compressedSize : 0;
  const reductionPercentage = isReductionAchieved
    ? Math.round((spaceSaved / originalSize) * 100)
    : 0;

  // If the file was not reduced, we can offer the original blob or compressed
  const finalBlob = isReductionAchieved ? compressedBlob : file;

  return {
    blob: finalBlob,
    originalSize,
    compressedSize: isReductionAchieved ? compressedSize : originalSize,
    spaceSaved,
    reductionPercentage,
    isReductionAchieved,
    pageCount: totalPages,
  };
}
