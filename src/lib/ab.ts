// Headline A/B test for the landing page. Pure logic here (unit-tested);
// storage and rendering live with the page.

export type HeadlineVariant = "a" | "c";

export const AB_STORAGE_KEY = "ck-ab-headline";

export const HEADLINES: Record<
  HeadlineVariant,
  { lines: [string, string]; accented: "first" | "second"; sub: string }
> = {
  // A — outcome + enemy (live default since the CRO rebuild)
  a: {
    lines: ["Never lose another lead to a ", "paper card."],
    accented: "second",
    sub: "Share your card with one QR scan and capture their details back, automatically. No app for them to install.",
  },
  // C — the original brand rhythm, with the meaning restored in the subhead
  c: {
    lines: ["One tap. They have you. ", "\nYou have them."],
    accented: "second",
    sub: "A digital business card that shares your details and captures theirs — no app, no typing, no lost leads.",
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
