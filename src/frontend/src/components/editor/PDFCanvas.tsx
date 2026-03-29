import { Button } from "@/components/ui/button";
import { Loader2, ScanText } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useEditor } from "../../context/EditorContext";
import type { OcrWord, RibbonItem, TextItem } from "../../types/editor";
import AnnotationCanvas from "./AnnotationCanvas";
import RibbonOverlay from "./RibbonOverlay";

const genId = () => Math.random().toString(36).slice(2);

function extractFontFamily(fontName: string): string {
  const clean = fontName.replace(/^[A-Z]{6}\+/, "");
  const lower = clean.toLowerCase();
  if (lower.includes("arial")) return "Arial, Helvetica, sans-serif";
  if (lower.includes("helvetica")) return "Helvetica, Arial, sans-serif";
  if (lower.includes("times")) return '"Times New Roman", Times, serif';
  if (lower.includes("courier")) return '"Courier New", Courier, monospace';
  if (lower.includes("georgia")) return "Georgia, serif";
  if (lower.includes("verdana")) return "Verdana, Geneva, sans-serif";
  if (lower.includes("tahoma")) return "Tahoma, Geneva, sans-serif";
  if (lower.includes("trebuchet")) return '"Trebuchet MS", sans-serif';
  if (lower.includes("garamond")) return "Garamond, serif";
  if (lower.includes("palatino")) return '"Palatino Linotype", Palatino, serif';
  if (lower.includes("calibri")) return "Calibri, Candara, sans-serif";
  if (lower.includes("cambria")) return "Cambria, Georgia, serif";
  if (lower.includes("candara")) return "Candara, sans-serif";
  if (lower.includes("consolas")) return "Consolas, monospace";
  if (lower.includes("constantia")) return "Constantia, Georgia, serif";
  if (lower.includes("corbel")) return "Corbel, sans-serif";
  if (lower.includes("book antiqua")) return '"Book Antiqua", Palatino, serif';
  if (lower.includes("impact")) return "Impact, Charcoal, fantasy";
  if (lower.includes("comic")) return '"Comic Sans MS", cursive';
  if (lower.includes("sans")) return "Arial, Helvetica, sans-serif";
  if (lower.includes("serif")) return '"Times New Roman", serif';
  if (lower.includes("mono")) return '"Courier New", monospace';
  return "Arial, Helvetica, sans-serif";
}

function extractFontWeight(fontName: string): string {
  const lower = fontName.toLowerCase();
  return lower.includes("bold") ||
    lower.includes("heavy") ||
    lower.includes("black") ||
    lower.includes("demi")
    ? "bold"
    : "normal";
}

function extractFontStyle(fontName: string): string {
  const lower = fontName.toLowerCase();
  return lower.includes("italic") || lower.includes("oblique")
    ? "italic"
    : "normal";
}

/**
 * Sample the average background color of a canvas region.
 * Returns a CSS rgb(...) string or '#ffffff' on failure.
 */
function sampleCanvasColor(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return "#ffffff";
  const dpr = window.devicePixelRatio || 1;
  const cx = Math.round((x + w / 2) * dpr);
  const cy = Math.round((y + h / 2) * dpr);
  const size = 8;
  const sx = Math.max(0, Math.min(cx - size / 2, canvas.width - size));
  const sy = Math.max(0, Math.min(cy - size / 2, canvas.height - size));
  try {
    const data = ctx.getImageData(sx, sy, size, size).data;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const cnt = data.length / 4;
    return `rgb(${Math.round(r / cnt)},${Math.round(g / cnt)},${Math.round(b / cnt)})`;
  } catch {
    return "#ffffff";
  }
}

