// Pure helpers for "scan my own business card": turn the AI's reading of the
// user's paper card into digital-card fields, and merge them into an existing
// card. No browser or network dependencies so these stay unit-testable.

import type { OwnCardScan } from "./ai-model";
import {
  ACCENT_PRESETS,
  guessIcon,
  normalizeUrl,
  type CardData,
  type CardLink,
  type LabeledValue,
} from "./card-model";

export type ScannedCardFields = Pick<
  CardData,
  | "full_name"
  | "job_title"
  | "company"
  | "phones"
  | "emails"
  | "website"
  | "location"
  | "bio"
  | "accent_color"
  | "background_color"
  | "links"
> & {
  headshot_path: string | null;
  logo_path: string | null;
};

/** "#abc", "abc", "#AABBCC" → "#AABBCC"; anything else → null. */
export function normalizeHex(value: string | null | undefined): string | null {
  const t = (value ?? "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(t))
    return `#${t
      .split("")
      .map((c) => c + c)
      .join("")
      .toUpperCase()}`;
  if (/^[0-9a-f]{6}$/i.test(t)) return `#${t.toUpperCase()}`;
  return null;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two "#RRGGBB" colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// Accents are used for buttons, icons and the banner; below this they wash
// out against the card background.
const MIN_ACCENT_CONTRAST = 2;

/** The card's background and accent, taken from the scan when they read
 *  cleanly and fall back to a readable preset otherwise. */
export function deriveCardColors(
  brand: string | null | undefined,
  background: string | null | undefined,
): { accent_color: string; background_color: string } {
  const bg = normalizeHex(background) ?? "#FFFFFF";
  const accent = normalizeHex(brand);
  if (accent && contrastRatio(accent, bg) >= MIN_ACCENT_CONTRAST) {
    return { accent_color: accent, background_color: bg };
  }
  const preset =
    ACCENT_PRESETS.find((c) => contrastRatio(c, bg) >= MIN_ACCENT_CONTRAST) ?? "#E8553D";
  return { accent_color: preset, background_color: bg };
}

function clean(value: string | null | undefined): string | null {
  const t = (value ?? "").trim();
  return t ? t : null;
}

function cleanList(items: LabeledValue[], fallbackLabel: string): LabeledValue[] {
  const seen = new Set<string>();
  const out: LabeledValue[] = [];
  for (const item of items) {
    const value = item.value.trim();
    const key = value.toLowerCase().replace(/[^a-z0-9@+]/g, "");
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push({ label: item.label.trim() || fallbackLabel, value });
  }
  return out;
}

function sameSite(a: string, b: string): boolean {
  const host = (u: string) => {
    try {
      return new URL(normalizeUrl(u)).host.replace(/^www\./, "").toLowerCase();
    } catch {
      return u.toLowerCase();
    }
  };
  return host(a) === host(b);
}

/** Maps the AI's reading of the user's own card onto digital-card fields. */
export function ownCardToFields(
  scan: OwnCardScan,
  images: { headshotPath?: string | null; logoPath?: string | null } = {},
): ScannedCardFields {
  const website = clean(scan.website);
  const links: CardLink[] = [];
  for (const l of scan.social_links) {
    const raw = l.url.trim();
    if (!raw) continue;
    const url = normalizeUrl(raw);
    if (website && sameSite(url, website)) continue;
    if (links.some((x) => x.url === url)) continue;
    links.push({ label: l.label.trim() || url, url, icon: guessIcon(url) });
  }
  return {
    full_name: scan.full_name.trim(),
    job_title: clean(scan.job_title),
    company: clean(scan.company),
    phones: cleanList(scan.phones, "Phone"),
    emails: cleanList(scan.emails, "Email"),
    website,
    location: clean(scan.address),
    bio: clean(scan.tagline),
    ...deriveCardColors(scan.brand_color, scan.background_color),
    links,
    headshot_path: images.headshotPath ?? null,
    logo_path: images.logoPath ?? null,
  };
}

/** Fills an existing card from a scan: scanned values win where present,
 *  existing values are kept where the scan found nothing, and new links are
 *  appended after the ones the card already has. */
export function mergeScannedIntoCard(card: CardData, scanned: ScannedCardFields): CardData {
  const pick = <T>(next: T | null, prev: T): T => (next === null || next === "" ? prev : next);
  const links = [...card.links];
  for (const l of scanned.links) {
    if (!links.some((x) => normalizeUrl(x.url) === l.url)) links.push(l);
  }
  return {
    ...card,
    full_name: scanned.full_name || card.full_name,
    job_title: pick(scanned.job_title, card.job_title),
    company: pick(scanned.company, card.company),
    phones: scanned.phones.length ? scanned.phones : card.phones,
    emails: scanned.emails.length ? scanned.emails : card.emails,
    website: pick(scanned.website, card.website),
    location: pick(scanned.location, card.location),
    bio: pick(scanned.bio, card.bio),
    accent_color: scanned.accent_color,
    background_color: scanned.background_color,
    headshot_path: pick(scanned.headshot_path, card.headshot_path),
    logo_path: pick(scanned.logo_path, card.logo_path),
    links,
  };
}
