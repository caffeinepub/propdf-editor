export type ToolType =
  | "select"
  | "text-edit"
  | "add-text"
  | "ribbon"
  | "draw"
  | "highlight"
  | "stamp"
  | "signature"
  | "image"
  | "pages"
  | "export";

export interface TextItem {
  id: string;
  pageIndex: number; // 0-based
  x: number; // screen coords at current zoom (CSS pixels)
  y: number;
  width: number;
  height: number;
  text: string;
  originalText: string;
  fontSize: number; // alias for rawFontSize (PDF points)
  rawFontSize: number; // PDF height in points, NOT zoom-scaled
  fontName: string;
  fontWeight?: string;
  fontStyle?: string;
  transform: number[]; // original PDF transform array
  isModified: boolean;
  isNew: boolean;
  backgroundColor?: string; // sampled canvas color for seamless overlay
}

export interface RibbonItem {
  id: string;
  pageIndex: number;
  x: number; // pixel position on rendered page
  y: number;
  width: number; // full page width by default
  height: number; // matches the font line-height
  text: string;
  fontSize: number; // in px matching the display zoom
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  backgroundColor: string; // hex color sampled from canvas
}

export interface DrawPath {
  id: string;
  pageIndex: number;
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
  opacity: number;
  type: "draw";
}

export interface HighlightRect {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  type: "highlight";
}

export interface StampAnnotation {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  stampType: string;
  type: "stamp";
}

export interface SignatureAnnotation {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
  type: "signature";
}

export interface ImageAnnotation {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
  type: "image";
}

export type Annotation =
  | DrawPath
  | HighlightRect
  | StampAnnotation
  | SignatureAnnotation
  | ImageAnnotation;

export interface OcrWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface PageState {
  index: number; // original page index (0-based)
  hasText: boolean;
  ocrDone: boolean;
  ocrWords: OcrWord[];
}

export type StampType = "approved" | "confidential" | "draft" | "rejected";

export const STAMP_COLORS: Record<StampType, string> = {
  approved: "#22c55e",
  confidential: "#ef4444",
  draft: "#f59e0b",
  rejected: "#dc2626",
};

export const STAMP_LABELS: Record<StampType, string> = {
  approved: "APPROVED",
  confidential: "CONFIDENTIAL",
  draft: "DRAFT",
  rejected: "REJECTED",
};
