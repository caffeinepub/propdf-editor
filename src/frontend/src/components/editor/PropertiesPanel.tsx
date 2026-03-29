import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useEditor } from "../../context/EditorContext";

const STAMP_OPTIONS = [
  { value: "approved", label: "Approved" },
  { value: "confidential", label: "Confidential" },
  { value: "draft", label: "Draft" },
  { value: "rejected", label: "Rejected" },
];

const COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#000000",
];

export default function PropertiesPanel() {
  const {
    activeTool,
    drawColor,
    setDrawColor,
    drawStrokeWidth,
    setDrawStrokeWidth,
    selectedStamp,
    setSelectedStamp,
    signatureDataUrl,
    setShowSignatureModal,
  } = useEditor();

  if (activeTool === "select") {
    return (
      <aside className="w-48 bg-sidebar border-l border-border flex flex-col p-3 gap-3 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Properties
        </span>
        <p className="text-xs text-muted-foreground">
          Select an object to see its properties.
        </p>
      </aside>
    );
  }

  if (activeTool === "draw" || activeTool === "highlight") {
    return (
      <aside className="w-48 bg-sidebar border-l border-border flex flex-col p-3 gap-4 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {activeTool === "draw" ? "Draw" : "Highlight"}
        </span>
        {activeTool === "draw" && (
          <>
            <div>
              <Label className="text-xs mb-2 block">Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setDrawColor(c)}
                    className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      background: c,
                      borderColor: drawColor === c ? "white" : "transparent",
                    }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs mb-2 block">
                Stroke: {drawStrokeWidth}px
              </Label>
              <Slider
                min={1}
                max={20}
                step={1}
                value={[drawStrokeWidth]}
                onValueChange={([v]) => setDrawStrokeWidth(v)}
              />
            </div>
          </>
        )}
      </aside>
    );
  }

  if (activeTool === "stamp") {
    return (
      <aside className="w-48 bg-sidebar border-l border-border flex flex-col p-3 gap-4 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Stamp
        </span>
        <div>
          <Label className="text-xs mb-2 block">Type</Label>
          <Select value={selectedStamp} onValueChange={setSelectedStamp}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAMP_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Click anywhere on the page to place the stamp.
        </p>
      </aside>
    );
  }

  if (activeTool === "signature") {
    return (
      <aside className="w-48 bg-sidebar border-l border-border flex flex-col p-3 gap-4 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Signature
        </span>
        {signatureDataUrl ? (
          <>
            <img
              src={signatureDataUrl}
              alt="signature"
              className="w-full border border-border rounded bg-white"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSignatureModal(true)}
            >
              Change Signature
            </Button>
            <p className="text-xs text-muted-foreground">
              Click on the page to place your signature.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              No signature yet. Create one to place on the page.
            </p>
            <Button size="sm" onClick={() => setShowSignatureModal(true)}>
              Create Signature
            </Button>
          </>
        )}
      </aside>
    );
  }

  if (activeTool === "image") {
    return (
      <aside className="w-48 bg-sidebar border-l border-border flex flex-col p-3 gap-3 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Add Image
        </span>
        <p className="text-xs text-muted-foreground">
          Click on the page to place an image. A file picker will open.
        </p>
      </aside>
    );
  }

  if (activeTool === "text-edit" || activeTool === "add-text") {
    return (
      <aside className="w-48 bg-sidebar border-l border-border flex flex-col p-3 gap-3 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {activeTool === "text-edit" ? "Edit Text" : "Add Text"}
        </span>
        <p className="text-xs text-muted-foreground">
          {activeTool === "text-edit"
            ? "Click any text on the page to edit it inline."
            : "Click anywhere on the page to add a new text box."}
        </p>
      </aside>
    );
  }

  if (activeTool === "ribbon") {
    return (
      <aside className="w-48 bg-sidebar border-l border-border flex flex-col p-3 gap-3 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Ribbon
        </span>
        <p className="text-xs text-muted-foreground">
          Click anywhere on the page to place a ribbon. The ribbon automatically
          samples the document background color and matches the nearest font.
        </p>
        <p className="text-xs text-muted-foreground">
          Drag the left or right edges to resize. Click the ribbon to type your
          text.
        </p>
        <p className="text-xs text-muted-foreground">
          When downloaded, the ribbon permanently covers the original content
          underneath.
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-48 bg-sidebar border-l border-border flex flex-col p-3 gap-3 shrink-0">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Properties
      </span>
    </aside>
  );
}
