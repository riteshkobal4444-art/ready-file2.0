/**
 * Stage 1.5 Professional Document Reconstruction Engine.
 * Master coordinator orchestrating PDF loading, layout analysis, vector drawing extraction,
 * table grid reconstruction, text-to-cell mapping, font mapping, reading order,
 * paragraph reconstruction, image/signature extraction, header/footer isolation,
 * DOCX assembly, and validation.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { readFileAsArrayBuffer } from '../../utils/fileHelpers';
import { validatePdfFile } from '../pdfToWordService';
import {
  Stage1EngineResult,
  Stage1Progress,
  ReconstructedPage,
  DocumentBodyElement,
  PDFCharItem,
} from './types';
import { classifyPageDimensions } from './pageLayoutManager';
import { groupItemsIntoLines, analyzeReadingOrder } from './readingOrderAnalyzer';
import { extractHeaderFooter } from './headerFooterDetector';
import { extractVectorLinesFromPage } from './tableDrawingExtractor';
import { detectTablesOnPage } from './tableDetector';
import { mapTextItemsToTableCells } from './textToCellMapper';
import { reconstructParagraphs } from './paragraphReconstructor';
import { extractImagesFromPage } from './imageExtractor';
import { buildDocxDocument } from './docxDocumentBuilder';
import { validateConversionResult } from './conversionValidator';

// Ensure PDF.js worker is registered
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Executes the Stage 1.5 Professional Document Reconstruction Engine.
 */
