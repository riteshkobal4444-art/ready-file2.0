import { PDFDocument, degrees } from 'pdf-lib';
import { readFileAsArrayBuffer } from '../utils/fileHelpers';

export interface PageRotationMap {
  [pageNumber: number]: number; // pageNumber (1-based) -> additional rotation in degrees (0, 90, 180, 270)
}

/**
 * Permanently applies rotation to specific pages in a PDF document using pdf-lib
 * Preserves all vector graphics, fonts, text, and structure.
 */
export async function applyRotationsToPdf(
  file: File,
  rotations: PageRotationMap
): Promise<Blob> {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();

  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1; // 1-based
    const additionalAngle = rotations[pageNum] || 0;

    if (additionalAngle !== 0) {
      const page = pages[i];
      const existingAngle = page.getRotation().angle || 0;
      const finalAngle = (((existingAngle + additionalAngle) % 360) + 360) % 360;
      page.setRotation(degrees(finalAngle));
    }
  }

  const bytes = await pdfDoc.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}
