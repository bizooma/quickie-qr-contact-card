import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { OS, VIA } from "./card-source";

// Card analytics events (view, save, link tap) from the public card page.
// They come through here rather than straight to the database because only
// the server knows the visitor's approximate location (Cloudflare, attached
// in src/server.ts). The database function skips the owner's own browsers and
// applies the same per-visitor and per-card limits as before.

export const logCardEvent = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string().min(3).max(49),
      event: z.enum(["view", "save", "click"]),
      meta: z.string().max(80).optional(),
      referrer: z.string().max(120).optional(),
      device: z.string().max(20).optional(),
      visitor: z.string().max(64).optional(),
      via: z.enum(VIA).optional(),
      os: z.enum(OS).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const { sharebackVisitorIp } = await import("./shareback-ip");
    const { readGeoHeaders } = await import("./visitor-geo");
    const headers = getRequestHeaders();
    const geo = readGeoHeaders(headers);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Per-request header, as for share-backs: the visitor's IP drives the
    // per-IP limit (it is hashed in the database and never stored).
    await supabaseAdmin
      .rpc("log_card_view", {
        _slug: data.slug,
        _event: data.event,
        ...(data.meta ? { _meta: data.meta } : {}),
        ...(data.referrer ? { _referrer: data.referrer } : {}),
        ...(data.device ? { _device: data.device } : {}),
        ...(data.visitor ? { _visitor: data.visitor } : {}),
        ...(data.via ? { _via: data.via } : {}),
        ...(data.os ? { _os: data.os } : {}),
        ...(geo.city ? { _city: geo.city } : {}),
        ...(geo.region ? { _region: geo.region } : {}),
        ...(geo.country ? { _country: geo.country } : {}),
      })
      .setHeader("x-contactkickstart-visitor-ip", sharebackVisitorIp(headers) ?? "");
    return { ok: true };
  });
