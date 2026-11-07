/**
 * Common types and data models for the Professional PDF-to-Word Engine (Stage 1.5).
 */

export interface BoundingBox {
  x: number;
  y: number; // Top-down coordinate space in PDF points
  width: number;
  height: number;
}

export interface PDFCharItem {
  str: string;
  x: number;
  y: number; // Top-down normalized
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  hasEOL: boolean;
  transform: number[];
  colorHex?: string;
}

export interface VectorLine {
  isVertical: boolean;
  coord: number; // x for vertical line, y for horizontal line
  start: number; // yMin for vertical line, xMin for horizontal line
  end: number;   // yMax for vertical line, xMax for horizontal line
  strokeWidth: number;
  colorHex: string;
}

export interface ReconstructedRun {
  text: string;
  font: string;
  size: number; // in pt
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color?: string; // Hex string e.g. "1A1A1A"
  subScript?: boolean;
  superScript?: boolean;
}

export type TextAlignment = 'left' | 'center' | 'right' | 'both';

export interface ReconstructedParagraph {
  type: 'paragraph';
  runs: ReconstructedRun[];
  alignment: TextAlignment;
  isHeading1?: boolean;
  isHeading2?: boolean;
  isHeading3?: boolean;
  isHeading4?: boolean;
  isListItem?: boolean;
  listBullet?: string;
  indentFirstLine?: number; // in dxa
  indentLeft?: number; // in dxa
  indentRight?: number; // in dxa
  spacingBefore?: number; // in dxa
  spacingAfter?: number; // in dxa
  lineSpacing?: number; // in dxa
  columnIndex?: number;
  originalY: number;
}

export interface ReconstructedCell {
  text: string;
  runs: ReconstructedRun[];
  paragraphs?: ReconstructedParagraph[];
  alignment: TextAlignment;
  isHeader?: boolean;
  colSpan?: number;
  rowSpan?: number;
  isMergedPlaceholder?: boolean;
  widthDxa?: number;
  boundingBox?: BoundingBox;
}

export interface ReconstructedTable {
  type: 'table';
  rows: ReconstructedCell[][];
  columnWidthsDxa: number[];
  hasHeaderRow: boolean;
  rowCount: number;
  columnCount: number;
  originalY: number;
  boundingBox: BoundingBox;
  // Border presence & styling
  hasTopBorder: boolean;
  hasBottomBorder: boolean;
  hasLeftBorder: boolean;
  hasRightBorder: boolean;
  hasInsideHorizontal: boolean;
  hasInsideVertical: boolean;
  borderColor: string;
  borderSize: number;
}

export interface ExtractedImageItem {
  type: 'image';
  id: string;
  dataBuffer: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png';
  widthPt: number;
  heightPt: number;
  xPt: number;
  yPt: number; // Top-down normalized
  caption?: string;
  originalY: number;
}

export type DocumentBodyElement =
  | ReconstructedParagraph
  | ReconstructedTable
  | ExtractedImageItem;

export interface PageLayoutInfo {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  orientation: 'portrait' | 'landscape';
  standardSizeName: 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5' | 'Custom';
  margins: {
    topDxa: number;
    bottomDxa: number;
    leftDxa: number;
    rightDxa: number;
  };
  columnCount: number;
  isRotated?: boolean;
  rotationDegrees?: number;
}

export interface ReconstructedPage {
  pageNumber: number;
  layout: PageLayoutInfo;
  elements: DocumentBodyElement[];
  headerText?: string;
  footerText?: string;
  hasPageNumbers?: boolean;
}

export interface ValidationReport {
  pagesProcessed: number;
  totalPages: number;
  textBlocksCount: number;
  tablesDetected: number;
  tablesReconstructed: number;
  detectedRows?: number;
  detectedCols?: number;
  textBlocksAssignedToCells?: number;
  uncertainAssignments?: number;
  verticalBordersPresent?: boolean;
  imagesDetected: number;
  imagesInserted: number;
  headersDetected: number;
  footersDetected: number;
  warnings: string[];
  isValidDocx: boolean;
}

export interface Stage1EngineResult {
  blob: Blob;
  pageCount: number;
  textCount: number;
  validation: ValidationReport;
  isScanned: boolean;
}

export interface Stage1Progress {
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
