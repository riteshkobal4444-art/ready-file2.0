export type WatermarkType = 'text' | 'image';

export type WatermarkPosition = 'center' | 'tile';

export type PageSelectionMode = 'all' | 'first' | 'odd' | 'even' | 'custom';

export type WatermarkFontFamily = 'HelveticaBold' | 'Helvetica' | 'TimesRoman' | 'Courier';

export interface WatermarkOptions {
  type: WatermarkType;
  // Text options
  text: string;
  fontSize: number; // 16 to 120
  color: string; // hex string e.g. '#687386'
  fontFamily: WatermarkFontFamily;
  // Image options
  imageDataUrl: string | null;
  imageScale: number; // 0.1 to 0.9 (percentage of page width)
  // Shared options
  opacity: number; // 0.05 to 1.0
  rotation: number; // -90 to 90 degrees
  position: WatermarkPosition; // 'center' | 'tile'
  pageSelection: PageSelectionMode;
  customPageRange: string; // e.g. "1-3, 5"
}

export interface WatermarkPageInfo {
  pageNumber: number; // 1-based
  pageIndex: number; // 0-based
  width: number; // PDF points
  height: number; // PDF points
  rotation: number;
}
