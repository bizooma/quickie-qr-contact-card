// Pure helpers for placing a center logo on a QR code. The QR is generated at
// error-correction level H when a logo is shown, so covering ~6% of the area
// stays well within what scanners tolerate.

/** Side length of the square viewBox in a `qrcode`-generated SVG (0 0 N N). */
export function qrViewBoxSize(svg: string): number | null {
  const m = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && w === h ? w : null;
}

export type LogoBox = { x: number; y: number; size: number; pad: number };

/** Centered box for the logo plus its white backing pad, in viewBox units. */
export function logoBox(viewSize: number, fraction = 0.22): LogoBox {
  const size = viewSize * fraction;
  const pad = size * 0.14;
  return { x: (viewSize - size) / 2, y: (viewSize - size) / 2, size, pad };
}

/** Returns the QR SVG with a white-backed center logo appended. */
export function svgWithLogo(svg: string, logoHref: string): string {
  const view = qrViewBoxSize(svg);
  if (!view) return svg;
  const b = logoBox(view);
  const r = (b.size + b.pad * 2) * 0.18;
  const overlay =
    `<rect x="${b.x - b.pad}" y="${b.y - b.pad}" width="${b.size + b.pad * 2}" height="${b.size + b.pad * 2}" rx="${r}" fill="#FFFFFF"/>` +
    `<image x="${b.x}" y="${b.y}" width="${b.size}" height="${b.size}" href="${logoHref}" preserveAspectRatio="xMidYMid meet"/>`;
  return svg.replace("</svg>", `${overlay}</svg>`);
}
