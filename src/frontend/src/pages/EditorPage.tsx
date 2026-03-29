import * as pdfjsLib from "pdfjs-dist";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import PDFCanvas from "../components/editor/PDFCanvas";
import PagePanel from "../components/editor/PagePanel";
import PropertiesPanel from "../components/editor/PropertiesPanel";
import Toolbar from "../components/editor/Toolbar";
import ExportModal from "../components/modals/ExportModal";
import MergeModal from "../components/modals/MergeModal";
import SignatureModal from "../components/modals/SignatureModal";
import SplitModal from "../components/modals/SplitModal";
import { useEditor } from "../context/EditorContext";

// Import the worker as raw text to avoid MIME type issues on the platform.
// @ts-ignore
import workerRaw from "pdfjs-dist/build/pdf.worker.min.mjs?raw";
const workerBlob = new Blob([workerRaw], { type: "application/javascript" });
const workerBlobUrl = URL.createObjectURL(workerBlob);
pdfjsLib.GlobalWorkerOptions.workerSrc = workerBlobUrl;

const CMAP_URL = "/cmaps/";
const STANDARD_FONT_DATA_URL = "/standard_fonts/";

interface Props {
  initialBytes: Uint8Array;
  initialFileName: string;
  onClose: () => void;
}

export default function EditorPage({
  initialBytes,
  initialFileName,
  onClose,
}: Props) {
  const {
    setPdfDocument,
    setPdfBytes,
    setFileName,
    setPageCount,
    setPageOrder,
    setCurrentPage,
    showSignatureModal,
    showMergeModal,
    showSplitModal,
    showExportModal,
    undo,
    redo,
  } = useEditor();

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const loadPDF = useCallback(
    async (bytes: Uint8Array, name: string) => {
      const setDoc = (doc: any) => {
        setPdfDocument(doc);
        setPdfBytes(bytes);
        setFileName(name);
        setPageCount(doc.numPages);
        setPageOrder(Array.from({ length: doc.numPages }, (_, i) => i));
        setCurrentPage(0);
      };
      const baseData = () => bytes.slice();

      try {
        const doc = await pdfjsLib.getDocument({
          data: baseData(),
          cMapUrl: CMAP_URL,
          cMapPacked: true,
          standardFontDataUrl: STANDARD_FONT_DATA_URL,
          disableRange: true,
          disableStream: true,
          stopAtErrors: false,
          isEvalSupported: false,
          verbosity: 0,
        }).promise;
        setDoc(doc);
        toast.success(`Loaded: ${name}`);
        return;
      } catch (err: any) {
        if (
          err?.name === "PasswordException" ||
          err?.code === 1 ||
          err?.code === 2
        ) {
          toast.error(
            "This PDF is password-protected. Please remove the password first.",
          );
          return;
        }
        console.warn("PDF attempt 1 failed:", err);
      }

      try {
        const doc = await pdfjsLib.getDocument({
          data: baseData(),
          cMapUrl: CMAP_URL,
          cMapPacked: true,
          standardFontDataUrl: STANDARD_FONT_DATA_URL,
          disableRange: true,
          disableStream: true,
          stopAtErrors: false,
          disableFontFace: true,
          useSystemFonts: true,
          isEvalSupported: false,
          verbosity: 0,
        }).promise;
        setDoc(doc);
        toast.success(`Loaded: ${name} (compatibility mode)`);
        return;
      } catch (err2) {
        console.warn("PDF attempt 2 failed:", err2);
      }

      try {
        const doc = await pdfjsLib.getDocument({
          data: baseData(),
          disableRange: true,
          disableStream: true,
          stopAtErrors: false,
          disableFontFace: true,
          useSystemFonts: true,
          isEvalSupported: false,
          verbosity: 0,
        }).promise;
        setDoc(doc);
        toast.success(`Loaded: ${name} (fallback mode)`);
        return;
      } catch (err3) {
        console.warn("PDF attempt 3 failed:", err3);
      }

      try {
        const doc = await pdfjsLib.getDocument({
          data: baseData(),
          disableRange: true,
          disableStream: true,
          stopAtErrors: false,
          disableFontFace: true,
          useSystemFonts: true,
          isEvalSupported: false,
          verbosity: 0,
          // @ts-ignore
          ownerPassword: "",
        }).promise;
        setDoc(doc);
        toast.success(`Loaded: ${name} (restricted PDF)`);
        return;
      } catch (err4) {
        console.error("All PDF load attempts failed:", err4);
        toast.error(
          "Could not open this PDF. The file may use an unsupported feature. Try re-saving it in another PDF viewer first.",
        );
      }
    },
    [
      setPdfDocument,
      setPdfBytes,
      setFileName,
      setPageCount,
      setPageOrder,
      setCurrentPage,
    ],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally run once on mount
  useEffect(() => {
    loadPDF(initialBytes, initialFileName);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Toolbar onClose={onClose} />
      <div className="flex flex-1 overflow-hidden">
        <PagePanel />
        <main
          className="flex-1 overflow-auto bg-muted/30 scrollbar-thin"
          id="pdf-scroll-container"
        >
          <PDFCanvas />
        </main>
        <PropertiesPanel />
      </div>
      {showSignatureModal && <SignatureModal />}
      {showMergeModal && <MergeModal onMerge={loadPDF} />}
      {showSplitModal && <SplitModal />}
      {showExportModal && <ExportModal />}
    </div>
  );
}
