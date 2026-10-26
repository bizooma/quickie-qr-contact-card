import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server functions around capturing contacts: the public share-back submit
// (which also notifies the card owner) and post-capture fan-out for the
// owner's webhook. The admin client loads inside handlers only — this file
// ships to the client bundle.

const SharebackInputSchema = z.object({
  slug: z.string().min(3).max(49),
  name: z.string().min(1).max(120),
  email: z.string().max(255),
  phone: z.string().max(40),
  company: z.string().max(120),
  note: z.string().max(1000),
});

/** Public (unauthenticated): saves a share-back, then pings the card owner. */
/** The RPC's reasons, in words a visitor can act on. Anything unexpected
 *  stays generic so database details never reach the public page. */
export function sharebackErrorMessage(dbMessage: string): string {
  const m = dbMessage.toLowerCase();
  if (m.includes("shareback closed"))
    return "This card isn't collecting contact details right now — save their contact instead.";
  if (m.includes("too many submissions"))
    return "This card is getting a lot of submissions right now — please try again in a few minutes.";
  if (m.includes("card not found")) return "This card no longer exists.";
  if (m.includes("email or phone required"))
    return "Add an email or phone number so they can reach you.";
  if (m.includes("name required")) return "Add your name.";
  if (m.includes("input too long")) return "One of the fields is too long.";
  return "Couldn't send your details. Please try again.";
}

export const submitShareback = createServerFn({ method: "POST" })
  .validator(SharebackInputSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const { sharebackVisitorIp } = await import("./shareback-ip");
    const visitorIp = sharebackVisitorIp(getRequestHeaders());
    // The SECURITY DEFINER RPC revalidates lengths and requires email-or-phone.
    // Per-request only: never mutate the shared admin client's headers. An empty
    // value explicitly means no visitor IP, not the server's outgoing address.
    const { error } = await supabaseAdmin
      .rpc("submit_shareback", {
        _slug: data.slug,
        _name: data.name,
        _email: data.email,
        _phone: data.phone,
        _company: data.company,
        _note: data.note,
      })
      .setHeader("x-contactkickstart-visitor-ip", visitorIp ?? "");
    if (error) throw new Error(sharebackErrorMessage(error.message));

    // Notify the owner: web push now, webhook if configured. Both best-effort,
    // and both paid-only (instant lead alerts are a Pro feature).
    try {
      const { data: card } = await supabaseAdmin
        .from("cards")
        .select("user_id, label")
        .eq("slug", data.slug.toLowerCase())
        .maybeSingle();
      const { getPlan } = await import("./usage.server");
      if (card && (await getPlan(card.user_id)) !== "free") {
        const { sendPushToUser, postContactWebhook } = await import("./notify.server");
        await Promise.all([
          sendPushToUser(card.user_id),
          postContactWebhook(card.user_id, [
            {
              full_name: data.name.trim(),
              email: data.email.trim() || null,
              phone: data.phone.trim() || null,
              company: data.company.trim() || null,
              address: null,
              note: data.note.trim() || null,
              source: "shareback",
              card_label: card.label,
              created_at: new Date().toISOString(),
            },
          ]),
        ]);
      }
    } catch {
      // The contact is saved; notification failures stay invisible to the visitor.
    }
    return { ok: true };
  });

/** The browser needs the VAPID public key to subscribe to push. */
export const getVapidPublicKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getVapidKeys, jwkToApplicationServerKey } = await import("./notify.server");
    const keys = await getVapidKeys();
    return { key: jwkToApplicationServerKey(keys.publicJwk) };
  });

const NotifyContactsInputSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1).max(50),
});

/** Fans freshly saved contacts (e.g. from a scan) out to the owner's webhook. */
export const notifyNewContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(NotifyContactsInputSchema)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // RLS scopes this read to the caller's own contacts.
    const { data: rows } = await supabase
      .from("contacts")
      .select("full_name, email, phone, company, address, note, source, met_at, created_at")
      .in("id", data.contactIds);
    if (!rows?.length) return { ok: true };
    const { postContactWebhook } = await import("./notify.server");
    await postContactWebhook(
      userId,
      rows.map((r) => ({
        full_name: r.full_name,
        email: r.email,
        phone: r.phone,
        company: r.company,
        address: r.address,
        note: r.note,
        source: r.source,
        card_label: r.met_at,
        created_at: r.created_at,
      })),
    );
    return { ok: true };
  });

/** Public (unauthenticated): short-lived signed URLs for a published card's own
 *  images only. The bucket has no public read policy, so anon can't sign. */
export const signPublicCardMedia = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string().min(3).max(49) }))
  .handler(async ({ data }): Promise<Record<string, string>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: card } = await supabaseAdmin
      .from("cards")
      .select("user_id, headshot_path, logo_path, og_path, banner_path")
      .eq("slug", data.slug.toLowerCase())
      .maybeSingle();
    if (!card) return {};
    // The banner photo is Premium; after a downgrade it stays private.
    let banner: string | null = null;
    if (card.banner_path) {
      const { getPlan } = await import("./usage.server");
      if ((await getPlan(card.user_id)) === "premium") banner = card.banner_path;
    }
    const paths = [card.headshot_path, card.logo_path, card.og_path, banner].filter(
      (p): p is string => !!p && !p.split("/").includes("contact-photos"),
    );
    if (!paths.length) return {};
    const { data: signed } = await supabaseAdmin.storage
      .from("card-media")
      .createSignedUrls(paths, 60 * 60 * 24 * 7);
    const out: Record<string, string> = {};
    for (const s of signed ?? []) if (s.signedUrl && s.path) out[s.path] = s.signedUrl;
    return out;
  });
