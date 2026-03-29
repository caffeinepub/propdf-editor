# ProPDF Editor — Complete Rebuild

## Current State

The app has a full editor structure with PDF viewing, text editing, ribbon overlay, annotations, merge/split, export, OCR. However, several critical bugs make it unreliable:

1. **Missing dependencies**: `pdf-lib`, `pdfjs-dist`, `tesseract.js`, `file-saver`, `docx`, `xlsx`, `pptxgenjs`, `jszip` are imported but not listed in `package.json` — build may fail or produce broken bundles.
2. **Zoom + text coordinate bug**: Text items are extracted once (`if (!textItems.has(pageIndex))` guard prevents re-extraction). When zoom changes, canvas re-renders but all overlay positions are stale. Text overlays misalign.
3. **Font size bug**: `item.fontSize * 0.9` is used but `item.fontSize` stores the raw PDF height in points, not CSS pixels. The correct display size is `item.fontSize * zoom`. The overlay text appears smaller than the original.
4. **Background coverage**: Modified text overlays use a hardcoded `white` background. On colored, aged, or scanned documents, original text bleeds through.
5. **Undo/redo non-reactive**: `canUndo`/`canRedo` are computed from `.current` refs and never trigger re-renders, so toolbar buttons never enable/disable correctly.
6. **No PWA manifest/service worker**: App claims to be offline-capable but is missing the PWA install infrastructure.

## Requested Changes (Diff)

### Add
- All missing npm dependencies to `package.json`: `pdf-lib`, `pdfjs-dist`, `tesseract.js`, `file-saver`, `jszip`, `docx`, `xlsx`, `pptxgenjs` (all well-tested browser-compatible versions)
- Canvas background sampling for text overlays: when a text item becomes modified, sample the canvas pixels at the item's location and set the overlay background to the sampled color
- PWA manifest and service worker for offline install capability
- Page reorder via drag-and-drop in the page panel
- Find & Replace functionality (Ctrl+F to find text, replace with new text across all pages)

### Modify
- **Text item extraction**: Remove the `if (!textItems.has(pageIndex))` guard. Re-extract text items (with updated screen coords) on every zoom change. Store `rawFontSize` (unscaled, from zoom=1 viewport) and compute display font size as `rawFontSize * zoom`.
- **Text overlay font size**: Use `rawFontSize * zoom` for the CSS `font-size` of text overlays, so they match the canvas rendering at every zoom level.
- **TextOverlayItem background**: When `isModified` is true, sample the canvas at the item's screen rect (a 6x6 area centered on the item's midpoint) and average the RGBA to produce a `backgroundColor` for the overlay. Store this in `TextItem.backgroundColor`. Default to `#ffffff` only if sampling fails or for newly added items.
- **Undo/redo canUndo/canRedo**: Replace the ref-based tracking with two `useState` counters (`undoCount`, `redoCount`) that are incremented/decremented whenever stacks change. Derive `canUndo = undoCount > 0` and `canRedo = redoCount > 0`.
- **RibbonOverlay**: Add vertical drag resize (drag top/bottom edge to change height), not just left/right width resize. Also support moving the ribbon by dragging the center.
- **Download PDF (pdfDownload.ts)**: Fix Y-coordinate flip. Currently uses `ribbon.y` directly but PDF coordinates are bottom-origin. Must convert: `pdfY = pageHeight - (ribbon.y + ribbon.height)`. Same fix for text items: ensure the white background rect and the text draw at exactly the same coordinates.
- **EditorContext**: Fix `canUndo`/`canRedo` to be state-derived, not ref-derived.

### Remove
- Nothing to remove — keep all existing features

## Implementation Plan

1. **package.json**: Add all missing dependencies with correct browser-compatible versions.
2. **types/editor.ts**: Add `rawFontSize?: number` and `backgroundColor?: string` fields to `TextItem`.
3. **context/EditorContext.tsx**: Replace ref-based `undoCount`/`redoCount` tracking with state counters. Fix `canUndo`/`canRedo`.
4. **PDFCanvas.tsx**:
   - Remove the `has()` guard — always re-extract text on page render
   - Store `rawFontSize = item.height` (zoom=1 height), compute display fontSize as `rawFontSize * zoom`
   - After page renders, for any already-modified text item, call canvas sampling to set `backgroundColor`
   - In `TextOverlayItem`: use `item.backgroundColor ?? '#ffffff'` for overlay background when modified; use `rawFontSize * zoom` for font-size
5. **RibbonOverlay.tsx**: Add vertical drag handles (top/bottom edges) and center-drag for repositioning.
6. **pdfDownload.ts**: Fix coordinate math for both text items and ribbons.
7. **vite.config.js**: Ensure `optimizeDeps.include` lists the heavy PDF libraries to prevent chunking issues.
8. **public/manifest.json + service worker**: Add proper PWA support for offline use.
