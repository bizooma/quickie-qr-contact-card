// Canvas drawing for virtual-background designs (browser only). The preview,
// the PNG download and the Canva PDF's raster pieces all come from here so
// they always match.

import {
  BG_HEIGHT,
  BG_WIDTH,
  captionColors,
  coverFit,
  gradientLine,
  layerBox,
  QR_CAPTION,
  QR_PAD,
  TEXT_LINE,
  type Box,
  type Design,
  type Fill,
  type ImageLayer,
  type Layer,
  type TextLayer,
} from "./background";

export type DesignAssets = {
  // Backdrop photo for a "photo" fill.
  photo: HTMLImageElement | null;
  // The card's QR code (square, white quiet zone included).
  qr: HTMLImageElement | null;
  // Image layers' sources, keyed by layer id.
  images: Record<string, HTMLImageElement>;
};

export const TEXT_FONT = "Helvetica, Arial, sans-serif";
const PLATE_PAD = 16;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function textFont(layer: TextLayer): string {
  return `${layer.bold ? "700" : "400"} ${layer.size}px ${TEXT_FONT}`;
}

/** Widest line of a text layer, in canvas pixels. */
export function measureText(ctx: CanvasRenderingContext2D, layer: TextLayer): number {
  ctx.save();
  ctx.font = textFont(layer);
  const w = Math.max(0, ...layer.text.split("\n").map((l) => ctx.measureText(l).width));
  ctx.restore();
  return Math.ceil(w);
}

export function boxOf(ctx: CanvasRenderingContext2D, layer: Layer): Box {
  return layerBox(layer, layer.kind === "text" ? measureText(ctx, layer) : 0);
}

// Blur by downscaling then scaling back up: works in every browser,
// including Safari, which lacks ctx.filter.
function drawBlurredCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, blur: number) {
  const { sx, sy, sw, sh } = coverFit(img.naturalWidth, img.naturalHeight);
  if (blur <= 0) {
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, BG_WIDTH, BG_HEIGHT);
    return;
  }
  const factor = 1 / (1 + blur * 1.5);
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(BG_WIDTH * factor));
  small.height = Math.max(1, Math.round(BG_HEIGHT * factor));
  const sctx = small.getContext("2d");
  if (!sctx) return;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(img, sx, sy, sw, sh, 0, 0, small.width, small.height);
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, BG_WIDTH, BG_HEIGHT);
  ctx.restore();
}

export function drawFill(
  ctx: CanvasRenderingContext2D,
  fill: Fill,
  photo: HTMLImageElement | null,
) {
  if (fill.type === "photo" && photo) {
    drawBlurredCover(ctx, photo, fill.blur);
    if (fill.dim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fill.dim})`;
      ctx.fillRect(0, 0, BG_WIDTH, BG_HEIGHT);
    }
    return;
  }
  if (fill.type === "gradient") {
    const { x0, y0, x1, y1 } = gradientLine(fill.angle);
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, fill.from);
    g.addColorStop(1, fill.to);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = fill.type === "solid" ? fill.color : "#1e293b";
  }
  ctx.fillRect(0, 0, BG_WIDTH, BG_HEIGHT);
}

/** An image layer's picture with its shape (and optional white plate) baked
 *  in, at `scale` × its on-canvas size. */
export function imageLayerCanvas(
  layer: ImageLayer,
  img: HTMLImageElement,
  scale = 1,
): HTMLCanvasElement {
  const box = layerBox(layer);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(box.w * scale));
  c.height = Math.max(1, Math.round(box.h * scale));
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.scale(scale, scale);
  const { w, h } = box;
  let inset = 0;
  if (layer.plate) {
    ctx.fillStyle = "#ffffff";
    if (layer.shape === "circle") {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
    } else {
      roundedRect(ctx, 0, 0, w, h, layer.shape === "rounded" ? 24 : 0);
    }
    ctx.fill();
    inset = Math.min(PLATE_PAD, w / 6);
  }
  const dw = w - inset * 2;
  const dh = h - inset * 2;
  ctx.save();
  if (layer.shape === "circle") {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, dw / 2, 0, Math.PI * 2);
    ctx.clip();
    // Cover-crop to a centered square.
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      inset,
      inset,
      dw,
      dh,
    );
  } else {
    if (layer.shape === "rounded") {
      roundedRect(ctx, inset, inset, dw, dh, 16);
      ctx.clip();
    }
    // Contain within the box (the plate inset keeps the source aspect).
    const s = Math.min(dw / img.naturalWidth, dh / img.naturalHeight);
    const iw = img.naturalWidth * s;
    const ih = img.naturalHeight * s;
    ctx.drawImage(img, inset + (dw - iw) / 2, inset + (dh - ih) / 2, iw, ih);
  }
  ctx.restore();
  return c;
}

export function drawText(ctx: CanvasRenderingContext2D, layer: TextLayer) {
  ctx.save();
  ctx.font = textFont(layer);
  ctx.fillStyle = layer.color;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  if (layer.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = layer.size * 0.25;
    ctx.shadowOffsetY = layer.size * 0.05;
  }
  layer.text.split("\n").forEach((line, i) => {
    ctx.fillText(line, layer.x, layer.y + i * layer.size * TEXT_LINE + layer.size * 0.1);
  });
  ctx.restore();
}

export function drawQrPanel(
  ctx: CanvasRenderingContext2D,
  layer: Extract<Layer, { kind: "qr" }>,
  assets: DesignAssets,
  { panelOnly = false }: { panelOnly?: boolean } = {},
) {
  const box = layerBox(layer);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = layer.panel;
  roundedRect(ctx, box.x, box.y, box.w, box.h, 20);
  ctx.fill();
  ctx.restore();
  if (panelOnly) return;
  if (assets.qr) {
    ctx.drawImage(assets.qr, box.x + QR_PAD, box.y + QR_PAD, layer.size, layer.size);
  }
  if (layer.caption) {
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = captionColors(layer.panel).name;
    ctx.font = `600 22px ${TEXT_FONT}`;
    ctx.fillText(QR_CAPTION, box.x + box.w / 2, box.y + QR_PAD + layer.size + 10, box.w - QR_PAD);
  }
}

export function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, assets: DesignAssets) {
  if (!layer.visible) return;
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  if (layer.kind === "qr") drawQrPanel(ctx, layer, assets);
  else if (layer.kind === "text") drawText(ctx, layer);
  else {
    const img = assets.images[layer.id];
    if (img) ctx.drawImage(imageLayerCanvas(layer, img), layer.x, layer.y);
  }
  ctx.restore();
}

/** Draws the full design and returns each layer's on-canvas box. */
export function renderDesign(
  ctx: CanvasRenderingContext2D,
  design: Design,
  assets: DesignAssets,
): Record<string, Box> {
  ctx.clearRect(0, 0, BG_WIDTH, BG_HEIGHT);
  drawFill(ctx, design.fill, assets.photo);
  const boxes: Record<string, Box> = {};
  for (const layer of design.layers) {
    drawLayer(ctx, layer, assets);
    boxes[layer.id] = boxOf(ctx, layer);
  }
  return boxes;
}

export function canvasBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), type, quality),
  );
}

/** Downscales an image for upload: JPEG for photos, PNG when it may have
 *  transparency (logos, cut-outs). */
export async function imageForUpload(
  img: HTMLImageElement,
  { max, keepAlpha }: { max: number; keepAlpha: boolean },
): Promise<Blob> {
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * s));
  c.height = Math.max(1, Math.round(img.naturalHeight * s));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return keepAlpha ? canvasBlob(c, "image/png") : canvasBlob(c, "image/jpeg", 0.88);
}
