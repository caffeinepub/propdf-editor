import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Download,
  FileDown,
  FileText,
  Highlighter,
  ImagePlus,
  Layers,
  Merge,
  MousePointer2,
  PenLine,
  PlusSquare,
  Redo2,
  Scissors,
  Signature,
  Stamp,
  SunMedium,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEditor } from "../../context/EditorContext";
import type { ToolType } from "../../types/editor";
import { downloadEditedPdf } from "../../utils/pdfDownload";

interface Props {
  onClose: () => void;
}

const TOOLS: { id: ToolType; icon: React.ComponentType<any>; label: string }[] =
  [
    { id: "select", icon: MousePointer2, label: "Select" },
    { id: "text-edit", icon: Type, label: "Edit Text" },
    { id: "add-text", icon: PlusSquare, label: "Add Text" },
    { id: "ribbon", icon: Layers, label: "Ribbon" },
    { id: "draw", icon: PenLine, label: "Draw" },
    { id: "highlight", icon: Highlighter, label: "Highlight" },
    { id: "stamp", icon: Stamp, label: "Stamp" },
    { id: "signature", icon: Signature, label: "Signature" },
    { id: "image", icon: ImagePlus, label: "Add Image" },
  ];

export default function Toolbar({ onClose }: Props) {
  const {
    fileName,
    activeTool,
    setActiveTool,
    zoom,
    setZoom,
    undo,
    redo,
    canUndo,
    canRedo,
    cleanBackground,
    setCleanBackground,
    pdfBytes,
    textItems,
    ribbonItems,
    setShowMergeModal,
    setShowSplitModal,
    setShowExportModal,
    setShowSignatureModal,
  } = useEditor();

  const handleTool = (tool: ToolType) => {
    if (tool === "signature") {
      setShowSignatureModal(true);
      return;
    }
    setActiveTool(tool);
  };

  const zoomIn = () => setZoom(Math.min(zoom + 0.25, 3));
  const zoomOut = () => setZoom(Math.max(zoom - 0.25, 0.25));

  return (
    <TooltipProvider delayDuration={300}>
      <header className="h-12 bg-card border-b border-border flex items-center px-3 gap-1 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-3">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center shrink-0">
            <FileText className="w-3 h-3 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-sm text-foreground hidden lg:block max-w-40 truncate">
            {fileName || "ProPDF"}
          </span>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Tool buttons */}
        {TOOLS.map(({ id, icon: Icon, label }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <Button
                data-ocid={`toolbar.${id}.button`}
                variant={activeTool === id ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => handleTool(id)}
              >
                <Icon className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        ))}

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Pages group */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-ocid="toolbar.merge.button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowMergeModal(true)}
            >
              <Merge className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Merge PDFs</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-ocid="toolbar.split.button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSplitModal(true)}
            >
              <Scissors className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Split PDF</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Undo/Redo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-ocid="toolbar.undo.button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={undo}
              disabled={!canUndo}
            >
              <Undo2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-ocid="toolbar.redo.button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={redo}
              disabled={!canRedo}
            >
              <Redo2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Redo (Ctrl+Y)</TooltipContent>
        </Tooltip>

        {/* Zoom */}
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button
          data-ocid="toolbar.zoom_out.button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={zoomOut}
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-12 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          data-ocid="toolbar.zoom_in.button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={zoomIn}
        >
          <ZoomIn className="w-4 h-4" />
        </Button>

        {/* Clean Background toggle */}
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-ocid="toolbar.clean_bg.toggle"
              variant={cleanBackground ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setCleanBackground(!cleanBackground)}
            >
              <SunMedium className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Clean Document Background
          </TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        {/* Download PDF with edits */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-ocid="toolbar.download_pdf.button"
              variant="outline"
              size="sm"
              className="h-8 gap-2"
              onClick={() => {
                if (!pdfBytes) return;
                downloadEditedPdf(
                  pdfBytes,
                  textItems,
                  ribbonItems,
                  fileName,
                  zoom,
                );
              }}
              disabled={!pdfBytes}
            >
              <FileDown className="w-4 h-4" />
              Download PDF
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Download PDF with edits applied
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Export */}
        <Button
          data-ocid="toolbar.export.primary_button"
          variant="default"
          size="sm"
          className="h-8 gap-2"
          onClick={() => setShowExportModal(true)}
        >
          <Download className="w-4 h-4" />
          Export
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-ocid="toolbar.close.button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close</TooltipContent>
        </Tooltip>
      </header>
    </TooltipProvider>
  );
}
