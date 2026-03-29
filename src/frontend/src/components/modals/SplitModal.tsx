import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { saveAs } from "file-saver";
import { Loader2 } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useEditor } from "../../context/EditorContext";

function PageThumb({
  pdfDoc,
  pageIndex,
  selected,
  onClick,
}: {
  pdfDoc: any;
  pageIndex: number;
  selected: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!pdfDoc) return;
    (async () => {
      const page = await pdfDoc.getPage(pageIndex + 1);
      const vp = page.getViewport({ scale: 0.4 });
      const c = canvasRef.current;
      if (!c) return;
      c.width = vp.width;
      c.height = vp.height;
      const ctx = c.getContext("2d");
      if (ctx) await page.render({ canvasContext: ctx, viewport: vp }).promise;
    })();
  }, [pdfDoc, pageIndex]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`Page ${pageIndex + 1}${selected ? ", selected for Part 1" : ""}`}
      className={`relative cursor-pointer rounded border-2 overflow-hidden transition-all w-full
        ${selected ? "border-primary shadow-[0_0_0_2px_oklch(var(--primary)/0.4)]" : "border-border hover:border-primary/40"}`}
    >
      <canvas ref={canvasRef} className="w-full" />
      {selected && (
        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
          <span className="text-xs text-primary font-bold bg-background/80 px-2 py-0.5 rounded">
            Selected
          </span>
        </div>
      )}
      <div className="absolute bottom-1 right-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-full">
        {pageIndex + 1}
      </div>
    </button>
  );
}

export default function SplitModal() {
  const { setShowSplitModal, pdfDocument, pageOrder, fileName, pdfBytes } =
    useEditor();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isSplitting, setIsSplitting] = useState(false);

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleSplit = async () => {
    if (!pdfBytes || selected.size === 0) return;
    setIsSplitting(true);
    try {
      const srcDoc = await PDFDocument.load(pdfBytes);
      const part1 = await PDFDocument.create();
      const part2 = await PDFDocument.create();

      for (let i = 0; i < pageOrder.length; i++) {
        const origIdx = pageOrder[i];
        const [copiedPage] = selected.has(i)
          ? await part1.copyPages(srcDoc, [origIdx])
          : await part2.copyPages(srcDoc, [origIdx]);
        if (selected.has(i)) part1.addPage(copiedPage);
        else part2.addPage(copiedPage);
      }

      if (part1.getPageCount() > 0) {
        const b1 = await part1.save();
        saveAs(
          new Blob([b1 as unknown as ArrayBuffer], { type: "application/pdf" }),
          `${fileName.replace(".pdf", "")}_part1.pdf`,
        );
      }
      if (part2.getPageCount() > 0) {
        const b2 = await part2.save();
        saveAs(
          new Blob([b2 as unknown as ArrayBuffer], { type: "application/pdf" }),
          `${fileName.replace(".pdf", "")}_part2.pdf`,
        );
      }
      toast.success("PDF split successfully");
      setShowSplitModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Split failed.");
    } finally {
      setIsSplitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => setShowSplitModal(false)}>
      <DialogContent data-ocid="split.modal" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Split PDF</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Select the pages for <strong>Part 1</strong>. Remaining pages go to
          Part 2.
        </p>
        <ScrollArea className="h-64">
          <div className="grid grid-cols-5 gap-2 p-1">
            {pageOrder.map((origIdx, dispIdx) => (
              <PageThumb
                key={`page-${origIdx}`}
                pdfDoc={pdfDocument}
                pageIndex={origIdx}
                selected={selected.has(dispIdx)}
                onClick={() => toggle(dispIdx)}
              />
            ))}
          </div>
        </ScrollArea>
        <p className="text-xs text-muted-foreground">
          {selected.size} page(s) → Part 1 &nbsp;·&nbsp;{" "}
          {pageOrder.length - selected.size} page(s) → Part 2
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setShowSplitModal(false)}>
            Cancel
          </Button>
          <Button
            data-ocid="split.primary_button"
            onClick={handleSplit}
            disabled={isSplitting || selected.size === 0}
          >
            {isSplitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Split & Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
