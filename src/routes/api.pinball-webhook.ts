import { createFileRoute } from "@tanstack/react-router";

// Pinball funnel webhook: a completed order for an allowlisted app product
// becomes a purchase entitlement (lifetime or year of Pro), granted
// immediately when an account with the buyer's email exists and otherwise
// the moment that email signs up (profiles insert trigger).
//
// Authenticity: hex HMAC-SHA256 of the raw body in x-pinball-signature,
// keyed with the secret stored in app_secrets under 'pinball_webhook' —
// the same value configured on the Pinball send_webhook actions.

export const Route = createFileRoute("/api/pinball-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { parsePinballOrder, verifyPinballSignature } = await import("@/lib/pinball-order");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: setting } = await supabaseAdmin
          .from("app_secrets")
          .select("value")
          .eq("key", "pinball_webhook")
          .maybeSingle();
        const secret = (setting?.value as { secret?: string } | null)?.secret ?? "";
        if (!secret) return Response.json({ error: "not configured" }, { status: 503 });

        const raw = await request.text();
        const signature = request.headers.get("x-pinball-signature");
        if (!(await verifyPinballSignature(raw, signature, secret))) {
          return Response.json({ error: "invalid signature" }, { status: 401 });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(raw);
        } catch {
          return Response.json({ error: "invalid json" }, { status: 400 });
        }

        const parsed = parsePinballOrder(payload as Parameters<typeof parsePinballOrder>[0]);
        // 200 for unreadable payloads: a retry will not make them readable.
        if (!parsed.ok) return Response.json({ ok: false, reason: parsed.reason });
        const order = parsed.order;
        if (!order.completed) return Response.json({ ok: true, skipped: "order not completed" });
        if (order.entitlements.length === 0) {
          return Response.json({ ok: true, skipped: "no app products in order" });
        }

        const results: unknown[] = [];
        for (const kind of order.entitlements) {
          const { data, error } = await supabaseAdmin.rpc("record_app_purchase", {
            _order_id: order.orderId,
            _order_number: order.orderNumber,
            _event: order.event,
            _email: order.email,
            _kind: kind,
            _amount_cents: order.amountCents,
            _is_test: order.isTest,
            _payload: payload as never,
          });
          if (error) {
            // The customer has paid and the grant did not land — make Pinball retry.
            console.error(`pinball order ${order.orderId} (${kind}) failed: ${error.message}`);
            return Response.json({ error: "could not record order" }, { status: 500 });
          }
          results.push(data);
        }
        console.log(`pinball order ${order.orderId} → ${JSON.stringify(results)}`);
        return Response.json({ ok: true, results });
      },
    },
  },
});
