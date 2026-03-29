import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type {
  Annotation,
  PageState,
  RibbonItem,
  TextItem,
  ToolType,
} from "../types/editor";

export interface EditorContextValue {
  // PDF state
  pdfDocument: any;
  setPdfDocument: (doc: any) => void;
  pdfBytes: Uint8Array | null;
  setPdfBytes: (b: Uint8Array) => void;
  fileName: string;
  setFileName: (n: string) => void;
  pageCount: number;
  setPageCount: (c: number) => void;
  currentPage: number;
  setCurrentPage: (p: number) => void;
  pageOrder: number[];
  setPageOrder: (o: number[]) => void;

  // Text overlays: pageIndex -> items
  textItems: Map<number, TextItem[]>;
  setTextItems: (pageIndex: number, items: TextItem[]) => void;
  updateTextItem: (pageIndex: number, id: string, text: string) => void;
  addTextItem: (item: TextItem) => void;

  // Ribbon items: pageIndex -> items
  ribbonItems: Map<number, RibbonItem[]>;
  addRibbonItem: (item: RibbonItem) => void;
  updateRibbonItem: (
    pageIndex: number,
    id: string,
    partial: Partial<RibbonItem>,
  ) => void;
  removeRibbonItem: (pageIndex: number, id: string) => void;

  // Annotations: pageIndex -> list
  annotations: Map<number, Annotation[]>;
  addAnnotation: (ann: Annotation) => void;
  clearAnnotations: (pageIndex: number) => void;

  // Page states
  pageStates: Map<number, PageState>;
  setPageState: (pageIndex: number, state: Partial<PageState>) => void;

  // Tool state
  activeTool: ToolType;
  setActiveTool: (t: ToolType) => void;
  zoom: number;
  setZoom: (z: number) => void;
  drawColor: string;
  setDrawColor: (c: string) => void;
  drawStrokeWidth: number;
  setDrawStrokeWidth: (w: number) => void;
  selectedStamp: string;
  setSelectedStamp: (s: string) => void;

  // Clean background toggle
  cleanBackground: boolean;
  setCleanBackground: (v: boolean) => void;

  // Signature
  signatureDataUrl: string | null;
  setSignatureDataUrl: (url: string | null) => void;

  // Modal state
  showSignatureModal: boolean;
  setShowSignatureModal: (v: boolean) => void;
  showMergeModal: boolean;
  setShowMergeModal: (v: boolean) => void;
  showSplitModal: boolean;
  setShowSplitModal: (v: boolean) => void;
  showExportModal: boolean;
  setShowExportModal: (v: boolean) => void;

