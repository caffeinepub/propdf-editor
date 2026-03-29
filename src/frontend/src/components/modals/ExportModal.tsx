import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveAs } from "file-saver";
import { Download, Loader2 } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { useState } from "react";
import { toast } from "sonner";
import { useEditor } from "../../context/EditorContext";
import type {
  HighlightRect,
  ImageAnnotation,
  SignatureAnnotation,
  StampAnnotation,
} from "../../types/editor";
import { STAMP_LABELS } from "../../types/editor";

type ExportFormat = "pdf" | "images" | "docx" | "xlsx" | "pptx";

export default function ExportModal() {
  const {
    setShowExportModal,
    pdfBytes,
    pdfDocument,
    pageOrder,
    textItems,
    annotations,
    fileName,
    canvasRefs,
  } = useEditor();
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [password, setPassword] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const exportPDF = async () => {
    if (!pdfBytes) return;
    const doc = await PDFDocument.load(pdfBytes);
    const pages = doc.getPages();

    for (let di = 0; di < pageOrder.length; di++) {
      const origIdx = pageOrder[di];
      const items = textItems.get(origIdx) ?? [];
      const newItems = items.filter((t) => t.isNew);

      const page = pages[origIdx];
      if (!page) continue;
      const { height } = page.getSize();
      const font = await doc.embedFont(StandardFonts.Helvetica);

      for (const item of newItems) {
        page.drawText(item.text, {
          x: item.x,
          y: height - item.y - item.height,
          size: Math.max(item.fontSize, 8),
          font,
          color: rgb(0, 0, 0),
        });
      }

      const anns = annotations.get(origIdx) ?? [];
      for (const ann of anns) {
        if (ann.type === "stamp") {
          const s = ann as StampAnnotation;
          const label =
            STAMP_LABELS[s.stampType as keyof typeof STAMP_LABELS] ??
            s.stampType.toUpperCase();
          page.drawText(label, {
            x: s.x,
            y: height - s.y,
            size: 28,
            font,
            color: rgb(0.8, 0.1, 0.1),
            opacity: 0.8,
          });
        } else if (ann.type === "highlight") {
          const h = ann as HighlightRect;
          page.drawRectangle({
            x: h.x,
            y: height - h.y - h.height,
            width: h.width,
            height: h.height,
            color: rgb(0.98, 0.85, 0.1),
            opacity: 0.4,
          });
        } else if (ann.type === "signature" || ann.type === "image") {
          const sigAnn = ann as SignatureAnnotation | ImageAnnotation;
          try {
            const base64 = sigAnn.dataUrl.split(",")[1];
            const imgBytes = Uint8Array.from(atob(base64), (c) =>
              c.charCodeAt(0),
            );
            const isJpeg = sigAnn.dataUrl.startsWith("data:image/jpeg");
            const embedded = isJpeg
              ? await doc.embedJpg(imgBytes)
              : await doc.embedPng(imgBytes);
            page.drawImage(embedded, {
              x: sigAnn.x,
              y: height - sigAnn.y - sigAnn.height,
              width: sigAnn.width,
              height: sigAnn.height,
            });
          } catch {
            // skip if image embedding fails
          }
        }
      }
    }

    const pdfOut = await doc.save();
    const base = fileName.replace(/\.pdf$/i, "");
    saveAs(
      new Blob([pdfOut as unknown as ArrayBuffer], { type: "application/pdf" }),
      `${base}_edited.pdf`,
    );
  };

  const exportImages = async () => {
    if (!pdfDocument) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    for (let di = 0; di < pageOrder.length; di++) {
      const origIdx = pageOrder[di];
      const canvas = canvasRefs.get(origIdx);
      if (!canvas) continue;
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];
      zip.file(`page_${di + 1}.png`, base64, { base64: true });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${fileName.replace(".pdf", "")}_pages.zip`);
  };

  const exportDocx = async () => {
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const allText: string[] = [];
    for (const origIdx of pageOrder) {
      const items = textItems.get(origIdx) ?? [];
      const pageText = items
        .map((t) => t.text)
        .filter(Boolean)
        .join(" ");
      allText.push(pageText);
    }
    const doc = new Document({
      sections: [
        {
          children: allText.map(
            (text, i) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: `--- Page ${i + 1} ---`,
                    bold: true,
                    break: i > 0 ? 1 : 0,
                  }),
                  new TextRun({ text: ` ${text}` }),
                ],
              }),
          ),
        },
      ],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${fileName.replace(".pdf", "")}.docx`);
  };

  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const rows: string[][] = [["Page", "Content"]];
    for (let di = 0; di < pageOrder.length; di++) {
      const origIdx = pageOrder[di];
      const items = textItems.get(origIdx) ?? [];
      const text = items
        .map((t) => t.text)
        .filter(Boolean)
        .join(" ");
      rows.push([`Page ${di + 1}`, text]);
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "PDF Content");
    XLSX.writeFile(wb, `${fileName.replace(".pdf", "")}.xlsx`);
  };

  const exportPptx = async () => {
    const pptxgen = (await import("pptxgenjs")).default;
    const prs = new pptxgen();
    for (let di = 0; di < pageOrder.length; di++) {
      const origIdx = pageOrder[di];
      const slide = prs.addSlide();
      const canvas = canvasRefs.get(origIdx);
      if (canvas) {
        const imgData = canvas.toDataURL("image/jpeg", 0.8);
        slide.addImage({ data: imgData, x: 0, y: 0, w: "100%", h: "100%" });
      }
      const items = textItems.get(origIdx) ?? [];
      const text = items
        .map((t) => t.text)
        .filter(Boolean)
        .join(" ")
        .substring(0, 200);
      if (text) {
        slide.addText(`Page ${di + 1}: ${text}`, {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 1,
          fontSize: 10,
          color: "363636",
        });
      }
    }
    await prs.writeFile({ fileName: `${fileName.replace(".pdf", "")}.pptx` });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (format === "pdf") await exportPDF();
      else if (format === "images") await exportImages();
      else if (format === "docx") await exportDocx();
      else if (format === "xlsx") await exportXlsx();
      else if (format === "pptx") await exportPptx();
      toast.success(`Exported as ${format.toUpperCase()}`);
      setShowExportModal(false);
    } catch (err) {
      console.error(err);
      toast.error(
        `Export failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => setShowExportModal(false)}>
      <DialogContent data-ocid="export.modal" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Export Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Format</Label>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as ExportFormat)}
            >
              <SelectTrigger data-ocid="export.select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                <SelectItem value="images">Images (.png, zipped)</SelectItem>
                <SelectItem value="docx">Word Document (.docx)</SelectItem>
                <SelectItem value="xlsx">Excel Spreadsheet (.xlsx)</SelectItem>
                <SelectItem value="pptx">PowerPoint (.pptx)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {format === "pdf" && (
            <div>
              <Label className="mb-2 block">Password (optional)</Label>
              <Input
                data-ocid="export.input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave empty for no password"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Note: PDF encryption requires a supported reader.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setShowExportModal(false)}>
            Cancel
          </Button>
          <Button
            data-ocid="export.primary_button"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {isExporting ? "Exporting..." : "Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
