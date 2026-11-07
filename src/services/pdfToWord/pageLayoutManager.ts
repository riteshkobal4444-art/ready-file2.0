/**
 * Page Layout and Dimension Manager for Stage 1.5.
 * Accurately detects standard and custom page dimensions, handles rotated pages
 * (e.g. 90/270 degrees in commercial invoices and packing lists), maintains portrait
 * and landscape orientations, and sets proper Word section geometry.
 */

import { PageLayoutInfo } from './types';

interface StandardDimension {
  name: 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5';
  widthPt: number;
  heightPt: number;
}

const STANDARD_SIZES: StandardDimension[] = [
  { name: 'A4', widthPt: 595.28, heightPt: 841.89 },
  { name: 'Letter', widthPt: 612.0, heightPt: 792.0 },
  { name: 'Legal', widthPt: 612.0, heightPt: 1008.0 },
  { name: 'A3', widthPt: 841.89, heightPt: 1190.55 },
  { name: 'A5', widthPt: 419.53, heightPt: 595.28 },
];

/**
 * Classifies page dimensions into standard names, visual orientations, and Word margins.
 */
export function classifyPageDimensions(
  visualWidthPt: number,
  visualHeightPt: number,
  pageNumber: number,
  columnCount = 1,
  rotationDegrees = 0
): PageLayoutInfo {
  const isLandscape = visualWidthPt > visualHeightPt;
  const shortSide = Math.min(visualWidthPt, visualHeightPt);
  const longSide = Math.max(visualWidthPt, visualHeightPt);

  let standardSizeName: 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5' | 'Custom' = 'Custom';

  for (const std of STANDARD_SIZES) {
    const stdShort = Math.min(std.widthPt, std.heightPt);
    const stdLong = Math.max(std.widthPt, std.heightPt);

    if (Math.abs(shortSide - stdShort) <= 8 && Math.abs(longSide - stdLong) <= 8) {
      standardSizeName = std.name;
      break;
    }
  }

  // Margin calculation:
  // For Landscape pages (often containing wide multi-column tables/invoices), use 0.5 - 0.75 in (720-1080 dxa)
  // For Portrait pages, use standard 1 in (1440 dxa)
  const isSmallPage = shortSide < 500;
  const marginDxa = isSmallPage ? 720 : isLandscape ? 1080 : 1440;

  // Ensure visual width/height matches orientation
  const finalWidthPt = isLandscape ? longSide : shortSide;
  const finalHeightPt = isLandscape ? shortSide : longSide;

  return {
    pageNumber,
    widthPt: finalWidthPt,
    heightPt: finalHeightPt,
    orientation: isLandscape ? 'landscape' : 'portrait',
    standardSizeName,
    margins: {
      topDxa: marginDxa,
      bottomDxa: marginDxa,
      leftDxa: marginDxa,
      rightDxa: marginDxa,
    },
    columnCount,
    isRotated: rotationDegrees !== 0,
    rotationDegrees,
  };
}
