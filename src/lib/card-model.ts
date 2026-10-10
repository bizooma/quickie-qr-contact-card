// Pure card/contact helpers shared by the editor, public page, and exports.
// No browser or network dependencies so these stay unit-testable.

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
  accent_color: string;
  background_color: string;
  font: string;
  template: string;
  links: CardLink[];
};

export const TEMPLATES = [
  { id: "classic", name: "Classic", hint: "Centered photo, stacked details" },
  { id: "banner", name: "Banner", hint: "Color header with overlapping photo" },
  { id: "minimal", name: "Minimal", hint: "Left-aligned, editorial" },
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

export const LINK_ICONS = [
  "link",
  "linkedin",
  "x",
  "instagram",
  "youtube",
  "tiktok",
  "facebook",
  "github",
  "calendar",
  "payment",
  "website",
  "message",
] as const;

export function fontCss(font: string): string {
  return FONTS.find((f) => f.id === font)?.css ?? FONTS[0].css;
}

/** Guess an icon from a URL so pasting a link "just works". */
export function guessIcon(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("linkedin.com")) return "linkedin";
  if (u.includes("twitter.com") || u.includes("x.com/")) return "x";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("facebook.com")) return "facebook";
  if (u.includes("github.com")) return "github";
  if (u.includes("calendly.com") || u.includes("cal.com") || u.includes("savvycal"))
    return "calendar";
  if (
    u.includes("paypal") ||
    u.includes("venmo") ||
    u.includes("cash.app") ||
    u.includes("stripe.com") ||
    u.includes("buy.stripe")
  )
    return "payment";
  return "link";
}

export function normalizeUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;
  if (/^(https?:|mailto:|tel:)/i.test(t)) return t;
  return `https://${t}`;
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
  } = {},
): string {
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
  const name = card.full_name.trim() || "Contact";
  const parts = name.split(/\s+/);
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
  const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : (parts[0] ?? "");
  lines.push(`N:${esc(last)};${esc(first)};;;`);
  lines.push(`FN:${esc(name)}`);
  if (card.company) lines.push(`ORG:${esc(card.company)}`);
  if (card.job_title) lines.push(`TITLE:${esc(card.job_title)}`);
  for (const p of card.phones) {
    if (!p.value.trim()) continue;
    const type = /mobile|cell/i.test(p.label) ? "CELL" : /home/i.test(p.label) ? "HOME" : "WORK";
    lines.push(`TEL;TYPE=${type},VOICE:${esc(p.value.trim())}`);
  }
  for (const e of card.emails) {
    if (!e.value.trim()) continue;
    const type = /home|personal/i.test(e.label) ? "HOME" : "WORK";
    lines.push(`EMAIL;TYPE=INTERNET,${type}:${esc(e.value.trim())}`);
  }
  if (card.website) lines.push(`URL:${esc(normalizeUrl(card.website))}`);
  if (opts.cardUrl) lines.push(`URL;TYPE=Card:${esc(opts.cardUrl)}`);
  for (const l of card.links) {
    if (!l.url.trim()) continue;
    lines.push(
      `URL;TYPE=${esc(l.label || l.icon).replace(/[^A-Za-z0-9-]/g, "") || "Link"}:${esc(normalizeUrl(l.url))}`,
    );
  }
  if (card.location) lines.push(`ADR;TYPE=WORK:;;${esc(card.location)};;;;`);
  if (card.bio) lines.push(`NOTE:${esc(card.bio)}`);
  if (opts.photoBase64)
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
