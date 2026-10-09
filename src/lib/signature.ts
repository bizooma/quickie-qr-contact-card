// Email-signature HTML builder. Email clients only render table layouts with
// inline styles, so no classes, no flexbox, no external CSS — and no <img>:
// card media lives in a private bucket behind expiring signed URLs.
import { initials, normalizeUrl, type CardData } from "./card-model";

export const SIGNATURE_STYLES = [
  { id: "classic", name: "Classic", hint: "Initials badge + two columns" },
  { id: "minimal", name: "Minimal", hint: "Clean text lines" },
  { id: "compact", name: "Compact", hint: "Single line" },
] as const;

export type SignatureStyle = (typeof SIGNATURE_STYLES)[number]["id"];

export const MAX_SIGNATURE_LINKS = 4;

const FONT = "font-family:Arial,Helvetica,sans-serif;";

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Parts = {
  name: string;
  tagline: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  links: { label: string; url: string }[];
  accent: string;
  publicUrl: string;
};

function parts(card: CardData, publicUrl: string): Parts {
  const tagline = [card.job_title, card.company].filter(Boolean).join(" · ") || null;
  return {
    name: card.full_name.trim() || "Your Name",
    tagline,
    phone: card.phones[0]?.value.trim() || null,
    email: card.emails[0]?.value.trim() || null,
    website: card.website?.trim() || null,
    links: card.links
      .filter((l) => l.url.trim())
      .slice(0, MAX_SIGNATURE_LINKS)
      .map((l) => ({ label: l.label.trim() || "Link", url: normalizeUrl(l.url) })),
    accent: card.accent_color,
    publicUrl,
  };
}

function saveButton(p: Parts): string {
  return (
    `<a href="${esc(p.publicUrl)}" style="display:inline-block;background-color:${esc(p.accent)};` +
    `color:#ffffff;padding:7px 14px;border-radius:6px;text-decoration:none;font-size:12px;` +
    `font-weight:bold;${FONT}">Save my contact</a>`
  );
}

function contactLine(p: Parts): string {
  const bits = [p.phone, p.email, p.website ? p.website.replace(/^https?:\/\//, "") : null]
    .filter((b): b is string => !!b)
    .map(esc);
  return bits.join("&nbsp;&nbsp;·&nbsp;&nbsp;");
}

function linksLine(p: Parts): string {
  return p.links
    .map(
      (l) =>
        `<a href="${esc(l.url)}" style="color:${esc(p.accent)};text-decoration:none;font-size:12px;${FONT}">${esc(l.label)}</a>`,
    )
    .join('<span style="color:#9ca3af;font-size:12px;">&nbsp;·&nbsp;</span>');
}

function badgeCell(p: Parts): string {
  return (
    `<td style="width:56px;vertical-align:top;">` +
    `<table cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td align="center" style="width:52px;height:52px;background-color:${esc(p.accent)};border-radius:10px;` +
    `color:#ffffff;font-size:20px;font-weight:bold;${FONT}">${esc(initials(p.name))}</td>` +
    `</tr></table></td>`
  );
}

function infoRows(p: Parts): string {
  const rows = [
    `<tr><td style="font-size:16px;font-weight:bold;color:#111827;${FONT}padding-bottom:2px;">${esc(p.name)}</td></tr>`,
  ];
  if (p.tagline) {
    rows.push(
      `<tr><td style="font-size:13px;color:#6b7280;${FONT}padding-bottom:6px;">${esc(p.tagline)}</td></tr>`,
    );
  }
  const contact = contactLine(p);
  if (contact) {
    rows.push(
      `<tr><td style="font-size:13px;color:#374151;${FONT}padding-bottom:6px;">${contact}</td></tr>`,
    );
  }
  if (p.links.length) {
    rows.push(`<tr><td style="padding-bottom:10px;">${linksLine(p)}</td></tr>`);
  }
  rows.push(`<tr><td>${saveButton(p)}</td></tr>`);
  return rows.join("");
}

export function buildSignatureHtml(
  card: CardData,
  publicUrl: string,
  style: SignatureStyle,
): string {
  const p = parts(card, publicUrl);

  if (style === "compact") {
    const bits = [
      `<span style="font-weight:bold;color:#111827;">${esc(p.name)}</span>`,
      p.tagline ? `<span style="color:#6b7280;">${esc(p.tagline)}</span>` : null,
      contactLine(p) || null,
      `<a href="${esc(p.publicUrl)}" style="color:${esc(p.accent)};font-weight:bold;text-decoration:none;">Save my contact</a>`,
    ].filter(Boolean);
    return (
      `<table cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td style="font-size:13px;color:#374151;${FONT}">${bits.join('<span style="color:#9ca3af;">&nbsp;·&nbsp;</span>')}</td>` +
      `</tr></table>`
    );
  }

  const info = `<td style="vertical-align:top;${style === "classic" ? "padding-left:14px;" : ""}"><table cellpadding="0" cellspacing="0" border="0">${infoRows(p)}</table></td>`;
  const cells = style === "classic" ? badgeCell(p) + info : info;
  return `<table cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>`;
}
