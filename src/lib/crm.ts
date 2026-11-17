// CRM integrations for attorney cards (Clio Grow first; Lawmatics and
// Smokeball later). Pure and client-safe: endpoints, lead mapping and the
// words shown to the owner. The credential lives only in crm_connections,
// which no client role can read (migration 0039); crm.server.ts sends.

export const CRM_PROVIDERS = ["clio_grow"] as const;
export type CrmProvider = (typeof CRM_PROVIDERS)[number];

export const CRM_NAMES: Record<CrmProvider, string> = { clio_grow: "Clio Grow" };

// ---- Clio Grow (Lead Inbox API) --------------------------------------------
// The firm copies its lead capture token from Clio Grow (Settings →
// Integrations → Lead capture) and we POST each lead to its region's inbox.
// https://docs.developers.clio.com/guides/clio-grow/lead-inbox-api/

export const CLIO_REGIONS = ["us", "ca", "eu", "au"] as const;
export type ClioRegion = (typeof CLIO_REGIONS)[number];

export const CLIO_REGION_NAMES: Record<ClioRegion, string> = {
  us: "United States",
  ca: "Canada",
  eu: "Europe",
  au: "Australia",
};

export function clioInboxUrl(region: ClioRegion): string {
  return region === "us"
    ? "https://grow.clio.com/inbox_leads"
    : `https://${region}.grow.clio.com/inbox_leads`;
}

/** A token as pasted: trimmed, and plausible (no spaces, sane length). */
export function cleanClioToken(raw: string): string | null {
  const t = raw.trim();
  return /^[A-Za-z0-9_\-.:]{8,200}$/.test(t) ? t : null;
}

/** The last 4 characters, the only part of the token the browser ever sees. */
export function tokenHint(token: string): string {
  return token.slice(-4);
}

export type CrmContact = {
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  note: string | null;
  source: string;
  met_at: string | null;
};

export type ClioInboxLead = {
  from_first: string;
  from_last: string;
  from_message: string;
  referring_url: string;
  from_source: string;
  from_email?: string;
  from_phone?: string;
};

/** "Jane van der Berg" → first "Jane", last "van der Berg". Clio requires a
 *  last name, so a single name repeats as both rather than inventing one. */
export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "Unknown", last: "Unknown" };
  if (parts.length === 1) return { first: parts[0]!, last: parts[0]! };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

/** One QuickieQR contact as a Clio Grow inbox lead. Clio requires a message,
 *  so one is always written: what the person left (including the attorney
 *  acknowledgment, when they gave it), or how they reached the firm. */
export function toClioLead(contact: CrmContact, cardUrl: string): ClioInboxLead {
  const { first, last } = splitName(contact.full_name);
  const how =
    contact.source === "shareback"
      ? `Shared their details from your QuickieQR card${contact.met_at ? ` (${contact.met_at})` : ""}.`
      : `Added in QuickieQR${contact.met_at ? ` (${contact.met_at})` : ""}.`;
  const lines = [contact.note?.trim(), contact.company ? `Company: ${contact.company}` : "", how];
  return {
    from_first: first.slice(0, 100),
    from_last: last.slice(0, 100),
    from_message: lines.filter(Boolean).join("\n\n").slice(0, 2000),
    referring_url: cardUrl,
    from_source: "QuickieQR",
    ...(contact.email?.trim() ? { from_email: contact.email.trim() } : {}),
    ...(contact.phone?.trim() ? { from_phone: contact.phone.trim() } : {}),
  };
}

/** Clio's answer, in words the owner can act on. */
export function clioErrorMessage(status: number): string {
  if (status === 401)
    return "Clio Grow didn't accept your lead capture token. Copy it again from Clio Grow (Settings → Integrations) and reconnect.";
  if (status === 422) return "Clio Grow said some lead details were missing.";
  if (status === 429)
    return "Clio Grow is limiting requests right now. Try again in a few minutes.";
  if (status >= 500) return "Clio Grow had a problem on their end. Try again shortly.";
  return `Clio Grow refused the lead (error ${status}).`;
}

/** Reading a token check: Clio checks the token before the lead fields, so
 *  an empty lead gets 401 for a bad token and 422 for a good one. Nothing is
 *  created either way. */
export function tokenCheckResult(status: number): "valid" | "invalid" | "unknown" {
  if (status === 401 || status === 403) return "invalid";
  if (status === 422 || status === 400 || (status >= 200 && status < 300)) return "valid";
  return "unknown";
}
