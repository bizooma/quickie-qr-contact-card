// Pure card/contact helpers shared by the editor, public page, and exports.
// No browser or network dependencies so these stay unit-testable.

import type { CardTheme } from "./card-theme";
import type { CardExchange, VCardPart } from "./exchange";
import { guessPlatform, LINK_PLATFORMS, tidyWebAddress } from "./link-catalog";

export type LabeledValue = { label: string; value: string };

export type CardLink = { id?: string | undefined; label: string; url: string; icon: string };

export type CardData = {
  slug: string;
  label: string;
  full_name: string;
  job_title: string | null;
  company: string | null;
  phones: LabeledValue[];
  emails: LabeledValue[];
  website: string | null;
  location: string | null;
  bio: string | null;
  headshot_path: string | null;
  logo_path: string | null;
  /** "standard": as tall as the profile photo; "large": bigger still. */
  logo_size: string;
  /** Premium: a photo behind the Banner layout's header (private path). */
  banner_path: string | null;
  accent_color: string;
  background_color: string;
  font: string;
  template: string;
  /** Liquid Glass settings; null or absent means the defaults. */
  theme?: CardTheme | null | undefined;
  /** Save-contact and share-back settings; null or absent means the defaults. */
  exchange?: CardExchange | null | undefined;
  links: CardLink[];
};

export const TEMPLATES = [
  { id: "classic", name: "Classic", hint: "Centered photo, stacked details" },
  { id: "banner", name: "Banner", hint: "Color header with overlapping photo" },
  { id: "minimal", name: "Minimal", hint: "Left-aligned, editorial" },
  { id: "glass", name: "Liquid Glass", hint: "Frosted panels over color" },
] as const;

export const FONTS = [
  { id: "sans", name: "Modern", css: "var(--font-sans)" },
  { id: "display", name: "Bold", css: "var(--font-display)" },
  { id: "serif", name: "Elegant", css: "var(--font-serif)" },
  { id: "mono", name: "Technical", css: "var(--font-mono)" },
] as const;

export const ACCENT_PRESETS = [
  "#E8553D",
  "#1F2937",
  "#2563EB",
  "#0F766E",
  "#CA8A04",
  "#BE185D",
  "#7C3AED",
];
export const BACKGROUND_PRESETS = [
  "#FFFFFF",
  "#FAF7F2",
  "#F1F5F9",
  "#111827",
  "#0B1F1A",
  "#1C1917",
];

/** Every platform a link can be, in picker order (see link-catalog.ts). */
export const LINK_ICONS: readonly string[] = LINK_PLATFORMS.map((p) => p.id);

export function fontCss(font: string): string {
  return FONTS.find((f) => f.id === font)?.css ?? FONTS[0].css;
}

/** Guess an icon from a URL so pasting a link "just works". */
export function guessIcon(url: string): string {
  return guessPlatform(url);
}

/** An address ready to open: tidied (see tidyWebAddress), with "https://"
 *  added when it was typed without one. */
export function normalizeUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;
  if (/^(mailto:|tel:|sms:)/i.test(t)) return t;
  const tidy = tidyWebAddress(t);
  return /^https?:/.test(tidy) ? tidy : `https://${tidy}`;
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,48}$/;

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base.length >= 3 ? base : `card-${base}`.replace(/-+$/, "");
}

/** Readable text color for a given hex background. */
export function contrastText(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#111111";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#111111" : "#FFFFFF";
}

// ---------- vCard ----------

function esc(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** Fold lines at 75 octets per RFC 2425 (approximated by chars). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(" " + line.slice(i, i + 74));
  return parts.join("\r\n");
}

