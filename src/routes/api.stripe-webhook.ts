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
          // Match on the subscription id, not the customer: a late or retried
          // event for an old subscription must not clobber a newer one the
          // customer has since bought.
          const sub = event.data.object;
          const active =
            event.type !== "customer.subscription.deleted" &&
            (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due");
          if (active) {
            // The live price decides the tier — a portal price switch changes
            // the price but keeps the checkout-time metadata forever.
            const env = stripeEnv();
            const item = sub.items?.data?.[0];
            const priceId = item?.price?.id;
            const pricePlan =
              priceId === env.teamPriceId || priceId === env.teamAnnualPriceId
                ? "team"
                : priceId === env.premiumPriceId || priceId === env.premiumAnnualPriceId
                  ? "premium"
                  : priceId === env.priceId || priceId === env.annualPriceId
                    ? "pro"
                    : null;
            const ckPlan = pricePlan ?? sub.metadata?.["ck_plan"] ?? "pro";
            await supabaseAdmin
              .from("profiles")
              .update({
                plan: ckPlan === "premium" || ckPlan === "team" ? "premium" : "pro",
                plan_expires_at: null,
                // Seat changes (portal quantity updates) land here.
                team_seats:
                  ckPlan === "team" && item?.quantity && item.quantity > 0 ? item.quantity : 0,
              })
              .eq("stripe_subscription_id", sub.id);
          } else {
            // Fall back to whatever lifetime/year purchase entitlements the
            // user still holds instead of a hard downgrade to free. Skip
            // silently when the sub id no longer matches (stale event).
            const { data: profile } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .eq("stripe_subscription_id", sub.id)
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

        return Response.json({ received: true });
      },
    },
  },
});
