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
