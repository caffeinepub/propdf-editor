import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useEditor } from "../../context/EditorContext";

interface MergeFile {
  name: string;
  bytes: Uint8Array;
}

interface Props {
  onMerge: (bytes: Uint8Array, name: string) => void;
}

export default function MergeModal({ onMerge }: Props) {
  const { setShowMergeModal, pdfBytes, fileName } = useEditor();
  const [extraFiles, setExtraFiles] = useState<MergeFile[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    const newFiles: MergeFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.toLowerCase().endsWith(".pdf")) continue;
      const ab = await file.arrayBuffer();
      newFiles.push({ name: file.name, bytes: new Uint8Array(ab) });
    }
    setExtraFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setExtraFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMerge = async () => {
    if (!pdfBytes) return;
    setIsMerging(true);
    try {
      const merged = await PDFDocument.create();
      const allFiles = [{ bytes: pdfBytes, name: fileName }, ...extraFiles];
      for (const f of allFiles) {
        const src = await PDFDocument.load(f.bytes);
        const pagesCopied = await merged.copyPages(src, src.getPageIndices());
        for (const p of pagesCopied) merged.addPage(p);
      }
      const bytes = await merged.save();
      const mergedBytes = new Uint8Array(bytes);
      toast.success("PDFs merged successfully");
      setShowMergeModal(false);
      onMerge(mergedBytes, "merged.pdf");
    } catch (err) {
      console.error(err);
      toast.error("Merge failed. Please check the PDF files.");
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => setShowMergeModal(false)}>
      <DialogContent data-ocid="merge.modal" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Merge PDFs</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            The current PDF will be first. Add more PDFs below.
          </p>

          <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm truncate flex-1">{fileName}</span>
            <span className="text-xs text-muted-foreground">current</span>
          </div>

          {extraFiles.map((f, i) => (
            <div
              key={f.name}
              className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"
            >
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm truncate flex-1">{f.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${f.name}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          <Button
            data-ocid="merge.upload_button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="w-4 h-4" />
            Add PDF Files
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setShowMergeModal(false)}>
            Cancel
          </Button>
          <Button
            data-ocid="merge.primary_button"
            onClick={handleMerge}
            disabled={isMerging || extraFiles.length === 0}
          >
            {isMerging ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {isMerging ? "Merging..." : `Merge ${extraFiles.length + 1} PDFs`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
