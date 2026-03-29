import { Button } from "@/components/ui/button";
import {
  Download,
  Edit3,
  FileText,
  Layers,
  Merge,
  Shield,
  Upload,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

interface Props {
  onFileOpen: (bytes: Uint8Array, name: string) => void;
}

export default function LandingPage({ onFileOpen }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Please select a PDF file");
        return;
      }
      try {
        const ab = await file.arrayBuffer();
        onFileOpen(new Uint8Array(ab), file.name);
      } catch {
        toast.error("Failed to read the file");
      }
    },
    [onFileOpen],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const features = [
    {
      icon: Edit3,
      title: "Inline Text Editing",
      desc: "Click any text to edit it directly, preserving original fonts and formatting",
    },
    {
      icon: Zap,
      title: "OCR for Scanned PDFs",
      desc: "Automatic text recognition from scanned documents using Tesseract.js",
    },
    {
      icon: Layers,
      title: "Annotations & Drawing",
      desc: "Freehand drawing, highlights, stamps and digital signatures",
    },
    {
      icon: Merge,
      title: "Merge & Split",
      desc: "Combine multiple PDFs or split into separate files by page",
    },
    {
      icon: Shield,
      title: "100% Offline",
      desc: "All processing happens in your browser. No files are ever uploaded",
    },
    {
      icon: Download,
      title: "Multi-Format Export",
      desc: "Export to PDF, Word, Excel, PowerPoint, or individual page images",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-foreground">
            ProPDF <span className="text-primary">Editor</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            Free Forever
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            100% Offline
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 max-w-2xl"
        >
          <h1 className="font-display text-5xl font-bold mb-4 leading-tight">
            Professional PDF Editing,{" "}
            <span className="text-primary">Right in Your Browser</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Edit text, annotate, merge, split, and export PDFs — completely
            offline, forever free.
          </p>
        </motion.div>

        {/* Drop Zone */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          data-ocid="landing.dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            relative w-full max-w-2xl rounded-2xl border-2 border-dashed p-16 mb-10
            flex flex-col items-center gap-4 cursor-pointer transition-all duration-200
            ${
              isDragging
                ? "border-primary bg-accent/40 scale-[1.02]"
                : "border-border hover:border-primary/60 hover:bg-accent/20 bg-card"
            }
          `}
        >
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? "bg-primary" : "bg-muted"}`}
          >
            <Upload
              className={`w-8 h-8 ${isDragging ? "text-primary-foreground" : "text-muted-foreground"}`}
            />
          </div>
          <div className="text-center">
            <p className="text-foreground font-semibold text-lg mb-1">
              {isDragging ? "Drop your PDF here" : "Drag & drop your PDF"}
            </p>
            <p className="text-muted-foreground text-sm">
              or click to browse — any PDF file
            </p>
          </div>
          <Button
            data-ocid="landing.upload_button"
            variant="default"
            size="lg"
            className="mt-2 pointer-events-none"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            <Upload className="w-4 h-4 mr-2" />
            Open PDF File
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFileInput}
          />
        </motion.div>

        {/* Feature grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl w-full"
        >
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-card rounded-xl border border-border p-5 flex gap-4"
            >
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </motion.div>
      </main>

      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()}. Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
