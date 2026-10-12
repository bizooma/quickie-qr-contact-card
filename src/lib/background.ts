// Pure layout math and backdrop presets for the virtual-background generator.
// Canvas rendering lives in the route; everything here is unit-testable.

export const BG_WIDTH = 1920;
export const BG_HEIGHT = 1080;

export const QR_SIZES = [
  { id: "s", name: "Small", px: 200 },
  { id: "m", name: "Medium", px: 280 },
  { id: "l", name: "Large", px: 380 },
] as const;
export type QrSizeId = (typeof QR_SIZES)[number]["id"];

export const CORNERS = [
  { id: "tl", name: "Top left" },
  { id: "tr", name: "Top right" },
  { id: "bl", name: "Bottom left" },
  { id: "br", name: "Bottom right" },
] as const;
export type CornerId = (typeof CORNERS)[number]["id"];

const MARGIN = 48;
const PAD = 24;
const LABEL_H = 64;

export type PanelLayout = {
  panel: { x: number; y: number; w: number; h: number; radius: number };
  qr: { x: number; y: number; size: number };
  label: { x: number; y: number; w: number };
};

/** Where the white QR panel and its texts sit for a given corner and QR size. */
export function panelLayout(corner: CornerId, sizeId: QrSizeId): PanelLayout {
  const size = QR_SIZES.find((s) => s.id === sizeId)?.px ?? 280;
  const w = size + PAD * 2;
  const h = size + PAD * 2 + LABEL_H;
  const x = corner === "tl" || corner === "bl" ? MARGIN : BG_WIDTH - MARGIN - w;
  const y = corner === "tl" || corner === "tr" ? MARGIN : BG_HEIGHT - MARGIN - h;
  return {
    panel: { x, y, w, h, radius: 20 },
    qr: { x: x + PAD, y: y + PAD, size },
    label: { x: x + w / 2, y: y + PAD + size + 14, w: w - PAD },
  };
}

// ---------- backdrops ----------

