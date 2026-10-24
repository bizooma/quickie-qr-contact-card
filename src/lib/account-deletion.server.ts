// Server-only: removes a person completely. Shared by self-deletion
// (account.functions.ts) and the admin console (admin.functions.ts) so the
// two paths can't drift apart again. Top-level import is safe only from
// other server-only modules.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "card-media";
const PAGE = 1000;

/** Every object under `<prefix>/`, including subfolders (contact-photos, og, …). */
async function listAllPaths(prefix: string): Promise<string[]> {
  const paths: string[] = [];
  const folders = [prefix];
  while (folders.length) {
    const folder = folders.pop()!;
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .list(folder, { limit: PAGE, offset });
      if (error) throw new Error(`Could not list uploads: ${error.message}`);
      for (const f of data ?? []) {
        // Folders come back with a null id.
        if (f.id === null) folders.push(`${folder}/${f.name}`);
        else paths.push(`${folder}/${f.name}`);
      }
      if (!data || data.length < PAGE) break;
    }
  }
  return paths;
}

async function removeAllUploads(userId: string): Promise<number> {
  const paths = await listAllPaths(userId);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw new Error(`Could not delete uploads: ${error.message}`);
  }
  return paths.length;
}

/** Stops the Stripe subscription so a deleted account is never charged again.
 *  Returns false when there was nothing to cancel or billing isn't configured. */
async function cancelStripeSubscription(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", userId)
    .maybeSingle();
  const subId = profile?.stripe_subscription_id;
  if (!subId) return false;
  const { getStripe, isStripeConfigured } = await import("./stripe.server");
  if (!isStripeConfigured()) return false;
  try {
    await getStripe().subscriptions.cancel(subId);
  } catch (e) {
    // Already cancelled in Stripe is fine; anything else must stop the deletion,
    // or the person keeps paying for an account that no longer exists.
    const code = (e as { code?: string }).code;
    if (code !== "resource_missing") {
      throw new Error("Could not cancel the subscription. Cancel it in Manage billing first.");
    }
  }
  return true;
}

/** Cancels billing, deletes uploads, then the login. Rows cascade from
 *  auth.users (migration 0025); the explicit deletes are belt and braces for
 *  anything that doesn't. */
export async function deleteUserCompletely(userId: string): Promise<{ files: number }> {
  await cancelStripeSubscription(userId);
  const files = await removeAllUploads(userId);
  for (const table of [
    "contact_tags",
    "contact_notes",
    "contacts",
    "card_views",
    "card_links",
    "cards",
  ] as const) {
    const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`Could not delete ${table}: ${error.message}`);
  }
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`Could not delete login: ${error.message}`);
  await supabaseAdmin.from("profiles").delete().eq("id", userId);
  return { files };
}
