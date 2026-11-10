// Open Graph card image: rendered client-side on a canvas after card saves,
// stored in card-media, and served from the public card page's meta tags so
// shared links unfurl with a real preview. Layout math stays pure for tests.

import { contrastText, initials, type CardData } from "./card-model";
import { resolveTheme, type ResolvedTheme } from "./card-theme";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export type OgLayout = {
  band: { x: number; y: number; w: number; h: number };
  avatar: { cx: number; cy: number; r: number };
  name: { x: number; y: number; size: number; maxWidth: number };
  subtitle: { x: number; y: number; size: number; maxWidth: number };
  footer: { x: number; y: number; size: number };
};

/** Fixed layout: accent band down the left, avatar + text block beside it. */
export function ogLayout(): OgLayout {
  return {
    band: { x: 0, y: 0, w: 18, h: OG_HEIGHT },
    avatar: { cx: 200, cy: OG_HEIGHT / 2, r: 110 },
    name: { x: 360, y: OG_HEIGHT / 2 - 16, size: 68, maxWidth: OG_WIDTH - 360 - 60 },
    subtitle: { x: 360, y: OG_HEIGHT / 2 + 48, size: 34, maxWidth: OG_WIDTH - 360 - 60 },
    footer: { x: 360, y: OG_HEIGHT - 70, size: 24 },
  };
}

/** Truncate with an ellipsis using a measure function (canvas measureText in prod). */
export function ellipsize(text: string, maxWidth: number, measure: (s: string) => number): string {
  if (measure(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && measure(`${t}…`) > maxWidth) t = t.slice(0, -1).trimEnd();
  return `${t}…`;
}

export function ogSubtitle(card: Pick<CardData, "job_title" | "company">): string {
  return [card.job_title, card.company].filter(Boolean).join(" · ");
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The Liquid Glass backdrop: the card's mesh as four soft blobs, with one
 *  frosted panel over it for the text to sit on. A canvas cannot blur what is
 *  behind a shape, so the panel is a little more solid than on the card. */
function drawGlassBackdrop(ctx: CanvasRenderingContext2D, glass: ResolvedTheme) {
  ctx.fillStyle = glass.mesh.base;
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);
  const blobs: [number, number, number][] = [
    [140, 90, 430],
    [1080, 150, 470],
    [250, 620, 430],
    [980, 640, 390],
  ];
  blobs.forEach(([x, y, r], i) => {
    const color = glass.mesh.blobs[i] ?? glass.mesh.base;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, `${color}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);
  });
  roundedRect(ctx, 44, 60, OG_WIDTH - 88, OG_HEIGHT - 120, 44);
  ctx.fillStyle = `rgba(${glass.glass.rgb}, ${Math.min(0.92, glass.glass.alpha + 0.14)})`;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.stroke();
}

/** Draws the OG card. Returns null when the browser can't produce a PNG. */
export async function renderOgImage(
  card: CardData,
  headshotUrl: string | null,
  /** `unbranded`: a team that removed our branding (see get_public_card). */
  opts: { unbranded?: boolean | undefined } = {},
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = OG_WIDTH;
  canvas.height = OG_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const L = ogLayout();
  // Liquid Glass cards share with their own look; the other layouts keep the
  // background colour and accent band.
  const glass = card.template === "glass" ? resolveTheme(card) : null;
  const fg = glass ? glass.glass.fg : contrastText(card.background_color);
  const muted = glass
    ? glass.glass.muted
    : fg === "#FFFFFF"
      ? "rgba(255,255,255,0.7)"
      : "rgba(17,17,17,0.62)";
  const display = '"Bricolage Grotesque", system-ui, sans-serif';
  const sans = '"Manrope", system-ui, sans-serif';
  try {
    await Promise.all([
      document.fonts.load(`700 ${L.name.size}px ${display}`),
      document.fonts.load(`500 ${L.subtitle.size}px ${sans}`),
    ]);
  } catch {
    // Fall back to whatever is loaded; layout is unchanged.
  }

  if (glass) {
    drawGlassBackdrop(ctx, glass);
    // A light ring, as on the card, so the photo lifts off the glass.
    ctx.beginPath();
    ctx.arc(L.avatar.cx, L.avatar.cy, L.avatar.r + 7, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fill();
  } else {
    ctx.fillStyle = card.background_color;
    ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);
    ctx.fillStyle = card.accent_color;
    ctx.fillRect(L.band.x, L.band.y, L.band.w, L.band.h);
  }

  // Avatar: headshot when it loads cleanly, initials disc otherwise.
  const img = headshotUrl ? await loadImage(headshotUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(L.avatar.cx, L.avatar.cy, L.avatar.r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) {
    const side = Math.min(img.width, img.height);
    ctx.drawImage(
      img,
      (img.width - side) / 2,
      (img.height - side) / 2,
      side,
      side,
      L.avatar.cx - L.avatar.r,
      L.avatar.cy - L.avatar.r,
      L.avatar.r * 2,
      L.avatar.r * 2,
    );
  } else {
    ctx.fillStyle = card.accent_color;
    ctx.fillRect(
      L.avatar.cx - L.avatar.r,
      L.avatar.cy - L.avatar.r,
      L.avatar.r * 2,
      L.avatar.r * 2,
    );
    ctx.fillStyle = contrastText(card.accent_color);
    ctx.font = `700 ${Math.round(L.avatar.r * 0.7)}px ${display}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials(card.full_name || "?"), L.avatar.cx, L.avatar.cy);
  }
  ctx.restore();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = fg;
  ctx.font = `700 ${L.name.size}px ${display}`;
  ctx.fillText(
    ellipsize(
      card.full_name || "Digital business card",
      L.name.maxWidth,
      (s) => ctx.measureText(s).width,
    ),
    L.name.x,
    L.name.y,
  );

  const subtitle = ogSubtitle(card);
  if (subtitle) {
    ctx.fillStyle = muted;
    ctx.font = `500 ${L.subtitle.size}px ${sans}`;
    ctx.fillText(
      ellipsize(subtitle, L.subtitle.maxWidth, (s) => ctx.measureText(s).width),
      L.subtitle.x,
      L.subtitle.y,
    );
  }

  ctx.fillStyle = muted;
  ctx.font = `600 ${L.footer.size}px ${sans}`;
  // On glass the footer moves up to sit inside the panel.
  ctx.fillText(
    opts.unbranded ? "Save my contact" : "Save my contact · ContactKickstart",
    L.footer.x,
    L.footer.y - (glass ? 36 : 0),
  );

  try {
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  } catch {
    // A tainted canvas (headshot without CORS) throws; retry without the photo.
    return headshotUrl ? renderOgImage(card, null) : null;
  }
}
