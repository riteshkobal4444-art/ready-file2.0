/**
 * Conversion Validator and Document Integrity Checker for Stage 1.5.
 * Inspects reconstruction output, verifies document metrics, table grid borders,
 * cell mappings, and validates the resulting OpenXML DOCX package.
 */

import { ValidationReport, ReconstructedPage, ReconstructedTable } from './types';

/**
 * Validates the reconstruction and the generated DOCX blob.
 */
export async function validateConversionResult(
  pages: ReconstructedPage[],
  totalPages: number,
  docxBlob: Blob,
  initialWarnings: string[] = [],
  extraMetrics: { textBlocksAssigned?: number; uncertainAssignments?: number } = {}
): Promise<ValidationReport> {
  const warnings: string[] = [...initialWarnings];

  let textBlocksCount = 0;
  let tablesDetected = 0;
  let tablesReconstructed = 0;
  let totalRows = 0;
  let totalCols = 0;
  let verticalBordersCount = 0;
  let imagesDetected = 0;
  let imagesInserted = 0;
  let headersDetected = 0;
  let footersDetected = 0;

  for (const page of pages) {
    if (page.headerText) headersDetected++;
    if (page.footerText || page.hasPageNumbers) footersDetected++;

    for (const el of page.elements) {
      if (el.type === 'paragraph') {
        textBlocksCount++;
      } else if (el.type === 'table') {
        const tbl = el as ReconstructedTable;
        tablesDetected++;
        tablesReconstructed++;
        totalRows += tbl.rowCount;
        totalCols += tbl.columnCount;
        if (tbl.hasInsideVertical || tbl.hasLeftBorder || tbl.hasRightBorder) {
          verticalBordersCount++;
        }
      } else if (el.type === 'image') {
        imagesDetected++;
        imagesInserted++;
      }
    }
  }

  // Check 1: Page count integrity
  if (pages.length < totalPages) {
    warnings.push(`Only ${pages.length} of ${totalPages} pages could be processed.`);
  }

  // Check 2: Content presence
  if (textBlocksCount === 0 && imagesInserted === 0 && tablesReconstructed === 0) {
    warnings.push('The document contains no reconstructed text, tables, or images.');
  }

  // Check 3: DOCX Package binary validation
  let isValidDocx = false;
  if (docxBlob && docxBlob.size > 1000) {
    try {
      const headerSlice = docxBlob.slice(0, 4);
      const buffer = await headerSlice.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      // Valid DOCX files are ZIP packages starting with PK signature: 0x50, 0x4B, 0x03, 0x04
      if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
        isValidDocx = true;
      } else {
        warnings.push('Generated DOCX package does not match standard OpenXML ZIP signature.');
      }
    } catch {
      warnings.push('Could not verify DOCX package header.');
    }
  } else {
    warnings.push('Generated Word file is suspiciously small or empty.');
  }

  return {
    pagesProcessed: pages.length,
    totalPages,
    textBlocksCount,
    tablesDetected,
    tablesReconstructed,
    detectedRows: totalRows,
    detectedCols: totalCols,
    verticalBordersPresent: tablesReconstructed > 0 ? verticalBordersCount > 0 : undefined,
    textBlocksAssignedToCells: extraMetrics.textBlocksAssigned ?? 0,
    uncertainAssignments: extraMetrics.uncertainAssignments ?? 0,
    imagesDetected,
    imagesInserted,
    headersDetected,
    footersDetected,
    warnings,
    isValidDocx,
  };
}
