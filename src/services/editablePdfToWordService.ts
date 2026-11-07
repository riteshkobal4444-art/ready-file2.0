/**
 * Advanced Editable Word Service (Mode A).
 * Reconstructs selectable text, multi-columns, headings, bold/italic styles,
 * tables, embedded images, headers, and footers as native, editable Microsoft Word elements.
 * Powered by Stage 1 Professional Document Reconstruction Engine.
 */

import { runProfessionalStage1Engine } from './pdfToWord/engine';
import { Stage1Progress } from './pdfToWord/types';

export interface EditableProgress {
  stage:
    | 'reading'
    | 'analyzing'
    | 'extracting_images'
    | 'reconstructing_text'
    | 'detecting_tables'
    | 'header_footer'
    | 'building_docx'
    | 'validating'
    | 'ready';
  message: string;
  currentPage?: number;
  totalPages?: number;
}

export interface EditableConvertResult {
  blob: Blob;
  pageCount: number;
  mode: 'editable';
  textCount: number;
  tablesDetected: number;
  tablesReconstructed: number;
  detectedRows?: number;
  detectedCols?: number;
  verticalBordersPresent?: boolean;
  textBlocksAssignedToCells?: number;
  imagesDetected: number;
  imagesInserted: number;
  textBlocksCount: number;
  headersDetected: number;
  footersDetected: number;
  warnings: string[];
  isScanned?: boolean;
}

/**
 * Converts a PDF into an advanced editable Microsoft Word document.
 */
export async function convertPdfToWordEditable(
  file: File,
  onProgress?: (progress: EditableProgress) => void
): Promise<EditableConvertResult> {
  const result = await runProfessionalStage1Engine(file, (p: Stage1Progress) => {
    onProgress?.({
      stage: p.stage,
      message: p.message,
      currentPage: p.currentPage,
      totalPages: p.totalPages,
    });
  });

  return {
    blob: result.blob,
    pageCount: result.pageCount,
    mode: 'editable',
    textCount: result.textCount,
    tablesDetected: result.validation.tablesDetected,
    tablesReconstructed: result.validation.tablesReconstructed,
    detectedRows: result.validation.detectedRows,
    detectedCols: result.validation.detectedCols,
    verticalBordersPresent: result.validation.verticalBordersPresent,
    textBlocksAssignedToCells: result.validation.textBlocksAssignedToCells,
    imagesDetected: result.validation.imagesDetected,
    imagesInserted: result.validation.imagesInserted,
    textBlocksCount: result.validation.textBlocksCount,
    headersDetected: result.validation.headersDetected,
    footersDetected: result.validation.footersDetected,
    warnings: result.validation.warnings,
    isScanned: result.isScanned,
  };
}
