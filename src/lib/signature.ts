// Pure, client-safe email signature builder. Output is email-client-safe HTML:
// tables + inline styles only, and never <img> (card images are private, expiring URLs).
import { contrastText, initials, normalizeUrl, type CardData } from "./card-model";

export const SIGNATURE_STYLES = [
  { id: "minimal", name: "Minimal", hint: "Text only" },
  { id: "classic", name: "Classic", hint: "Initials badge + details" },
  { id: "compact", name: "Compact", hint: "Single line" },
] as const;
export type SignatureStyle = (typeof SIGNATURE_STYLES)[number]["id"];

export const SIGNATURE_LINK_LIMIT = 4;
const FONT = "Arial, Helvetica, sans-serif";

export function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Only allow plain web/mail/tel links into hrefs. */
function safeHref(url: string): string | null {
  const u = normalizeUrl(url);
  return /^(https?:|mailto:|tel:)/i.test(u) ? escapeHtml(u) : null;
}

function a(href: string | null, text: string, color: string, extra = ""): string {
  const t = escapeHtml(text);
  return href ? `<a href="${href}" style="color:${color};text-decoration:none;${extra}">${t}</a>` : t;
}

export function buildSignatureHtml(card: CardData, style: SignatureStyle, cardUrl: string): string {
  const accent = /^#[0-9a-f]{6}$/i.test(card.accent_color) ? card.accent_color : "#E8553D";
  const onAccent = contrastText(accent);
  const name = escapeHtml(card.full_name.trim() || "Your name");
  const role = [card.job_title, card.company].filter((v): v is string => !!v?.trim()).map(escapeHtml).join(" · ");
  const phones = card.phones.filter((p) => p.value.trim());
  const email = card.emails.find((e) => e.value.trim())?.value.trim();
  const links = card.links.filter((l) => l.url.trim()).slice(0, SIGNATURE_LINK_LIMIT);
  const save = safeHref(cardUrl);

  const contactBits = [
    ...phones.map((p) => a(safeHref(`tel:${p.value.replace(/[^\d+]/g, "")}`), p.value.trim(), "#333333")),
    ...(email ? [a(safeHref(`mailto:${email}`), email, "#333333")] : []),
    ...(card.website ? [a(safeHref(card.website), card.website.replace(/^https?:\/\//, "").replace(/\/$/, ""), "#333333")] : []),
  ];
  const sep = `<span style="color:#BBBBBB;">&nbsp;|&nbsp;</span>`;
  const linkRow = links.map((l) => a(safeHref(l.url), l.label || l.icon, accent, "font-weight:bold;")).join(sep);
  const saveBtn = save
    ? `<a href="${save}" style="display:inline-block;background-color:${accent};color:${onAccent};font-family:${FONT};font-size:12px;font-weight:bold;text-decoration:none;padding:6px 12px;border-radius:4px;">Save my contact</a>`
    : "";

  if (style === "compact") {
    const parts = [`<strong style="color:#111111;">${name}</strong>`, role, ...contactBits, save ? a(save, "Save my contact", accent, "font-weight:bold;") : ""].filter(Boolean);
    return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td style="font-family:${FONT};font-size:13px;line-height:18px;color:#555555;border-left:3px solid ${accent};padding-left:8px;">${parts.join(sep)}</td></tr></table>`;
  }

  const textBlock =
    `<p style="margin:0;font-family:${FONT};font-size:16px;line-height:20px;font-weight:bold;color:#111111;">${name}</p>` +
    (role ? `<p style="margin:2px 0 0 0;font-family:${FONT};font-size:13px;line-height:18px;color:#555555;">${role}</p>` : "") +
    (contactBits.length ? `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:13px;line-height:18px;color:#333333;">${contactBits.join(sep)}</p>` : "") +
    (linkRow ? `<p style="margin:6px 0 0 0;font-family:${FONT};font-size:12px;line-height:18px;">${linkRow}</p>` : "") +
    (saveBtn ? `<p style="margin:10px 0 0 0;">${saveBtn}</p>` : "");

  if (style === "minimal") {
    return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td style="font-family:${FONT};border-top:2px solid ${accent};padding-top:10px;">${textBlock}</td></tr></table>`;
  }

  const badge = `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td width="64" height="64" align="center" valign="middle" style="width:64px;height:64px;background-color:${accent};color:${onAccent};font-family:${FONT};font-size:24px;font-weight:bold;border-radius:32px;text-align:center;">${escapeHtml(initials(card.full_name))}</td></tr></table>`;
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td valign="top" style="padding-right:14px;border-right:2px solid ${accent};">${badge}</td><td valign="top" style="padding-left:14px;">${textBlock}</td></tr></table>`;
}

/** Plain-text fallback used alongside text/html on the clipboard. */
export function buildSignatureText(card: CardData, cardUrl: string): string {
  const role = [card.job_title, card.company].filter(Boolean).join(" · ");
  const email = card.emails.find((e) => e.value.trim())?.value;
  return [card.full_name, role, ...card.phones.map((p) => p.value), email, card.website, `Save my contact: ${cardUrl}`]
    .filter((v): v is string => !!v?.trim())
    .join("\n");
}
