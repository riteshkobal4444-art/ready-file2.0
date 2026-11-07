/**
 * DOCX Document Builder for Stage 1.5.
 * Converts structured reconstructed pages, paragraphs, headings, tables,
 * images, headers, and footers into a compliant Microsoft Word OpenXML (.docx) file.
 * Restores genuine horizontal & vertical table grid lines, merged cells,
 * and correct page orientation.
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  VerticalAlignTable,
  PageOrientation,
  ImageRun,
  Header,
  Footer,
  PageNumber,
  UnderlineType,
  Packer,
} from 'docx';
import {
  ReconstructedPage,
  ReconstructedParagraph,
  ReconstructedTable,
  ExtractedImageItem,
  PageLayoutInfo,
} from './types';

/**
 * Builds and packs the complete Word document.
 */
export async function buildDocxDocument(pages: ReconstructedPage[]): Promise<Blob> {
  const sections: any[] = [];

  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const page = pages[pIdx];
    const layout = page.layout;
    const isLandscape = layout.orientation === 'landscape';

    const rawWidthDxa = Math.round(layout.widthPt * 20);
    const rawHeightDxa = Math.round(layout.heightPt * 20);

    // Microsoft Word OpenXML requirement:
    // Landscape sections MUST have width >= height.
    // Portrait sections MUST have height >= width.
    const sectionWidthDxa = isLandscape ? Math.max(rawWidthDxa, rawHeightDxa) : Math.min(rawWidthDxa, rawHeightDxa);
    const sectionHeightDxa = isLandscape ? Math.min(rawWidthDxa, rawHeightDxa) : Math.max(rawWidthDxa, rawHeightDxa);

    const docxChildren: any[] = [];

    // Order elements by their original vertical Y position to preserve natural flow
    const sortedElements = [...page.elements].sort((a, b) => a.originalY - b.originalY);

    for (const el of sortedElements) {
      if (el.type === 'paragraph') {
        const p = renderParagraph(el);
        if (p) docxChildren.push(p);
      } else if (el.type === 'table') {
        const t = renderTable(el, layout);
        if (t) docxChildren.push(t);
      } else if (el.type === 'image') {
        const img = renderImage(el, layout.widthPt);
        if (img) docxChildren.push(img);
      }
    }

    if (docxChildren.length === 0) {
      docxChildren.push(new Paragraph({ text: '' }));
    }

    // Configure headers and footers for section
    let headerComponent: Header | undefined = undefined;
    let footerComponent: Footer | undefined = undefined;

    if (page.headerText) {
      headerComponent = new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.END,
            spacing: { before: 0, after: 80 },
            children: [
              new TextRun({
                text: page.headerText,
                size: 18, // 9pt
                color: '666666',
                font: 'Calibri',
              }),
            ],
          }),
        ],
      });
    }

    if (page.hasPageNumbers || page.footerText) {
      const footerChildren: any[] = [];

      if (page.footerText && !page.hasPageNumbers) {
        footerChildren.push(
          new TextRun({
            text: page.footerText,
            size: 18,
            color: '666666',
            font: 'Calibri',
          })
        );
      } else {
        footerChildren.push(
          new TextRun({
            text: page.footerText ? `${page.footerText}  |  Page ` : 'Page ',
            size: 18,
            color: '666666',
            font: 'Calibri',
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 18,
            color: '666666',
            font: 'Calibri',
          }),
          new TextRun({
            text: ' of ',
            size: 18,
            color: '666666',
            font: 'Calibri',
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 18,
            color: '666666',
            font: 'Calibri',
          })
        );
      }

      footerComponent = new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 0 },
            children: footerChildren,
          }),
        ],
      });
    }

    sections.push({
      properties: {
        page: {
          size: {
            width: sectionWidthDxa,
            height: sectionHeightDxa,
            orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
          },
          margin: {
            top: layout.margins.topDxa,
            bottom: layout.margins.bottomDxa,
            left: layout.margins.leftDxa,
            right: layout.margins.rightDxa,
          },
        },
      },
      headers: headerComponent ? { default: headerComponent } : undefined,
      footers: footerComponent ? { default: footerComponent } : undefined,
      children: docxChildren,
    });
  }

  const doc = new Document({
    sections,
  });

  return await Packer.toBlob(doc);
}

