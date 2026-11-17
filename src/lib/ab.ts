// Headline A/B test for the landing page. Pure logic here (unit-tested);
// storage and rendering live with the page.

export type HeadlineVariant = "a" | "c";

export const AB_STORAGE_KEY = "qq-ab-headline";

export const HEADLINES: Record<
  HeadlineVariant,
  { lines: [string, string]; accented: "first" | "second"; sub: string }
> = {
  // A: the promise, said as the thing people forget to do
  a: {
    lines: ["Never forget a ", "follow-up."],
    accented: "second",
    sub: "Scan their card or let them scan yours. QuickieQR writes the follow-up email and reminds you to send it, so the people you meet actually hear from you.",
  },
  // C: the same promise, framed around the moment you meet
  c: {
    lines: ["Every handshake, ", "followed up."],
    accented: "second",
    sub: "Swap cards with one scan. The next morning your follow-up is already written, with a reminder to send it. No app for them, no typing for you.",
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
