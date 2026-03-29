import { useCallback, useEffect, useRef } from "react";
import { useEditor } from "../../context/EditorContext";
import type {
  DrawPath,
  HighlightRect,
  ImageAnnotation,
  SignatureAnnotation,
  StampAnnotation,
} from "../../types/editor";
import { STAMP_COLORS, STAMP_LABELS } from "../../types/editor";

const genId = () => Math.random().toString(36).slice(2);

interface Props {
  pageIndex: number;
  width: number;
  height: number;
}

export default function AnnotationCanvas({ pageIndex, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    activeTool,
    annotations,
    addAnnotation,
    drawColor,
    drawStrokeWidth,
    selectedStamp,
    signatureDataUrl,
    setActiveTool,
  } = useEditor();

  const isDrawing = useRef(false);
  const currentPath = useRef<{ x: number; y: number }[]>([]);

  const getPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const anns = annotations.get(pageIndex) ?? [];
    for (const ann of anns) {
      if (ann.type === "draw") {
        const d = ann as DrawPath;
        if (d.points.length < 2) continue;
        ctx.save();
        ctx.globalAlpha = d.opacity;
        ctx.strokeStyle = d.color;
        ctx.lineWidth = d.strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(d.points[0].x, d.points[0].y);
        for (let i = 1; i < d.points.length; i++) {
          ctx.lineTo(d.points[i].x, d.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
      } else if (ann.type === "highlight") {
        const h = ann as HighlightRect;
        ctx.save();
        ctx.globalAlpha = h.opacity;
        ctx.fillStyle = h.color;
        ctx.fillRect(h.x, h.y, h.width, h.height);
        ctx.restore();
      } else if (ann.type === "stamp") {
        const s = ann as StampAnnotation;
        const label =
          STAMP_LABELS[s.stampType as keyof typeof STAMP_LABELS] ??
          s.stampType.toUpperCase();
        const color =
          STAMP_COLORS[s.stampType as keyof typeof STAMP_COLORS] ?? "#888";
        ctx.save();
        ctx.font = "bold 28px sans-serif";
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.8;
        ctx.strokeText(label, s.x, s.y);
        ctx.restore();
      } else if (ann.type === "signature") {
        const sig = ann as SignatureAnnotation;
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, sig.x, sig.y, sig.width, sig.height);
        };
        img.src = sig.dataUrl;
      } else if (ann.type === "image") {
        const imgAnn = ann as ImageAnnotation;
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, imgAnn.x, imgAnn.y, imgAnn.width, imgAnn.height);
        };
        img.src = imgAnn.dataUrl;
      }
    }
  }, [annotations, pageIndex, width, height]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getPos(e);
      if (activeTool === "draw") {
        isDrawing.current = true;
        currentPath.current = [pos];
      } else if (activeTool === "highlight") {
        isDrawing.current = true;
        currentPath.current = [pos];
      } else if (activeTool === "stamp") {
        addAnnotation({
          id: genId(),
          pageIndex,
          x: pos.x,
          y: pos.y,
          stampType: selectedStamp,
          type: "stamp",
        } as StampAnnotation);
      } else if (activeTool === "signature" && signatureDataUrl) {
        addAnnotation({
          id: genId(),
          pageIndex,
          x: pos.x - 100,
          y: pos.y - 30,
          width: 200,
          height: 60,
          dataUrl: signatureDataUrl,
          type: "signature",
        } as SignatureAnnotation);
        setActiveTool("select");
      }
    },
    [
      getPos,
      activeTool,
      addAnnotation,
      pageIndex,
      selectedStamp,
      signatureDataUrl,
      setActiveTool,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current) return;
      const pos = getPos(e);
      currentPath.current.push(pos);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      redraw();

      if (activeTool === "draw") {
        ctx.save();
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = drawStrokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        const pts = currentPath.current;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.restore();
      } else if (activeTool === "highlight") {
        const pts = currentPath.current;
        const x0 = pts[0].x;
        const y0 = pts[0].y;
        const w = pos.x - x0;
        const h = pos.y - y0;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#facc15";
        ctx.fillRect(x0, y0, w, h);
        ctx.restore();
      }
    },
    [getPos, activeTool, drawColor, drawStrokeWidth, redraw],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current) return;
      isDrawing.current = false;
      const pos = getPos(e);

      if (activeTool === "draw" && currentPath.current.length > 1) {
        addAnnotation({
          id: genId(),
          pageIndex,
          points: [...currentPath.current],
          color: drawColor,
          strokeWidth: drawStrokeWidth,
          opacity: 1,
          type: "draw",
        } as DrawPath);
      } else if (activeTool === "highlight" && currentPath.current.length > 0) {
        const pts = currentPath.current;
        const x0 = pts[0].x;
        const y0 = pts[0].y;
        addAnnotation({
          id: genId(),
          pageIndex,
          x: x0,
          y: y0,
          width: pos.x - x0,
          height: pos.y - y0,
          color: "#facc15",
          opacity: 0.35,
          type: "highlight",
        } as HighlightRect);
      }
      currentPath.current = [];
    },
    [getPos, activeTool, addAnnotation, pageIndex, drawColor, drawStrokeWidth],
  );

  const handleImageTool = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (activeTool !== "image") return;
      const pos = getPos(e);
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          addAnnotation({
            id: genId(),
            pageIndex,
            x: pos.x - 100,
            y: pos.y - 75,
            width: 200,
            height: 150,
            dataUrl,
            type: "image",
          } as ImageAnnotation);
        };
        reader.readAsDataURL(file);
      };
      input.click();
    },
    [getPos, activeTool, addAnnotation, pageIndex],
  );

  const isInteractive =
    activeTool === "draw" ||
    activeTool === "highlight" ||
    activeTool === "stamp" ||
    activeTool === "signature" ||
    activeTool === "image";

  const cursorStyle =
    (
      {
        draw: "crosshair",
        highlight: "crosshair",
        stamp: "cell",
        signature: "copy",
        image: "copy",
      } as Record<string, string>
    )[activeTool] ?? "default";

  return (
    <canvas
      ref={canvasRef}
      data-ocid="pdf.canvas_target"
      width={width}
      height={height}
      className="absolute inset-0"
      style={{
        cursor: cursorStyle,
        pointerEvents: isInteractive ? "auto" : "none",
      }}
      onMouseDown={(e) => {
        if (activeTool === "image") handleImageTool(e);
        else handleMouseDown(e);
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    />
  );
}
