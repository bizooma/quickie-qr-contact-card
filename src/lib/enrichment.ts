// Client-safe helpers that turn AI enrichment output into pending suggestion rows.
import type { EnrichmentResult } from "./ai-model";

export const ENRICH_FIELDS = ["job_title", "company", "website", "linkedin_url"] as const;
export type EnrichField = (typeof ENRICH_FIELDS)[number];

export const ENRICH_LABELS: Record<EnrichField, string> = {
  job_title: "Title", company: "Company", website: "Website", linkedin_url: "LinkedIn",
};

export type Suggestion = { field: EnrichField; current: string | null; value: string; source: string };

type Current = Partial<Record<EnrichField, string | null>>;

/** True when enrichment can run: name + company, or an email. */
export function canEnrich(c: { full_name: string; company: string | null; email: string | null }): boolean {
  return (!!c.full_name.trim() && !!c.company?.trim()) || !!c.email?.trim();
}

/** Comparison key that ignores case, punctuation, protocol, www and trailing slashes. */
export function normalizeForCompare(field: EnrichField, v: string): string {
  let s = v.trim().toLowerCase();
  if (field === "website" || field === "linkedin_url") {
    s = s.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
  return s.replace(/[^a-z0-9/.]+/g, "");
}

/** Keeps only suggestions that fill an empty field or meaningfully differ from the current value. */
export function buildSuggestions(current: Current, result: EnrichmentResult): Suggestion[] {
  const out: Suggestion[] = [];
  for (const field of ENRICH_FIELDS) {
    const s = result[field];
    const value = s?.value.trim();
    if (!s || !value) continue;
    const cur = current[field]?.trim() || null;
    if (cur && normalizeForCompare(field, cur) === normalizeForCompare(field, value)) continue;
    out.push({ field, current: cur, value, source: s.source.trim() });
  }
  return out;
}
