import { PDFDocument } from 'pdf-lib';
import { readFileAsArrayBuffer } from '../utils/fileHelpers';

/**
 * Reorders and filters pages in a PDF document according to an array of 1-based page numbers
 */
export async function reorderPdfPages(
  file: File,
  orderedPageNumbers: number[]
): Promise<Blob> {
  if (orderedPageNumbers.length === 0) {
    throw new Error('The document must have at least one page.');
  }

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const srcDoc = await PDFDocument.load(arrayBuffer);
  const outDoc = await PDFDocument.create();

  const totalPages = srcDoc.getPageCount();
  const validIndices = orderedPageNumbers
    .filter((p) => p >= 1 && p <= totalPages)
    .map((p) => p - 1);

  if (validIndices.length === 0) {
    throw new Error('No valid pages in selection.');
  }

  const copiedPages = await outDoc.copyPages(srcDoc, validIndices);
  for (const page of copiedPages) {
    outDoc.addPage(page);
  }

  const bytes = await outDoc.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}