  // Undo/redo
  history: any[];
  historyIndex: number;
  pushHistory: (entry: any) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Refs for page canvases (for OCR + thumbnail rendering)
  canvasRefs: Map<number, HTMLCanvasElement>;
  registerCanvas: (pageIndex: number, canvas: HTMLCanvasElement | null) => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

type HistorySnapshot = {
  textItems: string;
  ribbonItems: string;
};

function serializeTextMap(m: Map<number, TextItem[]>): string {
  return JSON.stringify(Array.from(m.entries()));
}
function deserializeTextMap(s: string): Map<number, TextItem[]> {
  return new Map(JSON.parse(s) as [number, TextItem[]][]);
}
function serializeRibbonMap(m: Map<number, RibbonItem[]>): string {
  return JSON.stringify(Array.from(m.entries()));
}
function deserializeRibbonMap(s: string): Map<number, RibbonItem[]> {
  return new Map(JSON.parse(s) as [number, RibbonItem[]][]);
}
function serializeSnapshot(
  t: Map<number, TextItem[]>,
  r: Map<number, RibbonItem[]>,
): string {
  const snap: HistorySnapshot = {
    textItems: serializeTextMap(t),
    ribbonItems: serializeRibbonMap(r),
  };
  return JSON.stringify(snap);
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [textItemsMap, setTextItemsMap] = useState<Map<number, TextItem[]>>(
    new Map(),
  );
  const [ribbonItemsMap, setRibbonItemsMap] = useState<
    Map<number, RibbonItem[]>
  >(new Map());
  const [annotationsMap, setAnnotationsMap] = useState<
    Map<number, Annotation[]>
  >(new Map());
  const [pageStatesMap, setPageStatesMap] = useState<Map<number, PageState>>(
    new Map(),
  );
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [zoom, setZoom] = useState(1.0);
  const [drawColor, setDrawColor] = useState("#ef4444");
  const [drawStrokeWidth, setDrawStrokeWidth] = useState(3);
  const [selectedStamp, setSelectedStamp] = useState("approved");
  const [cleanBackground, setCleanBackground] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const canvasRefsMap = useRef<Map<number, HTMLCanvasElement>>(new Map());

  // Undo/redo stacks — use state counts so React re-renders when stack changes
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  // Keep refs to current maps for use inside callbacks
  const ribbonItemsMapRef = useRef(ribbonItemsMap);
  ribbonItemsMapRef.current = ribbonItemsMap;
  const textItemsMapRef = useRef(textItemsMap);
  textItemsMapRef.current = textItemsMap;

  const setTextItems = useCallback((pageIndex: number, items: TextItem[]) => {
    setTextItemsMap((prev) => {
      const next = new Map(prev);
      next.set(pageIndex, items);
      return next;
    });
  }, []);

  const updateTextItem = useCallback(
    (pageIndex: number, id: string, text: string) => {
      setTextItemsMap((prev) => {
        undoStack.current.push(
          serializeSnapshot(prev, ribbonItemsMapRef.current),
        );
        redoStack.current = [];
        setUndoCount((c) => c + 1);
        setRedoCount(0);
        const next = new Map(prev);
        const items = next.get(pageIndex) ?? [];
        next.set(
          pageIndex,
          items.map((item) =>
            item.id === id ? { ...item, text, isModified: true } : item,
          ),
        );
        return next;
      });
    },
    [],
  );

  const addTextItem = useCallback((item: TextItem) => {
    setTextItemsMap((prev) => {
      undoStack.current.push(
        serializeSnapshot(prev, ribbonItemsMapRef.current),
      );
      redoStack.current = [];
      setUndoCount((c) => c + 1);
      setRedoCount(0);
      const next = new Map(prev);
      const items = next.get(item.pageIndex) ?? [];
      next.set(item.pageIndex, [...items, item]);
      return next;
    });
  }, []);

  const addRibbonItem = useCallback((item: RibbonItem) => {
    setRibbonItemsMap((prev) => {
      undoStack.current.push(serializeSnapshot(textItemsMapRef.current, prev));
      redoStack.current = [];
      setUndoCount((c) => c + 1);
      setRedoCount(0);
      const next = new Map(prev);
      const items = next.get(item.pageIndex) ?? [];
      next.set(item.pageIndex, [...items, item]);
      return next;
    });
  }, []);

  const updateRibbonItem = useCallback(
    (pageIndex: number, id: string, partial: Partial<RibbonItem>) => {
      setRibbonItemsMap((prev) => {
        const next = new Map(prev);
        const items = next.get(pageIndex) ?? [];
        next.set(
          pageIndex,
          items.map((r) => (r.id === id ? { ...r, ...partial } : r)),
        );
        return next;
      });
    },
    [],
  );

  const removeRibbonItem = useCallback((pageIndex: number, id: string) => {
    setRibbonItemsMap((prev) => {
      undoStack.current.push(serializeSnapshot(textItemsMapRef.current, prev));
      redoStack.current = [];
      setUndoCount((c) => c + 1);
      setRedoCount(0);
      const next = new Map(prev);
      const items = next.get(pageIndex) ?? [];
      next.set(
        pageIndex,
        items.filter((r) => r.id !== id),
      );
      return next;
    });
  }, []);

  const addAnnotation = useCallback((ann: Annotation) => {
    setAnnotationsMap((prev) => {
      const next = new Map(prev);
      const items = next.get(ann.pageIndex) ?? [];
      next.set(ann.pageIndex, [...items, ann]);
      return next;
    });
  }, []);

  const clearAnnotations = useCallback((pageIndex: number) => {
    setAnnotationsMap((prev) => {
      const next = new Map(prev);
      next.set(pageIndex, []);
      return next;
    });
  }, []);

  const setPageState = useCallback(
    (pageIndex: number, state: Partial<PageState>) => {
      setPageStatesMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(pageIndex) ?? {
          index: pageIndex,
          hasText: false,
          ocrDone: false,
          ocrWords: [],
        };
        next.set(pageIndex, { ...existing, ...state });
        return next;
      });
    },
    [],
  );

  const pushHistory = useCallback((_entry: any) => {}, []);

  const undo = useCallback(() => {
    const snapshot = undoStack.current.pop();
    if (!snapshot) return;
    const parsed: HistorySnapshot = JSON.parse(snapshot);
    // Push current state to redo before reverting
    const currentSnapshot = serializeSnapshot(
      textItemsMapRef.current,
      ribbonItemsMapRef.current,
    );
    redoStack.current.push(currentSnapshot);
    setUndoCount((c) => Math.max(0, c - 1));
    setRedoCount((c) => c + 1);
    setTextItemsMap(deserializeTextMap(parsed.textItems));
    setRibbonItemsMap(deserializeRibbonMap(parsed.ribbonItems));
  }, []);

  const redo = useCallback(() => {
    const snapshot = redoStack.current.pop();
    if (!snapshot) return;
    const parsed: HistorySnapshot = JSON.parse(snapshot);
    // Push current state to undo before re-applying
    const currentSnapshot = serializeSnapshot(
      textItemsMapRef.current,
      ribbonItemsMapRef.current,
    );
    undoStack.current.push(currentSnapshot);
    setUndoCount((c) => c + 1);
    setRedoCount((c) => Math.max(0, c - 1));
    setTextItemsMap(deserializeTextMap(parsed.textItems));
    setRibbonItemsMap(deserializeRibbonMap(parsed.ribbonItems));
  }, []);

  const registerCanvas = useCallback(
    (pageIndex: number, canvas: HTMLCanvasElement | null) => {
      if (canvas) {
        canvasRefsMap.current.set(pageIndex, canvas);
      } else {
        canvasRefsMap.current.delete(pageIndex);
      }
    },
    [],
  );

  const value: EditorContextValue = {
    pdfDocument,
    setPdfDocument,
    pdfBytes,
    setPdfBytes,
    fileName,
    setFileName,
    pageCount,
    setPageCount,
    currentPage,
    setCurrentPage,
    pageOrder,
    setPageOrder,
    textItems: textItemsMap,
    setTextItems,
    updateTextItem,
    addTextItem,
    ribbonItems: ribbonItemsMap,
    addRibbonItem,
    updateRibbonItem,
    removeRibbonItem,
    annotations: annotationsMap,
    addAnnotation,
    clearAnnotations,
    pageStates: pageStatesMap,
    setPageState,
    activeTool,
    setActiveTool,
    zoom,
    setZoom,
    drawColor,
    setDrawColor,
    drawStrokeWidth,
    setDrawStrokeWidth,
    selectedStamp,
    setSelectedStamp,
    cleanBackground,
    setCleanBackground,
    signatureDataUrl,
    setSignatureDataUrl,
    showSignatureModal,
    setShowSignatureModal,
    showMergeModal,
    setShowMergeModal,
    showSplitModal,
    setShowSplitModal,
    showExportModal,
    setShowExportModal,
    history: [],
    historyIndex: -1,
    pushHistory,
    undo,
    redo,
    canUndo: undoCount > 0,
    canRedo: redoCount > 0,
    canvasRefs: canvasRefsMap.current,
    registerCanvas,
  };

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within EditorProvider");
  return ctx;
}
