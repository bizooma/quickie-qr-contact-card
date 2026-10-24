// First-touch signup attribution. Pure: the browser glue (localStorage,
// window) lives in the callers so this stays unit-testable.

export const ATTRIBUTION_KEY = "ck-attrib";

const PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "ref",
] as const;

export type Attribution = Partial<
  Record<(typeof PARAMS)[number] | "ref_card" | "landing" | "referrer" | "at", string>
>;

/** What the URL says about where a visitor came from, or null when it says
 *  nothing (a plain visit is not attribution). `?ref=card&c=<slug>` and
 *  `?ref=shareback&c=<slug>` are the links on public cards; `c` is only kept
 *  alongside a `ref` so a stray `c` can't claim a referral. */
export function attributionFromUrl(
  url: URL,
  referrer: string,
  now = new Date(),
): Attribution | null {
  const out: Attribution = {};
  for (const k of PARAMS) {
    const v = url.searchParams.get(k)?.trim();
    if (v) out[k] = v.slice(0, 200);
  }
  const card = url.searchParams.get("c")?.trim();
  if (card && out.ref) out.ref_card = card.slice(0, 80).toLowerCase();
  if (Object.keys(out).length === 0) return null;
  out.landing = url.pathname.slice(0, 120);
  try {
    const host = referrer ? new URL(referrer).hostname : "";
    if (host && host !== url.hostname) out.referrer = host;
  } catch {
    // unparseable referrer — leave it out
  }
  out.at = now.toISOString();
  return out;
}

/** Stores the first attribution seen in this browser; later visits never
 *  overwrite it, so an ad click followed by a direct return stays an ad signup. */
export function captureAttribution(storage: Storage, url: URL, referrer: string): void {
  if (storage.getItem(ATTRIBUTION_KEY)) return;
  const a = attributionFromUrl(url, referrer);
  if (a) storage.setItem(ATTRIBUTION_KEY, JSON.stringify(a));
}

export function readAttribution(storage: Storage): Record<string, string> {
  try {
    const raw = storage.getItem(ATTRIBUTION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === "string"),
    );
  } catch {
    return {};
  }
}
