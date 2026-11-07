export type FormElementType = 'text' | 'date' | 'checkbox' | 'signature' | 'image';

export type CheckboxStyle = 'check' | 'cross' | 'fill';

export type FontFamily = 'Helvetica' | 'TimesRoman' | 'Courier';

export interface FormElement {
  id: string;
  type: FormElementType;
  pageIndex: number; // 0-based page index
  // Normalized 0..1 bounding box relative to PDF page dimensions
  x: number; // 0..1
  y: number; // 0..1
  width: number; // 0..1
  height: number; // 0..1
  
  // Text & Date properties
  text?: string;
  fontSize?: number; // In points (default ~12)
  fontFamily?: FontFamily;
  color?: string; // hex string e.g. '#000000'
  textAlign?: 'left' | 'center' | 'right';
  dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  
  // Checkbox properties
  checked?: boolean;
  checkboxStyle?: CheckboxStyle;
  
  // Image & Signature properties
  imageDataUrl?: string; // Base64 data URL
  aspectRatio?: number; // width / height
}

export interface InteractiveFormField {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'unknown';
  value: string | boolean;
  pageIndex?: number;
  readOnly?: boolean;
}

export interface PageInfo {
  pageNumber: number; // 1-based
  pageIndex: number; // 0-based
  width: number; // PDF points
  height: number; // PDF points
  rotation: number;
  thumbnailUrl?: string;
}

export type EditorTool = 'select' | 'text' | 'date' | 'checkbox' | 'signature' | 'image';

export interface FormFillerState {
  file: File | null;
  fileBuffer: ArrayBuffer | null;
  fileName: string;
  fileSize: number;
  pageCount: number;
  pages: PageInfo[];
  currentPageIndex: number;
  zoomScale: number; // 0.5 to 2.5 (1.0 = 100%)
  elements: FormElement[];
  selectedElementId: string | null;
  interactiveFields: InteractiveFormField[];
  hasInteractiveFields: boolean;
  history: FormElement[][];
  historyIndex: number;
  isProcessing: boolean;
  exportResultBlob: Blob | null;
  exportResultUrl: string | null;
  errorMessage: string | null;
}
