import { ScrollArea } from "@/components/ui/scroll-area";
import { GripVertical, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "../../context/EditorContext";

const THUMB_WIDTH = 120;
const THUMB_HEIGHT = 160;

function PageThumbnail({
  pageDoc,
  pageIndex,
  displayNumber,
  isActive,
  onClick,
  onDelete,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  pageDoc: any;
  pageIndex: number;
  displayNumber: number;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: rendered guard prevents re-run
  useEffect(() => {
    if (!pageDoc || rendered) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await pageDoc.getPage(pageIndex + 1);
        const viewport = page.getViewport({
          scale: THUMB_WIDTH / page.getViewport({ scale: 1 }).width,
        });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setRendered(true);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageDoc, pageIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") onClick();
  };

  // Use a wrapper that satisfies both draggable behavior and keyboard accessibility
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: draggable page items need keyboard focus
      tabIndex={0}
      aria-label={`Page ${displayNumber}${isActive ? ", current" : ""}`}
      className={`
        group relative rounded-lg border cursor-pointer transition-all select-none list-none
        outline-none focus-visible:ring-2 focus-visible:ring-ring
        ${isActive ? "border-primary bg-accent/30" : "border-border hover:border-primary/40 bg-card"}
        ${isDragging ? "opacity-40" : "opacity-100"}
        p-1
      `}
    >
      <div
        className="flex items-center justify-center overflow-hidden rounded bg-background"
        style={{ height: THUMB_HEIGHT }}
      >
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain"
        />
        {!rendered && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-1 px-1">
        <span className="text-xs text-muted-foreground">{displayNumber}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-3 h-3 text-muted-foreground cursor-grab" />
          <button
            type="button"
            data-ocid={`pages.delete_button.${displayNumber}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-muted-foreground hover:text-destructive transition-colors"
            aria-label={`Delete page ${displayNumber}`}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </li>
  );
}

export default function PagePanel() {
  const { pdfDocument, pageOrder, setPageOrder, currentPage, setCurrentPage } =
    useEditor();
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const handleDragStart = useCallback(
    (displayIndex: number, e: React.DragEvent) => {
      setDraggingIndex(displayIndex);
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (targetDisplayIndex: number, e: React.DragEvent) => {
      e.preventDefault();
      if (draggingIndex === null || draggingIndex === targetDisplayIndex)
        return;
      const newOrder = [...pageOrder];
      const [moved] = newOrder.splice(draggingIndex, 1);
      newOrder.splice(targetDisplayIndex, 0, moved);
      setPageOrder(newOrder);
      setDraggingIndex(null);
    },
    [draggingIndex, pageOrder, setPageOrder],
  );

  const handleDelete = useCallback(
    (displayIndex: number) => {
      if (pageOrder.length <= 1) return;
      const newOrder = pageOrder.filter((_, i) => i !== displayIndex);
      setPageOrder(newOrder);
      if (currentPage >= newOrder.length) setCurrentPage(newOrder.length - 1);
    },
    [pageOrder, setPageOrder, currentPage, setCurrentPage],
  );

  if (!pdfDocument) return null;

  return (
    <aside
      data-ocid="pages.panel"
      className="w-36 bg-sidebar border-r border-border flex flex-col shrink-0"
    >
      <div className="px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Pages
        </span>
      </div>
      <ScrollArea className="flex-1">
        <ul className="p-2 flex flex-col gap-2">
          {pageOrder.map((originalIndex, displayIndex) => (
            <PageThumbnail
              key={`page-${originalIndex}`}
              pageDoc={pdfDocument}
              pageIndex={originalIndex}
              displayNumber={displayIndex + 1}
              isActive={currentPage === displayIndex}
              onClick={() => {
                setCurrentPage(displayIndex);
                const el = document.getElementById(`pdf-page-${displayIndex}`);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              onDelete={() => handleDelete(displayIndex)}
              isDragging={draggingIndex === displayIndex}
              onDragStart={(e) => handleDragStart(displayIndex, e)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(displayIndex, e)}
            />
          ))}
        </ul>
      </ScrollArea>
    </aside>
  );
}