/**
 * Converts a ReconstructedParagraph into a native docx Paragraph.
 */
function renderParagraph(p: ReconstructedParagraph): Paragraph | null {
  if (p.runs.length === 0) return null;

  const runs = p.runs.map((r) => {
    return new TextRun({
      text: r.text,
      font: r.font,
      size: Math.round(r.size * 2), // Word size is in half-points (11pt = 22)
      bold: r.bold || p.isHeading1 || p.isHeading2,
      italics: r.italic,
      underline: r.underline ? { type: UnderlineType.SINGLE } : undefined,
      color: r.color,
      subScript: r.subScript,
      superScript: r.superScript,
    });
  });

  let heading: (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined = undefined;
  if (p.isHeading1) heading = HeadingLevel.HEADING_1;
  else if (p.isHeading2) heading = HeadingLevel.HEADING_2;
  else if (p.isHeading3) heading = HeadingLevel.HEADING_3;
  else if (p.isHeading4) heading = HeadingLevel.HEADING_4;

  let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.START;
  if (p.alignment === 'center') alignment = AlignmentType.CENTER;
  else if (p.alignment === 'right') alignment = AlignmentType.END;
  else if (p.alignment === 'both') alignment = AlignmentType.BOTH;

  return new Paragraph({
    heading,
    alignment,
    indent: {
      firstLine: p.indentFirstLine,
      left: p.indentLeft,
      right: p.indentRight,
    },
    spacing: {
      before: p.spacingBefore ?? 100,
      after: p.spacingAfter ?? 100,
      line: p.lineSpacing ?? 276,
    },
    children: runs,
  });
}

/**
 * Converts a ReconstructedTable into a native docx Table with full border styling,
 * merged cells, and proportional column widths.
 */
function renderTable(table: ReconstructedTable, layout: PageLayoutInfo): Table | null {
  if (table.rows.length === 0) return null;

  const maxPrintableWidthDxa = Math.max(
    6000,
    Math.round(layout.widthPt * 20 - layout.margins.leftDxa - layout.margins.rightDxa)
  );

  // Calculate total table width from column widths
  const sumColWidths = table.columnWidthsDxa.reduce((sum, w) => sum + w, 0);
  const targetTableWidthDxa = Math.min(maxPrintableWidthDxa, Math.max(5000, sumColWidths));
  const scaleRatio = sumColWidths > 0 ? targetTableWidthDxa / sumColWidths : 1;

  // Scale column widths to fit target table width
  const scaledColWidths = table.columnWidthsDxa.map((w) => Math.max(400, Math.round(w * scaleRatio)));

  const borderColor = table.borderColor || '000000';
  const borderSize = table.borderSize || 4; // 4 = 0.5pt, 8 = 1pt

  // Full border reconstruction: Top, Bottom, Left, Right, Inside Horizontal, Inside Vertical
  const tableBorders = {
    top: table.hasTopBorder
      ? { style: BorderStyle.SINGLE, size: borderSize, color: borderColor }
      : { style: BorderStyle.NONE },
    bottom: table.hasBottomBorder
      ? { style: BorderStyle.SINGLE, size: borderSize, color: borderColor }
      : { style: BorderStyle.NONE },
    left: table.hasLeftBorder
      ? { style: BorderStyle.SINGLE, size: borderSize, color: borderColor }
      : { style: BorderStyle.NONE },
    right: table.hasRightBorder
      ? { style: BorderStyle.SINGLE, size: borderSize, color: borderColor }
      : { style: BorderStyle.NONE },
    insideHorizontal: table.hasInsideHorizontal
      ? { style: BorderStyle.SINGLE, size: borderSize, color: borderColor }
      : { style: BorderStyle.NONE },
    insideVertical: table.hasInsideVertical
      ? { style: BorderStyle.SINGLE, size: borderSize, color: borderColor }
      : { style: BorderStyle.NONE },
  };

  const tableRows: TableRow[] = [];

  for (let rIdx = 0; rIdx < table.rows.length; rIdx++) {
    const rowCells = table.rows[rIdx];
    const isHeaderRow = rIdx === 0 && table.hasHeaderRow;
    const cells: TableCell[] = [];

    for (let c = 0; c < rowCells.length; c++) {
      const cell = rowCells[c];
      if (!cell || cell.isMergedPlaceholder) continue;

      const colSpan = cell.colSpan || 1;
      let cellWidthDxa = 0;
      for (let spanIdx = 0; spanIdx < colSpan; spanIdx++) {
        cellWidthDxa += scaledColWidths[c + spanIdx] || scaledColWidths[0] || 1000;
      }

      let cellAlign: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.START;
      if (cell.alignment === 'right') cellAlign = AlignmentType.END;
      else if (cell.alignment === 'center') cellAlign = AlignmentType.CENTER;

      // Render cell paragraph(s)
      const cellParagraphComponents: Paragraph[] = [];

      if (cell.paragraphs && cell.paragraphs.length > 0) {
        for (const p of cell.paragraphs) {
          const runs = p.runs.map(
            (r) =>
              new TextRun({
                text: r.text,
                bold: isHeaderRow || r.bold,
                italics: r.italic,
                size: Math.round(Math.max(8, r.size) * 2),
                color: r.color,
                font: r.font || 'Calibri',
              })
          );
          cellParagraphComponents.push(
            new Paragraph({
              alignment: cellAlign,
              spacing: { before: 20, after: 20, line: 240 },
              children: runs.length > 0 ? runs : [new TextRun({ text: '' })],
            })
          );
        }
      } else {
        const runs = cell.runs.map(
          (r) =>
            new TextRun({
              text: r.text,
              bold: isHeaderRow || r.bold,
              italics: r.italic,
              size: Math.round(Math.max(8, r.size) * 2),
              color: r.color,
              font: r.font || 'Calibri',
            })
        );
        const fallbackText = runs.length > 0 ? '' : cell.text || '';
        cellParagraphComponents.push(
          new Paragraph({
            alignment: cellAlign,
            spacing: { before: 30, after: 30, line: 240 },
            children:
              runs.length > 0
                ? runs
                : [new TextRun({ text: fallbackText, bold: isHeaderRow, size: 20, font: 'Calibri' })],
          })
        );
      }

      cells.push(
        new TableCell({
          width: {
            size: cellWidthDxa,
            type: WidthType.DXA,
          },
          columnSpan: colSpan > 1 ? colSpan : undefined,
          rowSpan: cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : undefined,
          verticalAlign: VerticalAlignTable.CENTER,
          shading: isHeaderRow ? { fill: 'F4F6FA' } : undefined,
          margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70,
          },
          children: cellParagraphComponents,
        })
      );
    }

    tableRows.push(
      new TableRow({
        tableHeader: isHeaderRow,
        children: cells,
      })
    );
  }

  return new Table({
    width: {
      size: targetTableWidthDxa,
      type: WidthType.DXA,
    },
    borders: tableBorders,
    rows: tableRows,
  });
}

/**
 * Converts an ExtractedImageItem into a native docx ImageRun embedded in a centered Paragraph.
 */
function renderImage(img: ExtractedImageItem, pageWidthPt: number): Paragraph | null {
  if (!img.dataBuffer || img.dataBuffer.length === 0) return null;

  // Calculate pixel dimensions for ImageRun (1 pt = 96/72 px = 1.333 px)
  const maxPrintableWidthPt = pageWidthPt * 0.75;
  let targetWidthPt = img.widthPt;
  let targetHeightPt = img.heightPt;

  if (targetWidthPt > maxPrintableWidthPt) {
    const scale = maxPrintableWidthPt / targetWidthPt;
    targetWidthPt = maxPrintableWidthPt;
    targetHeightPt = targetHeightPt * scale;
  }

  const widthPx = Math.round(targetWidthPt * (96 / 72));
  const heightPx = Math.round(targetHeightPt * (96 / 72));

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [
      new ImageRun({
        type: 'jpg',
        data: img.dataBuffer,
        transformation: {
          width: widthPx,
          height: heightPx,
        },
      }),
    ],
  });
}