export async function runProfessionalStage1Engine(
  file: File,
  onProgress?: (progress: Stage1Progress) => void
): Promise<Stage1EngineResult> {
  const validation = await validatePdfFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid PDF file.');
  }

  onProgress?.({
    stage: 'reading',
    message: 'Reading PDF document structure...',
  });

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  if (totalPages === 0) {
    await pdfDoc.cleanup();
    throw new Error('This PDF contains no pages.');
  }

  const reconstructedPages: ReconstructedPage[] = [];
  const engineWarnings: string[] = [];
  let totalExtractedChars = 0;
  let totalAssignedToCells = 0;
  let totalUncertainAssignments = 0;
  const allFontSizes: number[] = [];

  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      onProgress?.({
        stage: 'analyzing',
        message: `Analyzing page geometry & orientation (${pageNum}/${totalPages})...`,
        currentPage: pageNum,
        totalPages,
      });

      const page = await pdfDoc.getPage(pageNum);
      const rotation = page.rotate || 0;
      const viewport = page.getViewport({ scale: 1.0, rotation });
      const visualWidthPt = viewport.width;
      const visualHeightPt = viewport.height;

      // 1. Extract and Normalize Text Items using Viewport Transformations
      // convertToViewportPoint ensures rotated pages (90/270 degrees) produce upright visual coordinates
      const textContent = await page.getTextContent();
      const rawCharItems: PDFCharItem[] = [];

      for (const item of textContent.items) {
        if ('str' in item && typeof item.str === 'string') {
          const str = item.str;
          if (str.length === 0) continue;

          const transform = item.transform;
          const fontSize = Math.max(
            8,
            Math.round(Math.hypot(transform[0], transform[1]) || Math.abs(transform[3]) || 11)
          );
          const width = item.width || 0;
          const height = item.height || fontSize;
          const fontName = item.fontName || '';
          const hasEOL = Boolean((item as { hasEOL?: boolean }).hasEOL);

          // Map PDF user space point to visual viewport coordinates
          const [vx1, vy1] = viewport.convertToViewportPoint(transform[4], transform[5]);
          const [vx2, vy2] = viewport.convertToViewportPoint(
            transform[4] + (width || fontSize * 0.6),
            transform[5] + height
          );

          const normX = Math.min(vx1, vx2);
          const normY = Math.min(vy1, vy2);
          const normW = Math.max(1, Math.abs(vx2 - vx1));
          const normH = Math.max(fontSize, Math.abs(vy2 - vy1));

          rawCharItems.push({
            str,
            x: Math.max(0, normX),
            y: Math.max(0, normY),
            width: normW,
            height: normH,
            fontSize,
            fontName,
            hasEOL,
            transform,
          });

          allFontSizes.push(fontSize);
          totalExtractedChars += str.trim().length;
        }
      }

      const medianFontSize = calculateMedian(allFontSizes) || 11;

      // 2. Extract Vector Drawing Geometry (Horizontal and Vertical Lines)
      onProgress?.({
        stage: 'detecting_tables',
        message: `Extracting vector grid lines & table geometry (${pageNum}/${totalPages})...`,
        currentPage: pageNum,
        totalPages,
      });

      const { horizontalLines, verticalLines } = await extractVectorLinesFromPage(page, viewport);

      // 3. Detect Table Grids combining Vector Lines and Text Coordinates
      const detectedTables = detectTablesOnPage(
        horizontalLines,
        verticalLines,
        rawCharItems,
        visualWidthPt,
        visualHeightPt
      );

      // 4. Map Text Items directly into Table Cells
      // Consumes table text items so product rows are never separated as stray body paragraphs
      const mappingResult = mapTextItemsToTableCells(
        detectedTables,
        rawCharItems,
        medianFontSize
      );

      totalAssignedToCells += mappingResult.textBlocksAssigned;
      totalUncertainAssignments += mappingResult.uncertainAssignments;

      // 5. Extract Embedded Images & Signatures
      onProgress?.({
        stage: 'extracting_images',
        message: `Extracting images and signature graphics (${pageNum}/${totalPages})...`,
        currentPage: pageNum,
        totalPages,
      });

      const { images, warnings: imgWarnings } = await extractImagesFromPage(
        page,
        visualWidthPt,
        visualHeightPt
      );
      engineWarnings.push(...imgWarnings);

      // 6. Process Remaining Body Items (Content outside of tables: Headers, Consignee, Footers)
      onProgress?.({
        stage: 'reconstructing_text',
        message: `Reconstructing document paragraphs & structure (${pageNum}/${totalPages})...`,
        currentPage: pageNum,
        totalPages,
      });

      const bodyLines = groupItemsIntoLines(mappingResult.remainingBodyItems, visualHeightPt);
      const readingLayout = analyzeReadingOrder(bodyLines, visualWidthPt, visualHeightPt);

      // 7. Header & Footer Detection on Non-Table Content
      onProgress?.({
        stage: 'header_footer',
        message: `Isolating headers, footers & page numbering (${pageNum}/${totalPages})...`,
        currentPage: pageNum,
        totalPages,
      });

      const headerFooter = extractHeaderFooter(readingLayout.orderedLines, visualHeightPt);

      // 8. Reconstruct Body Paragraphs
      const bodyParagraphs = reconstructParagraphs(
        headerFooter.filteredBodyLines,
        visualWidthPt,
        medianFontSize
      );

      // 9. Combine All Page Elements (Tables, Paragraphs, Images) sorted by vertical position
      const pageBodyElements: DocumentBodyElement[] = [
        ...mappingResult.reconstructedTables,
        ...bodyParagraphs,
        ...images,
      ];

      // 10. Classify Page Geometry & Orientation
      const layout = classifyPageDimensions(
        visualWidthPt,
        visualHeightPt,
        pageNum,
        readingLayout.columnCount,
        rotation
      );

      reconstructedPages.push({
        pageNumber: pageNum,
        layout,
        elements: pageBodyElements,
        headerText: headerFooter.headerLine
          ? headerFooter.headerLine.items.map((it) => it.str).join('').trim()
          : undefined,
        footerText: headerFooter.footerLine
          ? headerFooter.footerLine.items.map((it) => it.str).join('').trim()
          : undefined,
        hasPageNumbers: headerFooter.hasPageNumber,
      });
    }
  } finally {
    try {
      await pdfDoc.cleanup();
    } catch {
      // Ignore cleanup error
    }
  }

  // Scanned document detection check
  if (totalExtractedChars < 25) {
    const isImageOnly = reconstructedPages.some((p) => p.elements.some((el) => el.type === 'image'));
    if (!isImageOnly) {
      return {
        blob: new Blob([], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
        pageCount: totalPages,
        textCount: totalExtractedChars,
        validation: {
          pagesProcessed: totalPages,
          totalPages,
          textBlocksCount: 0,
          tablesDetected: 0,
          tablesReconstructed: 0,
          imagesDetected: 0,
          imagesInserted: 0,
          headersDetected: 0,
          footersDetected: 0,
          warnings: ['This PDF appears to be a scanned image document without selectable text.'],
          isValidDocx: false,
        },
        isScanned: true,
      };
    }
  }

  // 11. Compile DOCX Package
  onProgress?.({
    stage: 'building_docx',
    message: 'Compiling editable Word document with reconstructed tables & borders...',
    currentPage: totalPages,
    totalPages,
  });

  const docxBlob = await buildDocxDocument(reconstructedPages);

  // 12. Validate Output Integrity
  onProgress?.({
    stage: 'validating',
    message: 'Validating OpenXML table structures and borders...',
    currentPage: totalPages,
    totalPages,
  });

  const validationReport = await validateConversionResult(
    reconstructedPages,
    totalPages,
    docxBlob,
    engineWarnings,
    {
      textBlocksAssigned: totalAssignedToCells,
      uncertainAssignments: totalUncertainAssignments,
    }
  );

  onProgress?.({
    stage: 'ready',
    message: 'Editable Word document ready.',
  });

  return {
    blob: docxBlob,
    pageCount: totalPages,
    textCount: totalExtractedChars,
    validation: validationReport,
    isScanned: false,
  };
}

function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 11;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