export function buildVCard(
  card: CardData,
  opts: {
    photoBase64?: string | undefined;
    photoType?: string | undefined;
    cardUrl?: string | undefined;
    /** Parts the owner chose to leave out. The name and card link always stay. */
    hide?: readonly VCardPart[] | undefined;
  } = {},
): string {
  const hidden = new Set<VCardPart>(opts.hide ?? []);
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
  const name = card.full_name.trim() || "Contact";
  const parts = name.split(/\s+/);
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
  const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : (parts[0] ?? "");
  lines.push(`N:${esc(last)};${esc(first)};;;`);
  lines.push(`FN:${esc(name)}`);
  if (card.company && !hidden.has("company")) lines.push(`ORG:${esc(card.company)}`);
  if (card.job_title && !hidden.has("company")) lines.push(`TITLE:${esc(card.job_title)}`);
  for (const p of hidden.has("phones") ? [] : card.phones) {
    if (!p.value.trim()) continue;
    const type = /mobile|cell/i.test(p.label) ? "CELL" : /home/i.test(p.label) ? "HOME" : "WORK";
    lines.push(`TEL;TYPE=${type},VOICE:${esc(p.value.trim())}`);
  }
  for (const e of hidden.has("emails") ? [] : card.emails) {
    if (!e.value.trim()) continue;
    const type = /home|personal/i.test(e.label) ? "HOME" : "WORK";
    lines.push(`EMAIL;TYPE=INTERNET,${type}:${esc(e.value.trim())}`);
  }
  if (card.website && !hidden.has("website")) lines.push(`URL:${esc(normalizeUrl(card.website))}`);
  if (opts.cardUrl) lines.push(`URL;TYPE=Card:${esc(opts.cardUrl)}`);
  for (const l of hidden.has("links") ? [] : card.links) {
    if (!l.url.trim()) continue;
    lines.push(
      `URL;TYPE=${esc(l.label || l.icon).replace(/[^A-Za-z0-9-]/g, "") || "Link"}:${esc(normalizeUrl(l.url))}`,
    );
  }
  if (card.location && !hidden.has("location"))
    lines.push(`ADR;TYPE=WORK:;;${esc(card.location)};;;;`);
  if (card.bio && !hidden.has("bio")) lines.push(`NOTE:${esc(card.bio)}`);
  if (opts.photoBase64 && !hidden.has("photo"))
    lines.push(`PHOTO;ENCODING=b;TYPE=${opts.photoType ?? "JPEG"}:${opts.photoBase64}`);
  lines.push("END:VCARD");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** The fields a captured contact can contribute to a vCard. */
export type ContactVCardInput = {
  full_name: string;
  job_title?: string | null | undefined;
  company?: string | null | undefined;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  website?: string | null | undefined;
  linkedin_url?: string | null | undefined;
  address?: string | null | undefined;
  note?: string | null | undefined;
};

export function buildContactVCard(c: ContactVCardInput): string {
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
  const name = c.full_name.trim() || "Contact";
  const parts = name.split(/\s+/);
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
  const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : (parts[0] ?? "");
  lines.push(`N:${esc(last)};${esc(first)};;;`);
  lines.push(`FN:${esc(name)}`);
  if (c.company?.trim()) lines.push(`ORG:${esc(c.company.trim())}`);
  if (c.job_title?.trim()) lines.push(`TITLE:${esc(c.job_title.trim())}`);
  if (c.phone?.trim()) lines.push(`TEL;TYPE=CELL,VOICE:${esc(c.phone.trim())}`);
  if (c.email?.trim()) lines.push(`EMAIL;TYPE=INTERNET,WORK:${esc(c.email.trim())}`);
  if (c.website?.trim()) lines.push(`URL:${esc(normalizeUrl(c.website))}`);
  if (c.linkedin_url?.trim()) lines.push(`URL;TYPE=LinkedIn:${esc(normalizeUrl(c.linkedin_url))}`);
  if (c.address?.trim()) lines.push(`ADR;TYPE=WORK:;;${esc(c.address.trim())};;;;`);
  if (c.note?.trim()) lines.push(`NOTE:${esc(c.note.trim())}`);
  lines.push("END:VCARD");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** One .vcf holding many contacts — phones import the whole batch from a single file. */
export function contactsToVcf(contacts: ContactVCardInput[]): string {
  return contacts
    .filter((c) => c.full_name.trim())
    .map(buildContactVCard)
    .join("");
}

// ---------- CSV ----------

export type ContactRow = {
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  website: string | null;
  linkedin_url: string | null;
  address: string | null;
  met_at: string | null;
  source: string;
  card_label: string | null;
  tags: string[];
  note: string | null;
  created_at: string;
};

function csvCell(v: string): string {
  // Prevent spreadsheet formula injection from share-back submissions.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function contactsToCsv(rows: ContactRow[]): string {
  const header = [
    "Name",
    "Email",
    "Phone",
    "Company",
    "Title",
    "Website",
    "LinkedIn",
    "Address",
    "Met at",
    "Source",
    "Card",
    "Tags",
    "Note",
    "Captured at",
  ];
  const body = rows.map((r) =>
    [
      r.full_name,
      r.email ?? "",
      r.phone ?? "",
      r.company ?? "",
      r.job_title ?? "",
      r.website ?? "",
      r.linkedin_url ?? "",
      r.address ?? "",
      r.met_at ?? "",
      r.source,
      r.card_label ?? "",
      r.tags.join("; "),
      r.note ?? "",
      r.created_at,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...body].join("\r\n");
}

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

// Personal-mail providers whose domain says nothing about a company.
const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "zoho.com",
  "fastmail.com",
  "hey.com",
  "mailinator.com",
  "comcast.net",
  "att.net",
  "verizon.net",
  "sbcglobal.net",
]);

/** The company web domain behind a contact — from their website when given,
 *  else from a work email's domain. Personal-mail domains don't count. */
export function companyDomain(opts: {
  website?: string | null;
  email?: string | null;
}): string | null {
  const site = (opts.website ?? "").trim();
  if (site) {
    try {
      const host = new URL(normalizeUrl(site)).hostname.replace(/^www\./i, "").toLowerCase();
      if (host.includes(".")) return host;
    } catch {
      // Not a parseable URL — fall through to the email domain.
    }
  }
  const email = (opts.email ?? "").trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at > 0) {
    const domain = email.slice(at + 1);
    if (domain.includes(".") && !FREE_MAIL_DOMAINS.has(domain)) return domain;
  }
  return null;
}

