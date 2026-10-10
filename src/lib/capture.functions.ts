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
export const submitShareback = createServerFn({ method: "POST" })
  .validator(SharebackInputSchema)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // The SECURITY DEFINER RPC revalidates lengths and requires email-or-phone.
    const { error } = await supabaseAdmin.rpc("submit_shareback", {
      _slug: data.slug,
      _name: data.name,
      _email: data.email,
      _phone: data.phone,
      _company: data.company,
      _note: data.note,
    });
    if (error) throw new Error("Couldn't send your details. Please try again.");

    // Notify the owner: web push now, webhook if configured. Both best-effort.
    try {
      const { data: card } = await supabaseAdmin
        .from("cards")
        .select("user_id, label")
        .eq("slug", data.slug.toLowerCase())
        .maybeSingle();
      if (card) {
        const { sendPushToUser, postContactWebhook } = await import("./notify.server");
        await Promise.all([
          sendPushToUser(card.user_id),
          postContactWebhook(card.user_id, [
            {
              full_name: data.name.trim(),
              email: data.email.trim() || null,
              phone: data.phone.trim() || null,
              company: data.company.trim() || null,
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
      .select("full_name, email, phone, company, note, source, met_at, created_at")
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
        note: r.note,
        source: r.source,
        card_label: r.met_at,
        created_at: r.created_at,
      })),
    );
    return { ok: true };
  });
