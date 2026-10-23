import { createFileRoute } from "@tanstack/react-router";

// Pinball refund webhook: the "Refund → ContactKickstart app access"
// automation calls this when an app product is refunded. The purchase stops
// counting: Pro from a refunded Lifetime/Year falls back to whatever else
// the account has (another purchase, Stripe, a comp, or free), a refunded
// starter pack loses its unused credits, and a grant not yet claimed at
// signup never applies. Cards are never touched.
//
// Authenticity: automation webhooks can't be HMAC-signed, so the step sends
// `Authorization: Bearer <secret>` with the secret stored in app_secrets
// under 'pinball_refund'.

export const Route = createFileRoute("/api/pinball-refund")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { bearerMatches, parsePinballRefund } = await import("@/lib/pinball-order");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: setting } = await supabaseAdmin
          .from("app_secrets")
          .select("value")
          .eq("key", "pinball_refund")
          .maybeSingle();
        const secret = (setting?.value as { secret?: string } | null)?.secret ?? "";
        if (!secret) return Response.json({ error: "not configured" }, { status: 503 });
        if (!bearerMatches(request.headers.get("authorization"), secret)) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "invalid json" }, { status: 400 });
        }
        const parsed = parsePinballRefund(payload as Parameters<typeof parsePinballRefund>[0]);
        // 200 for payloads we ignore: a retry will not change them.
        if (!parsed.ok) return Response.json({ ok: false, reason: parsed.reason });
        const { kind, email } = parsed.refund;

        // Without an order id, take the buyer's latest unrefunded purchase of this kind.
        let orderId = parsed.refund.orderId;
        if (!orderId) {
          const { data: latest } = await supabaseAdmin
            .from("purchase_entitlements")
            .select("pinball_order_id")
            .eq("email", email)
            .eq("kind", kind)
            .is("refunded_at", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          orderId = latest?.pinball_order_id ?? null;
        }
        if (!orderId) return Response.json({ ok: false, reason: "no matching purchase" });

        const { data, error } = await supabaseAdmin.rpc("refund_app_purchase", {
          _order_id: orderId,
          _kind: kind,
        });
        if (error) {
          // Make Pinball retry: the refund went through and access is still on.
          console.error(`pinball refund ${orderId} (${kind}) failed: ${error.message}`);
          return Response.json({ error: "could not record refund" }, { status: 500 });
        }
        console.log(`pinball refund ${orderId} (${kind}) → ${JSON.stringify(data)}`);
        return Response.json({ ok: true, result: data });
      },
    },
  },
});