/** Public favicon lookup — the closest thing to "the company's logo" that
 *  needs no scraping, API keys, or storage. */
export function companyLogoUrl(domain: string, size = 128): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/** Personal cards a free account can't edit: every one but its oldest
 *  (mirrors card_is_locked in migration 0032). Locked cards stay live, so
 *  printed QR codes keep working; team cards are never locked. */
export function lockedCardIds(
  cards: { id: string; user_id: string; org_id: string | null; created_at: string }[],
  userId: string,
  plan: "free" | "pro" | "premium",
): Set<string> {
  if (plan !== "free") return new Set();
  const own = cards
    .filter((c) => c.user_id === userId && !c.org_id)
    .sort((a, b) =>
      a.created_at === b.created_at
        ? a.id.localeCompare(b.id)
        : Date.parse(a.created_at) - Date.parse(b.created_at),
    );
  return new Set(own.slice(1).map((c) => c.id));
}

export const LOGO_SIZES = [
  { id: "standard", name: "Same as photo" },
  { id: "large", name: "Larger" },
] as const;

/** An uploaded logo's box next to a profile photo `photo` px across: as tall
 *  as the photo ("standard") or 1.4× ("large"), and at most twice as wide as
 *  it is tall so wide wordmarks stay in proportion. */
export function cardLogoBox(photo: number, size: string): { height: number; maxWidth: number } {
  const height = Math.round(photo * (size === "large" ? 1.4 : 1));
  return { height, maxWidth: height * 2 };
}
