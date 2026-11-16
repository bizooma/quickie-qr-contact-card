// Layered PDF export of a virtual-background design. Canva's PDF import turns
// each piece into its own element: text stays editable, and the logo, photos,
// QR code and backdrop come in as separate images. Loaded on demand so pdf-lib
// stays out of the main bundle.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  BG_HEIGHT,
  BG_WIDTH,
  captionColors,
  layerBox,
  pdfSafeText,
  QR_CAPTION,
  QR_PAD,
  TEXT_LINE,
  type Design,
  type Layer,
  type TextLayer,
} from "./background";
import {
  canvasBlob,
  drawFill,
  drawText,
  imageLayerCanvas,
  measureText,
  type DesignAssets,
} from "./background-render";

function color(hex: string) {
  const h = hex.replace("#", "");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  return h.length === 6 ? rgb(n(0), n(2), n(4)) : rgb(0, 0, 0);
}

function roundedRectPath(w: number, h: number, r: number): string {
  return `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
}

async function pngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Uint8Array(await (await canvasBlob(canvas, "image/png")).arrayBuffer());
}

// PDF y runs bottom-up; designs are top-down.
const flipY = (y: number, h: number) => BG_HEIGHT - y - h;

async function addText(
  pdf: PDFDocument,
  page: PDFPage,
  layer: TextLayer,
  fonts: { regular: PDFFont; bold: PDFFont },
) {
  if (pdfSafeText(layer.text)) {
    const font = layer.bold ? fonts.bold : fonts.regular;
    layer.text.split("\n").forEach((line, i) => {
      const top = layer.y + i * layer.size * TEXT_LINE + layer.size * 0.1;
      page.drawText(line, {
        x: layer.x,
        y: BG_HEIGHT - top - layer.size * 0.78,
        size: layer.size,
        font,
        color: color(layer.color),
        opacity: layer.opacity,
      });
    });
    return;
  }
  // Characters Helvetica can't encode: place the text as an image instead.
  const scratch = document.createElement("canvas");
  const sctx = scratch.getContext("2d");
  if (!sctx) return;
  const box = layerBox(layer, measureText(sctx, layer));
  const pad = Math.ceil(layer.size * 0.3);
  scratch.width = Math.max(1, Math.ceil(box.w + pad * 2));
  scratch.height = Math.max(1, Math.ceil(box.h + pad * 2));
  drawText(sctx, { ...layer, x: pad, y: pad });
  const img = await pdf.embedPng(await pngBytes(scratch));
  page.drawImage(img, {
    x: box.x - pad,
    y: flipY(box.y - pad, scratch.height),
    width: scratch.width,
    height: scratch.height,
    opacity: layer.opacity,
  });
}

async function addLayer(
  pdf: PDFDocument,
  page: PDFPage,
  layer: Layer,
  assets: DesignAssets,
  fonts: { regular: PDFFont; bold: PDFFont },
) {
  if (!layer.visible) return;
  if (layer.kind === "text") return addText(pdf, page, layer, fonts);
  if (layer.kind === "image") {
    const src = assets.images[layer.id];
    if (!src) return;
    const box = layerBox(layer);
    const img = await pdf.embedPng(await pngBytes(imageLayerCanvas(layer, src, 2)));
    page.drawImage(img, {
      x: box.x,
      y: flipY(box.y, box.h),
      width: box.w,
      height: box.h,
      opacity: layer.opacity,
    });
    return;
  }
  // QR panel: vector frame, QR image, editable caption.
  const box = layerBox(layer);
  page.drawSvgPath(roundedRectPath(box.w, box.h, 20), {
    x: box.x,
    y: BG_HEIGHT - box.y,
    color: color(layer.panel),
    opacity: layer.opacity,
  });
  if (assets.qr) {
    const c = document.createElement("canvas");
    c.width = c.height = assets.qr.naturalWidth || layer.size * 2;
    c.getContext("2d")?.drawImage(assets.qr, 0, 0, c.width, c.height);
    const qr = await pdf.embedPng(await pngBytes(c));
    page.drawImage(qr, {
      x: box.x + QR_PAD,
      y: flipY(box.y + QR_PAD, layer.size),
      width: layer.size,
      height: layer.size,
      opacity: layer.opacity,
    });
  }
  if (layer.caption) {
    const font = fonts.bold;
    let size = 22;
    while (size > 10 && font.widthOfTextAtSize(QR_CAPTION, size) > box.w - QR_PAD) size -= 1;
    const top = box.y + QR_PAD + layer.size + 10;
    page.drawText(QR_CAPTION, {
      x: box.x + (box.w - font.widthOfTextAtSize(QR_CAPTION, size)) / 2,
      y: BG_HEIGHT - top - size * 0.78,
      size,
      font,
      color: color(captionColors(layer.panel).name),
      opacity: layer.opacity,
    });
  }
}

/** Builds a 1920×1080 PDF of the design with each layer as its own element. */
export async function designToPdf(design: Design, assets: DesignAssets): Promise<Blob> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Virtual background");
  pdf.setCreator("QuickieQR");
  const page = pdf.addPage([BG_WIDTH, BG_HEIGHT]);
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  if (design.fill.type === "solid") {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: BG_WIDTH,
      height: BG_HEIGHT,
      color: color(design.fill.color),
    });
  } else {
    // Gradients and photos go in as one backdrop image.
    const c = document.createElement("canvas");
    c.width = BG_WIDTH;
    c.height = BG_HEIGHT;
    const ctx = c.getContext("2d");
    if (ctx) drawFill(ctx, design.fill, assets.photo);
    const bytes = new Uint8Array(await (await canvasBlob(c, "image/jpeg", 0.92)).arrayBuffer());
    const img = await pdf.embedJpg(bytes);
    page.drawImage(img, { x: 0, y: 0, width: BG_WIDTH, height: BG_HEIGHT });
  }

  for (const layer of design.layers) await addLayer(pdf, page, layer, assets, fonts);
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
