// Headline A/B test for the landing page. Pure logic here (unit-tested);
// storage and rendering live with the page.

export type HeadlineVariant = "a" | "c";

export const AB_STORAGE_KEY = "qq-ab-headline";

export const HEADLINES: Record<
  HeadlineVariant,
  { lines: [string, string]; accented: "first" | "second"; sub: string }
> = {
  // A — the product in three words
  a: {
    lines: ["Scan. Saved. ", "Done."],
    accented: "second",
    sub: "Hold up your QuickieQR code. They point their camera, tap once, and you're in their contacts before the handshake's over. One more tap and they're in yours.",
  },
  // C — speed, framed against the thing everyone already does
  c: {
    lines: ["Quicker than ", "a handshake."],
    accented: "second",
    sub: "Your digital business card, one scan away. No app for them, no typing for anyone, and their details come straight back to you.",
  },
};

/** Sticky 50/50 assignment: a stored variant always wins; otherwise the
 *  random draw decides and the caller persists it. */
export function pickVariant(stored: string | null, random: number): HeadlineVariant {
  if (stored === "a" || stored === "c") return stored;
  return random < 0.5 ? "a" : "c";
}

/** Event meta carrying the variant, e.g. "hero|v=a". Unassigned (SSR,
 *  storage blocked) stays the bare location so baseline rows parse too. */
export function variantMeta(from: string, variant: HeadlineVariant | null): string {
  return variant ? `${from}|v=${variant}` : from;
}
