import { saveAs } from "file-saver";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { RibbonItem, TextItem } from "../types/editor";

function pickFont(fontName: string): any {
  const lower = fontName.toLowerCase();
  if (lower.includes("bold") && lower.includes("italic"))
    return StandardFonts.HelveticaBoldOblique;
  if (lower.includes("bold") && lower.includes("oblique"))
    return StandardFonts.HelveticaBoldOblique;
  if (lower.includes("bold") && lower.includes("times"))
    return StandardFonts.TimesRomanBold;
  if (lower.includes("bold") && lower.includes("serif"))
    return StandardFonts.TimesRomanBold;
  if (
    (lower.includes("italic") || lower.includes("oblique")) &&
    (lower.includes("times") || lower.includes("serif"))
  )
    return StandardFonts.TimesRomanItalic;
  if (lower.includes("times") || lower.includes("serif"))
    return StandardFonts.TimesRoman;
  if (lower.includes("courier") || lower.includes("mono")) {
    if (lower.includes("bold")) return StandardFonts.CourierBold;
    if (lower.includes("italic") || lower.includes("oblique"))
      return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (lower.includes("bold")) return StandardFonts.HelveticaBold;
  if (lower.includes("italic") || lower.includes("oblique"))
    return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

/**
 * Parse a color string to rgb [0-1] triple.
 * Supports: '#rrggbb', '#rgb', 'rgb(r,g,b)'
 */
function parseColor(color: string): [number, number, number] {
  if (color.startsWith("rgb")) {
    const m = color.match(/(\d+)/g);
    if (m && m.length >= 3) {
      return [
        Number.parseInt(m[0]) / 255,
        Number.parseInt(m[1]) / 255,
        Number.parseInt(m[2]) / 255,
      ];
    }
  }
  const clean = color.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = Number.parseInt(full.substring(0, 2), 16);
  const g = Number.parseInt(full.substring(2, 4), 16);
  const b = Number.parseInt(full.substring(4, 6), 16);
  return [
    Number.isNaN(r) ? 1 : r / 255,
    Number.isNaN(g) ? 1 : g / 255,
    Number.isNaN(b) ? 1 : b / 255,
  ];
}

export async function downloadEditedPdf(
  pdfBytes: Uint8Array,
  textItems: Map<number, TextItem[]>,
  ribbonItems: Map<number, RibbonItem[]>,
  fileName: string,
  zoom = 1.0,
): Promise<void> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  const fontCache = new Map<any, any>();
  const getFont = async (sf: any) => {
    if (!fontCache.has(sf)) {
      fontCache.set(sf, await pdfDoc.embedFont(sf));
    }
    return fontCache.get(sf);
  };

  // Process text edits
  for (const [pageIndex, items] of textItems.entries()) {
    const page = pages[pageIndex];
    if (!page) continue;
    const { height: pageHeight } = page.getSize();

    const modifiedItems = items.filter((item) => item.isModified || item.isNew);
    for (const item of modifiedItems) {
      // For existing modified items: use the original PDF transform coordinates
      // transform[4] = x baseline, transform[5] = y baseline (bottom-left origin)
      const pdfX = item.isNew ? item.x / zoom : item.transform[4];

      const pdfY = item.isNew
        ? pageHeight - (item.y + item.height) / zoom
        : item.transform[5];

      // rawFontSize is in PDF points — use directly
      const fontSize = Math.max(item.rawFontSize, 4);
      // Width in PDF points (item.width is in screen pixels at current zoom)
      const rectWidth = Math.max(item.width / zoom, 10);
      // Height coverage — slightly taller than font size for full coverage
      const rectHeight = fontSize * 1.5;

      if (!item.isNew) {
        // Cover original text with background rectangle
        const [cr, cg, cb] = item.backgroundColor
          ? parseColor(item.backgroundColor)
          : [1, 1, 1];
        page.drawRectangle({
          x: pdfX - 1,
          y: pdfY - fontSize * 0.3,
          width: rectWidth + 2,
          height: rectHeight,
          color: rgb(cr, cg, cb),
          opacity: 1,
        });
      }

      if (item.text.trim()) {
        const standardFont = pickFont(item.fontName);
        const font = await getFont(standardFont);
        page.drawText(item.text, {
          x: pdfX,
          y: pdfY,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }
    }
  }

  // Process ribbon items
  for (const [pageIndex, ribbons] of ribbonItems.entries()) {
    const page = pages[pageIndex];
    if (!page) continue;
    const { height: pageHeight } = page.getSize();

    for (const ribbon of ribbons) {
      if (!ribbon.text.trim()) continue;

      // ribbon.x/y/width/height are in screen pixels — convert to PDF points
      const pdfRibbonX = ribbon.x / zoom;
      const pdfRibbonWidth = ribbon.width / zoom;
      const pdfRibbonHeight = ribbon.height / zoom;
      const pdfRibbonY = pageHeight - (ribbon.y + ribbon.height) / zoom;

      // Draw background rectangle using sampled color
      const [rr, rg, rb] = parseColor(ribbon.backgroundColor);
      page.drawRectangle({
        x: pdfRibbonX,
        y: Math.max(0, pdfRibbonY),
        width: pdfRibbonWidth,
        height: Math.max(pdfRibbonHeight, 4),
        color: rgb(rr, rg, rb),
        opacity: 1,
      });

      // Draw text on top — font size in PDF points
      const fontKey =
        ribbon.fontFamily +
        (ribbon.fontWeight === "bold" ? "-bold" : "") +
        (ribbon.fontStyle === "italic" ? "-italic" : "");
      const sf = pickFont(fontKey);
      const font = await getFont(sf);
      const fontSize = Math.max(ribbon.fontSize / zoom, 4);

      page.drawText(ribbon.text, {
        x: pdfRibbonX + 2,
        y: Math.max(0, pdfRibbonY) + pdfRibbonHeight * 0.2,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
        maxWidth: pdfRibbonWidth - 4,
      });
    }
  }

  const outBytes = await pdfDoc.save();
  const blob = new Blob([outBytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const outName = fileName ? `edited-${fileName}` : "edited-document.pdf";
  saveAs(blob, outName);
}
