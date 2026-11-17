// Server-only CRM delivery. Reads the credential from crm_connections (no
// client role can), sends one contact, and records the attempt in
// crm_deliveries so the owner can see it arrived or resend it.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  clioErrorMessage,
  clioInboxUrl,
  toClioLead,
  tokenCheckResult,
  type ClioRegion,
  type CrmProvider,
} from "./crm";
import { parsePractice } from "./practice";

const SITE = "https://quickieqr.com";
const TIMEOUT_MS = 8000;

export type CrmResult = { ok: true } | { ok: false; error: string };

/** Asks Clio whether a token is real without creating a lead (see
 *  tokenCheckResult). */
export async function checkClioToken(
  token: string,
  region: ClioRegion,
): Promise<"valid" | "invalid" | "unknown"> {
  try {
    const res = await fetch(clioInboxUrl(region), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ inbox_lead_token: token, inbox_lead: {} }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return tokenCheckResult(res.status);
  } catch {
    return "unknown";
  }
}

/** Sends one of the user's contacts to their connected CRM and logs it.
 *  Never throws: the result says what happened. */
export async function sendContactToCrm(
  userId: string,
  contactId: string,
  provider: CrmProvider = "clio_grow",
): Promise<CrmResult> {
  const { data: conn } = await supabaseAdmin
    .from("crm_connections")
    .select("secret, region")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (!conn) return { ok: false, error: "Clio Grow isn't connected." };

  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("full_name, email, phone, company, note, source, met_at, card_id")
    .eq("id", contactId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!contact) return { ok: false, error: "Contact not found." };

  let cardUrl = SITE;
  if (contact.card_id) {
    const { data: card } = await supabaseAdmin
      .from("cards")
      .select("slug")
      .eq("id", contact.card_id)
      .maybeSingle();
    if (card) cardUrl = `${SITE}/c/${card.slug}`;
  }

  let result: CrmResult;
  try {
    const res = await fetch(clioInboxUrl((conn.region ?? "us") as ClioRegion), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        inbox_lead_token: conn.secret,
        inbox_lead: toClioLead(contact, cardUrl),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    result = res.ok ? { ok: true } : { ok: false, error: clioErrorMessage(res.status) };
  } catch {
    result = { ok: false, error: "Couldn't reach Clio Grow. Try again shortly." };
  }

  await supabaseAdmin.from("crm_deliveries").insert({
    user_id: userId,
    contact_id: contactId,
    provider,
    ok: result.ok,
    error: result.ok ? null : result.error.slice(0, 300),
  });
  await supabaseAdmin
    .from("crm_connections")
    .update({
      last_error: result.ok ? null : result.error.slice(0, 300),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", provider);
  return result;
}

/** Share-backs from an attorney card go to the owner's CRM on their own,
 *  on paid plans. Leads from general or nonprofit cards never do. */
export async function autoSendShareback(
  userId: string,
  contactId: string,
  cardPractice: unknown,
  plan: string,
): Promise<void> {
  if (plan === "free" || parsePractice(cardPractice)?.kind !== "attorney") return;
  const { count } = await supabaseAdmin
    .from("crm_connections")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (!count) return;
  await sendContactToCrm(userId, contactId);
}
