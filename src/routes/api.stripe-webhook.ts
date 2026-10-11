import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

// Stripe webhook: the single source of truth for who is on Pro. Signature
// verification uses WebCrypto (constructEventAsync) so it runs on Workers.
// Configure the endpoint in Stripe as POST <site>/api/stripe-webhook with
// events: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted.

export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getStripe, stripeEnv, webhookCryptoProvider } = await import("@/lib/stripe.server");
        const { webhookSecret, secretKey } = stripeEnv();
        if (!secretKey || !webhookSecret) {
          return Response.json({ error: "billing not configured" }, { status: 503 });
        }
        const signature = request.headers.get("stripe-signature");
        if (!signature) return Response.json({ error: "missing signature" }, { status: 400 });

        let event: Stripe.Event;
        try {
          const body = await request.text();
          event = await getStripe().webhooks.constructEventAsync(
            body,
            signature,
            webhookSecret,
            undefined,
            webhookCryptoProvider(),
          );
        } catch {
          return Response.json({ error: "invalid signature" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Which paid tier a session/subscription buys; set by createCheckout.
        // A Teams purchase grants the OWNER premium features plus N seats.
        const tierOf = (meta: Stripe.Metadata | null | undefined) =>
          meta?.["ck_plan"] === "premium" || meta?.["ck_plan"] === "team" ? "premium" : "pro";
        const seatsOf = (meta: Stripe.Metadata | null | undefined, quantity?: number | null) => {
          if (meta?.["ck_plan"] !== "team") return 0;
          const q = quantity ?? Number(meta?.["ck_seats"] ?? 0);
          return Number.isFinite(q) && q > 0 ? q : 0;
        };

        if (event.type === "checkout.session.completed") {
          const session = event.data.object;
          const userId = session.client_reference_id;
          if (userId && session.mode === "subscription") {
            await supabaseAdmin
              .from("profiles")
              .update({
                plan: tierOf(session.metadata),
                plan_expires_at: null, // the subscription is the source of truth now
                team_seats: seatsOf(session.metadata),
                stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
                stripe_subscription_id:
                  typeof session.subscription === "string" ? session.subscription : null,
              })
              .eq("id", userId);
          }
        } else if (
          event.type === "customer.subscription.updated" ||
          event.type === "customer.subscription.deleted"
        ) {
          const sub = event.data.object;
          const customer = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
          if (customer) {
            const active =
              event.type !== "customer.subscription.deleted" &&
              (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due");
            if (active) {
              await supabaseAdmin
                .from("profiles")
                .update({
                  plan: tierOf(sub.metadata),
                  plan_expires_at: null,
                  // Seat changes (portal quantity updates) land here.
                  team_seats: seatsOf(sub.metadata, sub.items?.data?.[0]?.quantity ?? null),
                  stripe_subscription_id: sub.id,
                })
                .eq("stripe_customer_id", customer);
            } else {
              // Fall back to whatever lifetime/year purchase entitlements the
              // user still holds instead of a hard downgrade to free.
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("id")
                .eq("stripe_customer_id", customer)
                .maybeSingle();
              if (profile?.id) {
                await supabaseAdmin
                  .from("profiles")
                  .update({ stripe_subscription_id: null, team_seats: 0 })
                  .eq("id", profile.id);
                await supabaseAdmin.rpc("restore_entitlement_plan", { _user: profile.id });
              }
            }
          }
        }

        return Response.json({ received: true });
      },
    },
  },
});
