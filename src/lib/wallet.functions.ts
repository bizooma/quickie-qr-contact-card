import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { requireActiveAuth } from "@/lib/auth-guard";
import { PASS_IMAGE_SIZES, type PassImageName } from "./wallet/apple-pass";

// Apple Wallet passes for the signed-in person's own cards (Pro & Premium).
// The browser draws the logo and photo as PNGs (it can decode any upload; a
// Worker can't), the server builds and signs the pass, stores it in the
// person's own storage folder, and returns a short-lived link. The phone then
// opens that link: Safari shows "Add to Apple Wallet" for a .pkpass download,
// which it won't do for a file made in the page.

const BUCKET = "card-media";
const LINK_SECONDS = 300;
const MAX_IMAGE_BYTES = 400_000;

const IMAGE_NAMES = Object.keys(PASS_IMAGE_SIZES) as [PassImageName, ...PassImageName[]];

export type WalletState = { apple: boolean; paid: boolean };

export const getWalletState = createServerFn({ method: "POST" })
  .middleware([requireActiveAuth])
  .handler(async ({ context }): Promise<WalletState> => {
    const [{ appleWalletConfigured }, { getPlan }] = await Promise.all([
      import("./wallet/apple-pass.server"),
      import("./usage.server"),
    ]);
    return { apple: appleWalletConfigured(), paid: (await getPlan(context.userId)) !== "free" };
  });

/** True for real PNG bytes (the 8-byte PNG signature). */
function isPng(b: Uint8Array): boolean {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return b.length > 8 && sig.every((v, i) => b[i] === v);
}

export const createAppleWalletPass = createServerFn({ method: "POST" })
  .middleware([requireActiveAuth])
  .validator(
    z.object({
      cardId: z.string().uuid(),
      // base64 PNGs drawn in the browser; all optional.
      images: z.partialRecord(z.enum(IMAGE_NAMES), z.string().max(600_000)).default({}),
    }),
  )
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const { getPlan } = await import("./usage.server");
    if ((await getPlan(context.userId)) === "free")
      throw new Error("Apple Wallet passes come with Pro.");
    const { appleWalletConfigured, buildPkpass, loadAppleSigner } =
      await import("./wallet/apple-pass.server");
    if (!appleWalletConfigured()) throw new Error("Apple Wallet isn't available yet.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("cards")
      .select(
        "id, slug, label, full_name, job_title, company, phones, emails, website, location, accent_color, headshot_path, practice",
      )
      .eq("id", data.cardId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row) throw new Error("Card not found.");

    const { parsePractice } = await import("./practice");
    const { buildPassJson, passShowsPhoto, PKPASS_TYPE } = await import("./wallet/apple-pass");
    const card = {
      ...row,
      phones: Array.isArray(row.phones) ? (row.phones as { label: string; value: string }[]) : [],
      emails: Array.isArray(row.emails) ? (row.emails as { label: string; value: string }[]) : [],
      practice: parsePractice(row.practice),
    };

    const images: Record<string, Uint8Array> = {};
    const showPhoto = passShowsPhoto(card);
    for (const [name, b64] of Object.entries(data.images)) {
      if (!b64) continue;
      // Low profile: no photo on the pass, whatever the browser sent.
      if (name.startsWith("thumbnail") && !showPhoto) continue;
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      } catch {
        continue;
      }
      if (bytes.length <= MAX_IMAGE_BYTES && isPng(bytes)) images[name] = bytes;
    }

    let pkpass: Uint8Array;
    try {
      const signer = loadAppleSigner();
      const json = buildPassJson(card, signer, { hasLogo: "logo.png" in images });
      pkpass = await buildPkpass(json, images, signer);
    } catch (err) {
      console.error("[wallet] Apple pass failed:", err instanceof Error ? err.message : err);
      throw new Error("Couldn't make your Wallet pass right now. Try again in a minute.");
    }

    const path = `${context.userId}/wallet/${row.id}.pkpass`;
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, pkpass, { contentType: PKPASS_TYPE, upsert: true });
    if (upErr) throw new Error("Couldn't save your Wallet pass. Try again.");
    const { data: signed } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, LINK_SECONDS);
    if (!signed?.signedUrl) throw new Error("Couldn't open your Wallet pass. Try again.");
    return { url: signed.signedUrl };
  });
