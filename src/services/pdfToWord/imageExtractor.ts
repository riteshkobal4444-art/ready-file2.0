/**
 * Image Extractor and Placement Manager for PDF-to-Word Engine.
 * Detects image operators and bounding boxes on PDF pages, extracts high-fidelity
 * image buffers, preserves aspect ratio, and prepares them for DOCX ImageRun insertion.
 */

import * as pdfjsLib from 'pdfjs-dist';
import { ExtractedImageItem } from './types';

interface ImagePlacement {
  id: string;
  x: number; // PDF points (top-down)
  y: number; // PDF points (top-down)
  width: number;
  height: number;
}

/**
 * Extracts embedded images and their page positions from a PDF page.
 */
export async function extractImagesFromPage(
  page: pdfjsLib.PDFPageProxy,
  pageWidthPt: number,
  pageHeightPt: number
): Promise<{ images: ExtractedImageItem[]; warnings: string[] }> {
  const images: ExtractedImageItem[] = [];
  const warnings: string[] = [];

  try {
    const operatorList = await page.getOperatorList();
    const fnArray = operatorList.fnArray;
    const argsArray = operatorList.argsArray;

    // Track graphics state transformation matrix: [a, b, c, d, e, f]
    // PDF coordinate system is [scaleX, skewY, skewX, scaleY, transX, transY]
    let currentMatrix = [1, 0, 0, 1, 0, 0];
    const matrixStack: number[][] = [];
    const imagePlacements: ImagePlacement[] = [];

    const OPS = pdfjsLib.OPS;

    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];
      const args = argsArray[i];

      if (fn === OPS.save) {
        matrixStack.push([...currentMatrix]);
      } else if (fn === OPS.restore) {
        if (matrixStack.length > 0) {
          currentMatrix = matrixStack.pop()!;
        }
      } else if (fn === OPS.transform) {
        // Multiply matrices: currentMatrix = currentMatrix * args
        currentMatrix = multiplyMatrices(currentMatrix, args as number[]);
      } else if (
        fn === OPS.paintImageXObject ||
        fn === OPS.paintInlineImageXObject ||
        fn === OPS.paintImageMaskXObject
      ) {
        const imgId = typeof args?.[0] === 'string' ? args[0] : `img_${i}`;

        // In PDF, an image is drawn in a 1x1 unit square transformed by currentMatrix
        const scaleX = Math.hypot(currentMatrix[0], currentMatrix[1]);
        const scaleY = Math.hypot(currentMatrix[2], currentMatrix[3]);
        const transX = currentMatrix[4];
        const transY = currentMatrix[5];

        const widthPt = Math.round(scaleX);
        const heightPt = Math.round(scaleY);

        // Convert PDF bottom-left to top-down: y_top = pageHeight - transY - heightPt
        const topY = Math.round(pageHeightPt - transY - heightPt);
        const leftX = Math.round(transX);

        // Ignore tiny 1px line artifacts, clipping stencils, or full-page backgrounds
        if (widthPt >= 20 && heightPt >= 20) {
          // Avoid duplicate bounds
          const isDuplicate = imagePlacements.some(
            (p) =>
              Math.abs(p.x - leftX) < 5 &&
              Math.abs(p.y - topY) < 5 &&
              Math.abs(p.width - widthPt) < 5
          );

          if (!isDuplicate) {
            imagePlacements.push({
              id: imgId,
              x: Math.max(0, leftX),
              y: Math.max(0, topY),
              width: Math.min(pageWidthPt, widthPt),
              height: Math.min(pageHeightPt, heightPt),
            });
          }
        }
      }
    }

    if (imagePlacements.length === 0) {
      return { images: [], warnings: [] };
    }

    // Render the page onto a high-res rendering canvas to crop individual image regions cleanly
    // Scale 2.0833 = 150 DPI for sharp images
    const renderScale = 2.0833;
    const viewport = page.getViewport({ scale: renderScale, rotation: page.rotate || 0 });

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = Math.floor(viewport.width);
    pageCanvas.height = Math.floor(viewport.height);
    const pageCtx = pageCanvas.getContext('2d', { alpha: false, willReadFrequently: true });

    if (!pageCtx) {
      warnings.push('Canvas context unavailable for page image extraction.');
      return { images: [], warnings };
    }

    // Render the page
    const renderTask = page.render({
      canvas: pageCanvas,
      canvasContext: pageCtx,
      viewport,
    });
    await renderTask.promise;

    // Crop each detected image placement
    for (const placement of imagePlacements) {
      try {
        const cropX = Math.floor(placement.x * renderScale);
        const cropY = Math.floor(placement.y * renderScale);
        const cropW = Math.min(pageCanvas.width - cropX, Math.floor(placement.width * renderScale));
        const cropH = Math.min(pageCanvas.height - cropY, Math.floor(placement.height * renderScale));

        if (cropW <= 0 || cropH <= 0) continue;

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext('2d');

        if (!cropCtx) continue;

        cropCtx.drawImage(pageCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        const blob = await new Promise<Blob | null>((resolve) => {
          cropCanvas.toBlob(resolve, 'image/jpeg', 0.90);
        });

        // Cleanup crop canvas
        cropCanvas.width = 1;
        cropCanvas.height = 1;

        if (blob) {
          const buffer = await blob.arrayBuffer();
          images.push({
            type: 'image',
            id: placement.id,
            dataBuffer: new Uint8Array(buffer),
            mimeType: 'image/jpeg',
            widthPt: placement.width,
            heightPt: placement.height,
            xPt: placement.x,
            yPt: placement.y,
            originalY: placement.y,
          });
        }
      } catch (err) {
        warnings.push(`Could not extract image ${placement.id}: ${String(err)}`);
      }
    }

    // Cleanup page canvas
    pageCanvas.width = 1;
    pageCanvas.height = 1;
  } catch (err) {
    warnings.push(`Image analysis encountered a non-fatal issue: ${String(err)}`);
  }

  return { images, warnings };
}

/**
 * 2D affine matrix multiplication: [a, b, c, d, e, f]
 */
function multiplyMatrices(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}
