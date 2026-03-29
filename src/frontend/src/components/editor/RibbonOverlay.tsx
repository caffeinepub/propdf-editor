import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RibbonItem } from "../../types/editor";

interface Props {
  ribbon: RibbonItem;
  activeTool: string;
  onUpdate: (partial: Partial<RibbonItem>) => void;
  onRemove: () => void;
  autoFocus?: boolean;
}

export default function RibbonOverlay({
  ribbon,
  activeTool,
  onUpdate,
  onRemove,
  autoFocus,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [localText, setLocalText] = useState(ribbon.text);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);
  const dragStartRef = useRef<{
    mouseX: number;
    origX: number;
    origWidth: number;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalText(ribbon.text);
  }, [ribbon.text]);

  useEffect(() => {
    if (autoFocus) {
      setEditing(true);
      setTimeout(() => textareaRef.current?.focus(), 10);
    }
  }, [autoFocus]);

  const handleActivate = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (activeTool !== "ribbon") return;
    e.stopPropagation();
    setEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 10);
  };

  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      handleActivate(e);
    }
  };

  const handleBlur = () => {
    setEditing(false);
    onUpdate({ text: localText });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      setEditing(false);
      onUpdate({ text: localText });
    }
  };

  // Drag-resize handles
  const startDrag = (side: "left" | "right") => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(side);
    dragStartRef.current = {
      mouseX: e.clientX,
      origX: ribbon.x,
      origWidth: ribbon.width,
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = ev.clientX - dragStartRef.current.mouseX;
      if (side === "left") {
        const newX = Math.max(0, dragStartRef.current.origX + dx);
        const newWidth = Math.max(40, dragStartRef.current.origWidth - dx);
        onUpdate({ x: newX, width: newWidth });
      } else {
        const newWidth = Math.max(40, dragStartRef.current.origWidth + dx);
        onUpdate({ width: newWidth });
      }
    };

    const onMouseUp = () => {
      setDragging(null);
      dragStartRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const sharedStyle: React.CSSProperties = {
    fontSize: ribbon.fontSize,
    fontFamily: ribbon.fontFamily,
    fontWeight: ribbon.fontWeight,
    fontStyle: ribbon.fontStyle,
    lineHeight: 1.4,
    color: "#000",
  };

  const isRibbonMode = activeTool === "ribbon";

  return (
    <div
      data-ocid="ribbon.canvas_target"
      className="absolute"
      style={{
        left: ribbon.x,
        top: ribbon.y,
        width: ribbon.width,
        height: ribbon.height,
        backgroundColor: ribbon.backgroundColor,
        cursor: isRibbonMode ? "text" : "default",
        border: "none",
        outline: "none",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
      onClick={handleActivate}
      onKeyDown={handleContainerKeyDown}
      role="presentation"
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full h-full resize-none"
          style={{
            ...sharedStyle,
            background: ribbon.backgroundColor,
            border: "none",
            outline: "none",
            boxShadow: "none",
            padding: "1px 2px",
            margin: 0,
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
        />
      ) : (
        <div
          className="w-full h-full whitespace-pre-wrap"
          style={{
            ...sharedStyle,
            padding: "1px 2px",
          }}
        >
          {localText}
        </div>
      )}

      {/* Left drag handle */}
      {isRibbonMode && (
        <div
          data-ocid="ribbon.drag_handle"
          className="absolute left-0 top-0 h-full"
          style={{
            width: 8,
            cursor: "ew-resize",
            background:
              dragging === "left" ? "rgba(59,130,246,0.3)" : "transparent",
          }}
          onMouseDown={startDrag("left")}
          role="presentation"
        />
      )}

      {/* Right drag handle */}
      {isRibbonMode && (
        <div
          className="absolute right-0 top-0 h-full"
          style={{
            width: 8,
            cursor: "ew-resize",
            background:
              dragging === "right" ? "rgba(59,130,246,0.3)" : "transparent",
          }}
          onMouseDown={startDrag("right")}
          role="presentation"
        />
      )}

      {/* Delete button — only shown in ribbon mode */}
      {isRibbonMode && (
        <button
          data-ocid="ribbon.delete_button"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-3 -right-3 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
          style={{ zIndex: 10 }}
          title="Remove ribbon"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
