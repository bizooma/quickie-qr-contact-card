// What goes on a card's Apple Wallet pass: pass.json, built from the card.
// Pure (no crypto, no I/O) so it can be tested; signing and zipping live in
// apple-pass.server.ts.

import type { LabeledValue } from "@/lib/card-model";
import { isLowProfile, lowProfileView, type CardPractice } from "@/lib/practice";

export const SITE = "https://quickieqr.com";
export const PKPASS_TYPE = "application/vnd.apple.pkpass";

/** Images the browser draws for a pass, and their pixel size (Apple's 1x,
 *  2x and 3x). The logo is fit inside its box; the thumbnail is square. */
export const PASS_IMAGE_SIZES = {
  "logo.png": [160, 50],
  "logo@2x.png": [320, 100],
  "logo@3x.png": [480, 150],
  "thumbnail.png": [90, 90],
  "thumbnail@2x.png": [180, 180],
  "thumbnail@3x.png": [270, 270],
} as const;
export type PassImageName = keyof typeof PASS_IMAGE_SIZES;

/** The card fields a pass uses. */
export type PassCard = {
  id: string;
  slug: string;
  label: string;
  full_name: string;
  job_title: string | null;
  company: string | null;
  phones: LabeledValue[];
  emails: LabeledValue[];
  website: string | null;
  location: string | null;
  accent_color: string;
  headshot_path: string | null;
  practice: CardPractice | null;
};

export type PassIdentity = { passTypeIdentifier: string; teamIdentifier: string };

type Rgb = [number, number, number];

/** "#1a2b3c" or "#abc" to [r, g, b]; anything else falls back to near-black. */
export function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return [17, 17, 17];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

const css = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`;

/** WCAG relative luminance, 0 (black) to 1 (white). */
function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** The pass is the card's accent color, with white or near-black text,
 *  whichever reads better, and labels a step quieter than the values. */
export function passColors(accent: string) {
  const bg = hexToRgb(accent);
  // Contrast of white vs. near-black (#14161f) text on this background.
  const L = luminance(bg);
  const dark: Rgb = [20, 22, 31];
  const white: Rgb = [255, 255, 255];
  const fg = (1.05 / (L + 0.05) >= (L + 0.05) / (luminance(dark) + 0.05) ? white : dark) as Rgb;
  const label = bg.map((c, i) => Math.round(c + (fg[i]! - c) * 0.72)) as Rgb;
  return { backgroundColor: css(bg), foregroundColor: css(fg), labelColor: css(label) };
}

const clip = (s: string | null | undefined, n = 60) => (s ?? "").trim().slice(0, n);

/** Whether the pass shows the person's photo (never on a low-profile card). */
export function passShowsPhoto(card: Pick<PassCard, "headshot_path" | "practice">): boolean {
  return !!card.headshot_path && !isLowProfile(card.practice);
}

/** pass.json for a card. `hasLogo` says whether a logo image is in the pass;
 *  without one the company (or QuickieQR) is written in the logo spot. */
export function buildPassJson(card: PassCard, id: PassIdentity, opts: { hasLogo: boolean }) {
  const view = lowProfileView(card);
  const url = `${SITE}/c/${card.slug}`;
  const name = clip(view.full_name) || "My card";
  const title = clip(view.job_title);
  const company = clip(view.company);

  const back: { key: string; label: string; value: string }[] = [];
  const low = isLowProfile(card.practice);
  // A low-profile card keeps personal contact details off the pass too.
  if (!low) {
    card.phones.slice(0, 3).forEach((p, i) => {
      if (p.value?.trim())
        back.push({ key: `phone${i}`, label: clip(p.label, 20) || "Phone", value: clip(p.value) });
    });
    card.emails.slice(0, 3).forEach((e, i) => {
      if (e.value?.trim())
        back.push({
          key: `email${i}`,
          label: clip(e.label, 20) || "Email",
          value: clip(e.value, 120),
        });
    });
  }
  if (card.website?.trim())
    back.push({ key: "website", label: "Website", value: clip(card.website, 200) });
  if (card.location?.trim())
    back.push({ key: "location", label: "Location", value: clip(card.location, 120) });
  back.push({ key: "card", label: "My card", value: url });
  back.push({
    key: "about",
    label: "About this pass",
    value:
      "Show the code and they can save your contact. If you change your card, add the pass again from QuickieQR to update it.",
  });

  return {
    formatVersion: 1,
    passTypeIdentifier: id.passTypeIdentifier,
    teamIdentifier: id.teamIdentifier,
    // One pass per card: adding it again replaces the old one in Wallet.
    serialNumber: card.id,
    organizationName: "QuickieQR",
    description: `${name} contact card`,
    ...(opts.hasLogo ? {} : { logoText: company || "QuickieQR" }),
    ...passColors(card.accent_color),
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: url,
        messageEncoding: "iso-8859-1",
        altText: "Scan to save my contact",
      },
    ],
    generic: {
      primaryFields: [{ key: "name", label: clip(card.label, 24).toUpperCase(), value: name }],
      secondaryFields: title ? [{ key: "title", label: "TITLE", value: title }] : [],
      auxiliaryFields:
        company && opts.hasLogo ? [{ key: "company", label: "COMPANY", value: company }] : [],
      backFields: back,
    },
  };
}