export type Backdrop =
  | { id: string; name: string; type: "gradient"; from: string; to: string }
  | { id: string; name: string; type: "solid"; color: string };

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Lighten (positive pct) or darken (negative pct) a #rrggbb color. */
export function shade(hex: string, pct: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const f = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16);
    const v = pct >= 0 ? c + (255 - c) * pct : c * (1 + pct);
    return clamp(v).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(2)}${f(4)}`;
}

/** Built-in backdrops; the first two derive from the card's accent color. */
export function backdropPresets(accent: string): Backdrop[] {
  return [
    {
      id: "accent",
      name: "Brand",
      type: "gradient",
      from: shade(accent, -0.55),
      to: shade(accent, -0.15),
    },
    {
      id: "accent-soft",
      name: "Brand soft",
      type: "gradient",
      from: shade(accent, 0.82),
      to: shade(accent, 0.55),
    },
    { id: "charcoal", name: "Charcoal", type: "gradient", from: "#111113", to: "#2b2b30" },
    { id: "slate", name: "Slate", type: "gradient", from: "#1e293b", to: "#475569" },
    { id: "sand", name: "Warm sand", type: "gradient", from: "#f5efe6", to: "#e4d5bd" },
    { id: "white", name: "Studio white", type: "solid", color: "#f4f4f5" },
  ];
}

/** Cover-fit source rectangle: crops the image like CSS object-fit: cover. */
export function coverFit(
  imgW: number,
  imgH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const target = BG_WIDTH / BG_HEIGHT;
  const src = imgW / imgH;
  if (src > target) {
    const sw = imgH * target;
    return { sx: (imgW - sw) / 2, sy: 0, sw, sh: imgH };
  }
  const sh = imgW / target;
  return { sx: 0, sy: (imgH - sh) / 2, sw: imgW, sh };
}

// ---------- editable designs ----------
// A design is a fill plus an ordered stack of layers (last drawn on top), all
// in 1920×1080 canvas pixels. The route renders it to a canvas for the
// preview and PNG, and to a layered PDF that Canva imports as editable pieces.

export type Fill =
  | { type: "solid"; color: string }
  | { type: "gradient"; from: string; to: string; angle: number }
  | { type: "photo"; dim: number; blur: number };

type LayerBase = { id: string; x: number; y: number; visible: boolean; opacity: number };

export type QrLayer = LayerBase & { kind: "qr"; size: number; panel: string; caption: boolean };
export type ImageShape = "square" | "rounded" | "circle";
export type ImageLayer = LayerBase & {
  kind: "image";
  role: "logo" | "photo" | "upload";
  name: string;
  w: number;
  // Source width / height; a circle is always drawn square.
  aspect: number;
  shape: ImageShape;
  // White rounded backing so dark logos read on dark backdrops.
  plate: boolean;
};
export type TextLayer = LayerBase & {
  kind: "text";
  text: string;
  size: number;
  color: string;
  bold: boolean;
  shadow: boolean;
};
export type Layer = QrLayer | ImageLayer | TextLayer;
export type Design = { fill: Fill; layers: Layer[] };

export type Box = { x: number; y: number; w: number; h: number };
export type Placement = CornerId | "center";

export const QR_SIZE_RANGE = { min: 160, max: 520 } as const;
export const IMAGE_W_RANGE = { min: 60, max: BG_WIDTH } as const;
export const TEXT_SIZE_RANGE = { min: 20, max: 200 } as const;

let seq = 0;
function newId(kind: string): string {
  seq += 1;
  return `${kind}-${Date.now().toString(36)}-${seq}`;
}

export function fillFromBackdrop(b: Backdrop): Fill {
  return b.type === "solid"
    ? { type: "solid", color: b.color }
    : { type: "gradient", from: b.from, to: b.to, angle: 135 };
}

/** Start and end points of a CSS-style linear gradient (0° = to top,
 *  90° = to right) spanning the whole canvas. */
export function gradientLine(angle: number): { x0: number; y0: number; x1: number; y1: number } {
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = Math.abs((BG_WIDTH / 2) * dx) + Math.abs((BG_HEIGHT / 2) * dy);
  const cx = BG_WIDTH / 2;
  const cy = BG_HEIGHT / 2;
  return { x0: cx - dx * half, y0: cy - dy * half, x1: cx + dx * half, y1: cy + dy * half };
}

/** On-canvas box of a layer. Text width depends on the font, so the caller
 *  passes the measured width. */
export function layerBox(layer: Layer, textWidth = 0): Box {
  switch (layer.kind) {
    case "qr":
      return {
        x: layer.x,
        y: layer.y,
        w: layer.size + PAD * 2,
        h: layer.size + PAD * 2 + (layer.caption ? LABEL_H : 0),
      };
    case "image": {
      const h = layer.shape === "circle" ? layer.w : layer.w / layer.aspect;
      return { x: layer.x, y: layer.y, w: layer.w, h };
    }
    case "text": {
      const lines = layer.text.split("\n").length;
      return { x: layer.x, y: layer.y, w: textWidth, h: layer.size * TEXT_LINE * lines };
    }
  }
}

export const TEXT_LINE = 1.2;

/** Keeps a box fully on the canvas when it fits, otherwise pins its top-left. */
export function clampPosition(box: Box): { x: number; y: number } {
  const x = Math.min(Math.max(box.x, 0), Math.max(0, BG_WIDTH - box.w));
  const y = Math.min(Math.max(box.y, 0), Math.max(0, BG_HEIGHT - box.h));
  return { x: Math.round(x), y: Math.round(y) };
}

/** Top-left position that snaps a box to a corner (with margin) or the center. */
export function snapPosition(where: Placement, w: number, h: number): { x: number; y: number } {
  if (where === "center") {
    return { x: Math.round((BG_WIDTH - w) / 2), y: Math.round((BG_HEIGHT - h) / 2) };
  }
  const left = where === "tl" || where === "bl";
  const top = where === "tl" || where === "tr";
  return clampPosition({
    x: left ? MARGIN : BG_WIDTH - MARGIN - w,
    y: top ? MARGIN : BG_HEIGHT - MARGIN - h,
    w,
    h,
  });
}

export function layerSize(layer: Layer): number {
  return layer.kind === "qr" ? layer.size : layer.kind === "image" ? layer.w : layer.size;
}

export function sizeRange(layer: Layer): { min: number; max: number } {
  return layer.kind === "qr"
    ? QR_SIZE_RANGE
    : layer.kind === "image"
      ? IMAGE_W_RANGE
      : TEXT_SIZE_RANGE;
}

/** Resizes a layer around the center of its current box, keeping it on canvas. */
export function resizeLayer<L extends Layer>(layer: L, size: number, box: Box): L {
  const { min, max } = sizeRange(layer);
  const next = Math.round(Math.min(max, Math.max(min, size)));
  const r = next / layerSize(layer);
  const w = box.w * r;
  const h = box.h * r;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const pos = clampPosition({ x: cx - w / 2, y: cy - h / 2, w, h });
  const sized = layer.kind === "image" ? { ...layer, w: next } : { ...layer, size: next };
  return { ...sized, ...pos };
}

/** Default design for a card: its accent backdrop and the QR bottom-right. */
export function defaultDesign(accent: string): Design {
  const qr: QrLayer = {
    id: "qr",
    kind: "qr",
    size: 280,
    panel: "#FFFFFF",
    caption: true,
    visible: true,
    opacity: 1,
    x: 0,
    y: 0,
  };
  const box = layerBox(qr);
  return {
    fill: fillFromBackdrop(backdropPresets(accent)[0]!),
    layers: [{ ...qr, ...snapPosition("br", box.w, box.h) }],
  };
}

export function newImageLayer(role: ImageLayer["role"], name: string, aspect: number): ImageLayer {
  const safeAspect = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  const base = {
    id: newId(role),
    kind: "image" as const,
    role,
    name,
    aspect: safeAspect,
    visible: true,
    opacity: 1,
  };
  if (role === "photo") {
    const w = 240;
    return { ...base, w, shape: "circle", plate: false, ...snapPosition("tr", w, w) };
  }
  if (role === "logo") {
    // Fit within 320×160.
    const w = Math.round(Math.min(320, 160 * safeAspect));
    return { ...base, w, shape: "rounded", plate: false, ...snapPosition("tl", w, w / safeAspect) };
  }
  const w = Math.round(Math.min(640, 400 * safeAspect));
  return {
    ...base,
    w,
    shape: "rounded",
    plate: false,
    ...snapPosition("center", w, w / safeAspect),
  };
}

export function newTextLayer(text: string, color: string): TextLayer {
  const size = 64;
  return {
    id: newId("text"),
    kind: "text",
    text,
    size,
    color,
    bold: true,
    shadow: false,
    visible: true,
    opacity: 1,
    x: MARGIN,
    y: Math.round(BG_HEIGHT / 2 - (size * TEXT_LINE) / 2),
  };
}

/** Moves a layer one step up (+1) or down (-1) the stack. */
export function moveLayer(layers: Layer[], id: string, dir: 1 | -1): Layer[] {
  const i = layers.findIndex((l) => l.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= layers.length) return layers;
  const next = [...layers];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** Text the PDF's built-in Helvetica can encode (WinAnsi); anything else is
 *  exported as an image so it still shows up in Canva. */
export function pdfSafeText(text: string): boolean {
  return /^[\n\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC]*$/.test(
    text,
  );
}

/** Readable caption color for a QR panel color. */
export function captionColors(panel: string): { name: string; sub: string } {
  const h = panel.replace("#", "");
  if (h.length !== 6) return { name: "#111827", sub: "#6b7280" };
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (0.299 * r! + 0.587 * g! + 0.114 * b!) / 255;
  return lum > 0.55 ? { name: "#111827", sub: "#6b7280" } : { name: "#ffffff", sub: "#d1d5db" };
}

export const QR_PAD = PAD;
export const QR_LABEL_H = LABEL_H;