function SinglePage({
  pdfDocument,
  originalPageIndex,
  displayIndex,
  zoom,
  onBecomeVisible,
}: {
  pdfDocument: any;
  originalPageIndex: number;
  displayIndex: number;
  zoom: number;
  onBecomeVisible: (idx: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<any>(null);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [autoFocusRibbonId, setAutoFocusRibbonId] = useState<string | null>(
    null,
  );
  const renderTaskRef = useRef<any>(null);

  const {
    activeTool,
    textItems,
    setTextItems,
    updateTextItem,
    addTextItem,
    ribbonItems,
    addRibbonItem,
    updateRibbonItem,
    removeRibbonItem,
    pageStates,
    setPageState,
    registerCanvas,
    cleanBackground,
  } = useEditor();

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — re-run on pdfDocument/page/zoom changes
  useEffect(() => {
    if (!pdfDocument) return;
    let cancelled = false;

    (async () => {
      try {
        const page = await pdfDocument.getPage(originalPageIndex + 1);
        const dpr = window.devicePixelRatio || 1;
        const baseViewport = page.getViewport({ scale: zoom * dpr });
        if (cancelled) return;
        const cssViewport = page.getViewport({ scale: zoom });
        setViewport(cssViewport);

        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = baseViewport.width;
        canvas.height = baseViewport.height;
        canvas.style.width = `${cssViewport.width}px`;
        canvas.style.height = `${cssViewport.height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (renderTaskRef.current) {
          try {
            await renderTaskRef.current.cancel();
          } catch (_) {
            // ignore
          }
        }

        const task = page.render({
          canvasContext: ctx,
          viewport: baseViewport,
        });
        renderTaskRef.current = task;
        await task.promise;

        if (cancelled) return;
        registerCanvas(originalPageIndex, canvas);

        // Extract text content every time (not guarded by .has())
        const textContent = await page.getTextContent();
        const vp = page.getViewport({ scale: zoom });
        const hasText = textContent.items.length > 0;
        setPageState(originalPageIndex, { index: originalPageIndex, hasText });

        // Get existing items to preserve user modifications
        const existingItems = textItems.get(originalPageIndex) ?? [];

        const newItems: TextItem[] = (textContent.items as any[]).map(
          (item: any) => {
            const tx = pdfjsLib.Util.transform(vp.transform, item.transform);
            const x = tx[4];
            const y = tx[5] - item.height * zoom;
            const width = item.width * zoom;
            const height = item.height * zoom;
            const rawFontSize = item.height; // PDF points, NOT zoom-scaled

            // Try to find a matching existing item (by original text proximity)
            const existingItem = existingItems.find(
              (ei) =>
                !ei.isNew &&
                ei.originalText === item.str &&
                Math.abs(ei.x / zoom - x / zoom) < 3,
            );

            // Sample background color from the freshly rendered canvas
            const backgroundColor = sampleCanvasColor(
              canvas,
              x,
              y,
              Math.max(width, 20),
              Math.max(height, 12),
            );

            return {
              id: existingItem?.id ?? genId(),
              pageIndex: originalPageIndex,
              x,
              y,
              width,
              height,
              text: existingItem?.isModified ? existingItem.text : item.str,
              originalText: item.str,
              fontSize: rawFontSize,
              rawFontSize,
              fontName: item.fontName ?? "sans-serif",
              transform: item.transform,
              isModified: existingItem?.isModified ?? false,
              isNew: false,
              backgroundColor,
            } as TextItem;
          },
        );

        // Keep any user-added new items (not from PDF extraction)
        const userNewItems = existingItems.filter((ei) => ei.isNew);
        setTextItems(originalPageIndex, [...newItems, ...userNewItems]);
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Page render error:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pdfDocument, originalPageIndex, zoom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onBecomeVisible(displayIndex);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [displayIndex, onBecomeVisible]);

  const runOCR = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsOcrRunning(true);
    try {
      const Tesseract = await import("tesseract.js");
      const result = await Tesseract.default.recognize(canvas, "eng");
      const words: OcrWord[] = (result.data as any).words.map((w: any) => ({
        text: w.text,
        x: w.bbox.x0 / (window.devicePixelRatio || 1),
        y: w.bbox.y0 / (window.devicePixelRatio || 1),
        width: (w.bbox.x1 - w.bbox.x0) / (window.devicePixelRatio || 1),
        height: (w.bbox.y1 - w.bbox.y0) / (window.devicePixelRatio || 1),
        confidence: w.confidence,
      }));
      setPageState(originalPageIndex, { ocrDone: true, ocrWords: words });

      const rawFontSizeEstimate = 12; // reasonable default for OCR words
      const ocrItems: TextItem[] = words.map((w) => ({
        id: genId(),
        pageIndex: originalPageIndex,
        x: w.x,
        y: w.y,
        width: w.width,
        height: w.height,
        text: w.text,
        originalText: w.text,
        fontSize: rawFontSizeEstimate,
        rawFontSize: rawFontSizeEstimate,
        fontName: "sans-serif",
        transform: [1, 0, 0, 1, w.x, w.y],
        isModified: false,
        isNew: false,
        backgroundColor: canvasRef.current
          ? sampleCanvasColor(canvasRef.current, w.x, w.y, w.width, w.height)
          : "#ffffff",
      }));
      setTextItems(originalPageIndex, ocrItems);
      toast.success("OCR complete \u2014 text is now editable");
    } catch (err) {
      console.error(err);
      toast.error("OCR failed. Please try again.");
    } finally {
      setIsOcrRunning(false);
    }
  }, [originalPageIndex, setPageState, setTextItems]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (activeTool === "add-text") {
        const newItem: TextItem = {
          id: genId(),
          pageIndex: originalPageIndex,
          x,
          y,
          width: 200,
          height: 20,
          text: "New Text",
          originalText: "",
          fontSize: 14,
          rawFontSize: 14,
          fontName: "sans-serif",
          transform: [1, 0, 0, 1, x, y],
          isModified: true,
          isNew: true,
          backgroundColor: "#ffffff",
        };
        addTextItem(newItem);
        return;
      }

      if (activeTool === "ribbon") {
        const canvas = canvasRef.current;
        let bgColor = "#ffffff";

        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const dpr = window.devicePixelRatio || 1;
            const px = Math.round(x * dpr);
            const py = Math.round(y * dpr);
            const sampleSize = 4;
            const safeX = Math.max(0, Math.min(px, canvas.width - sampleSize));
            const safeY = Math.max(0, Math.min(py, canvas.height - sampleSize));
            try {
              const pixel = ctx.getImageData(
                safeX,
                safeY,
                sampleSize,
                sampleSize,
              );
              let r = 0;
              let g = 0;
              let b = 0;
              const count = sampleSize * sampleSize;
              for (let i = 0; i < count; i++) {
                r += pixel.data[i * 4];
                g += pixel.data[i * 4 + 1];
                b += pixel.data[i * 4 + 2];
              }
              r = Math.round(r / count);
              g = Math.round(g / count);
              b = Math.round(b / count);
              bgColor = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
            } catch (_err) {
              bgColor = "#ffffff";
            }
          }
        }

        // Find nearest text item for font matching
        const items = textItems.get(originalPageIndex) ?? [];
        let nearestFontSize = 12;
        let nearestFontFamily = "Arial, Helvetica, sans-serif";
        let nearestFontWeight = "normal";
        let nearestFontStyle = "normal";

        if (items.length > 0) {
          let minDist = Number.POSITIVE_INFINITY;
          for (const item of items) {
            const cx = item.x + item.width / 2;
            const cy = item.y + item.height / 2;
            const dist = Math.sqrt((cx - x) ** 2 + (cy - y) ** 2);
            if (dist < minDist) {
              minDist = dist;
              // Use rawFontSize * zoom for display size
              nearestFontSize = Math.max(item.rawFontSize * zoom, 8);
              nearestFontFamily = extractFontFamily(item.fontName);
              nearestFontWeight = extractFontWeight(item.fontName);
              nearestFontStyle = extractFontStyle(item.fontName);
            }
          }
        }

        const defaultWidth = 200;
        const id = genId();
        const newRibbon: RibbonItem = {
          id,
          pageIndex: originalPageIndex,
          x: Math.max(0, x - defaultWidth / 2),
          y: Math.max(0, y - nearestFontSize * 0.75),
          width: defaultWidth,
          height: Math.round(nearestFontSize * 1.5),
          text: "",
          fontSize: nearestFontSize,
          fontFamily: nearestFontFamily,
          fontWeight: nearestFontWeight,
          fontStyle: nearestFontStyle,
          backgroundColor: bgColor,
        };
        addRibbonItem(newRibbon);
        setAutoFocusRibbonId(id);
        setTimeout(() => setAutoFocusRibbonId(null), 100);
      }
    },
    [
      activeTool,
      originalPageIndex,
      addTextItem,
      addRibbonItem,
      textItems,
      zoom,
    ],
  );

  const pageState = pageStates.get(originalPageIndex);
  const items = textItems.get(originalPageIndex) ?? [];
  const pageRibbons = ribbonItems.get(originalPageIndex) ?? [];
  const showOCRButton = pageState && !pageState.hasText && !pageState.ocrDone;
  const vp = viewport;

  return (
    <div
      id={`pdf-page-${displayIndex}`}
      ref={containerRef}
      className="relative mb-6 pdf-page-shadow rounded-sm overflow-hidden"
      style={vp ? { width: vp.width, height: vp.height } : {}}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={
          cleanBackground
            ? { filter: "brightness(1.18) contrast(1.25) saturate(0.8)" }
            : undefined
        }
      />

      {/* Text overlay */}
      <div
        className="absolute inset-0"
        style={{
          cursor:
            activeTool === "add-text" || activeTool === "ribbon"
              ? "crosshair"
              : "default",
        }}
        onClick={handleCanvasClick}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCanvasClick(e as any);
        }}
        role="presentation"
      >
        {items.map((item) => (
          <TextOverlayItem
            key={item.id}
            item={item}
            activeTool={activeTool}
            zoom={zoom}
            onUpdate={(text) =>
              updateTextItem(originalPageIndex, item.id, text)
            }
          />
        ))}

        {/* Ribbon overlays */}
        {pageRibbons.map((ribbon) => (
          <RibbonOverlay
            key={ribbon.id}
            ribbon={ribbon}
            activeTool={activeTool}
            onUpdate={(partial) =>
              updateRibbonItem(originalPageIndex, ribbon.id, partial)
            }
            onRemove={() => removeRibbonItem(originalPageIndex, ribbon.id)}
            autoFocus={ribbon.id === autoFocusRibbonId}
          />
        ))}
      </div>

      {vp && (
        <AnnotationCanvas
          pageIndex={originalPageIndex}
          width={vp.width}
          height={vp.height}
        />
      )}

      {showOCRButton && vp && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <Button
            data-ocid="pages.ocr.button"
            size="sm"
            variant="default"
            onClick={runOCR}
            disabled={isOcrRunning}
          >
            {isOcrRunning ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ScanText className="w-4 h-4 mr-2" />
            )}
            {isOcrRunning ? "Running OCR..." : "Run OCR on this page"}
          </Button>
        </div>
      )}

      <div className="absolute bottom-2 right-2 bg-black/60 text-white/70 text-xs px-2 py-0.5 rounded-full pointer-events-none">
        {displayIndex + 1}
      </div>
    </div>
  );
}

function TextOverlayItem({
  item,
  activeTool,
  zoom,
  onUpdate,
}: {
  item: TextItem;
  activeTool: string;
  zoom: number;
  onUpdate: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localText, setLocalText] = useState(item.text);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalText(item.text);
  }, [item.text]);

  const handleActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (activeTool === "text-edit") {
      setEditing(true);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const len = inputRef.current.value.length;
          inputRef.current.setSelectionRange(len, len);
        }
      }, 10);
    }
  };

  const handleBlur = () => {
    setEditing(false);
    onUpdate(localText);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      setEditing(false);
      onUpdate(localText);
    }
  };

  if (!item.text.trim() && !item.isNew) return null;

  const isEditMode = activeTool === "text-edit";
  // Use rawFontSize * zoom to match original rendered font size at current zoom
  const fontSize = Math.max(item.rawFontSize * zoom, 8);
  const fontFamily = extractFontFamily(item.fontName);
  const fontWeight = extractFontWeight(item.fontName);
  const fontStyle = extractFontStyle(item.fontName);

  // The overlay background — use sampled color to cover original canvas text
  const overlayBg = item.isModified
    ? (item.backgroundColor ?? "#ffffff")
    : "transparent";

  const sharedStyle: React.CSSProperties = {
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    lineHeight: 1.2,
  };

  return (
    <div
      className="absolute"
      style={{
        left: item.x,
        top: item.y,
        width: Math.max(item.width, 20),
        minHeight: Math.max(item.height, 12),
        pointerEvents:
          isEditMode || item.isNew || item.isModified ? "auto" : "none",
        cursor: isEditMode ? "text" : "default",
      }}
    >
      {editing ? (
        <textarea
          ref={inputRef}
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full resize-none outline-none"
          style={{
            ...sharedStyle,
            minHeight: Math.max(item.height, 20),
            background: item.backgroundColor ?? "#ffffff",
            color: "#111",
            border: "none",
            boxShadow: "none",
            padding: 0,
            margin: 0,
            overflow: "hidden",
          }}
          rows={1}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
        />
      ) : item.isModified || item.isNew ? (
        <button
          type="button"
          onClick={handleActivate}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleActivate(e);
          }}
          className="text-left whitespace-pre-wrap w-full"
          style={{
            ...sharedStyle,
            color: "#111",
            background: overlayBg,
            border: "none",
            boxShadow: "none",
            outline: "none",
            cursor: isEditMode ? "text" : "default",
            minHeight: Math.max(item.height, 16),
            display: "block",
            padding: 0,
            margin: 0,
          }}
        >
          {localText}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleActivate}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleActivate(e);
          }}
          className="text-left whitespace-pre w-full"
          style={{
            ...sharedStyle,
            color: "transparent",
            background: "transparent",
            border: "none",
            boxShadow: "none",
            outline: "none",
            cursor: isEditMode ? "text" : "default",
            padding: 0,
            margin: 0,
            minHeight: Math.max(item.height, 12),
          }}
          title={isEditMode ? "Click to edit" : undefined}
        >
          {item.text}
        </button>
      )}
    </div>
  );
}

export default function PDFCanvas() {
  const { pdfDocument, pageOrder, zoom, setCurrentPage } = useEditor();

  const handleBecomeVisible = useCallback(
    (idx: number) => setCurrentPage(idx),
    [setCurrentPage],
  );

  if (!pdfDocument) {
    return (
      <div
        data-ocid="pdf.empty_state"
        className="flex items-center justify-center h-full"
      >
        <div className="text-muted-foreground text-sm">No PDF loaded</div>
      </div>
    );
  }

  return (
    <div
      data-ocid="pdf.editor"
      className="flex flex-col items-center py-8 px-4 min-h-full"
    >
      {pageOrder.map((originalIndex, displayIndex) => (
        <SinglePage
          key={`page-${originalIndex}`}
          pdfDocument={pdfDocument}
          originalPageIndex={originalIndex}
          displayIndex={displayIndex}
          zoom={zoom}
          onBecomeVisible={handleBecomeVisible}
        />
      ))}
    </div>
  );
}
