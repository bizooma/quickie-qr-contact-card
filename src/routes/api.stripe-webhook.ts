import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

// Stripe webhook: the single source of truth for who is on Pro. Signature
// verification uses WebCrypto (constructEventAsync) so it runs on Workers.
// Configure the endpoint in Stripe as POST <site>/api/stripe-webhook with
// events: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted.
//
// Every database write is checked: a failure answers 500 so Stripe retries,
// and each event id is recorded first so a retry of something that did land
// is a no-op.

/** Thrown for a database failure; the handler turns it into a 500. */
class WriteFailed extends Error {}

function must(result: { error: { message: string } | null }, what: string): void {
  if (result.error) throw new WriteFailed(`${what}: ${result.error.message}`);
}

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

        // Claim the event id before doing anything. A duplicate (Stripe retry
        // after a slow response) is acknowledged without being applied twice.
        const claim = await supabaseAdmin
          .from("stripe_events")
          .insert({ id: event.id, type: event.type });
        if (claim.error) {
          if (claim.error.code === "23505")
            return Response.json({ received: true, duplicate: true });
          console.error(`stripe event ${event.id}: could not record: ${claim.error.message}`);
          return Response.json({ error: "could not record event" }, { status: 500 });
        }

        try {
          await applyEvent(event, supabaseAdmin, stripeEnv());
        } catch (e) {
          // Release the claim so Stripe's retry gets a real second attempt.
          await supabaseAdmin.from("stripe_events").delete().eq("id", event.id);
          console.error(`stripe event ${event.id} (${event.type}) failed: ${(e as Error).message}`);
          return Response.json({ error: "could not apply event" }, { status: 500 });
        }
        return Response.json({ received: true });
      },
    },
  },
});

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
type Env = ReturnType<(typeof import("@/lib/stripe.server"))["stripeEnv"]>;

// Which paid tier a session/subscription buys; set by createCheckout.
// A Teams purchase grants the OWNER premium features plus N seats.
const tierOf = (meta: Stripe.Metadata | null | undefined) =>
  meta?.["ck_plan"] === "premium" || meta?.["ck_plan"] === "team" ? "premium" : "pro";
const seatsOf = (meta: Stripe.Metadata | null | undefined, quantity?: number | null) => {
  if (meta?.["ck_plan"] !== "team") return 0;
  const q = quantity ?? Number(meta?.["ck_seats"] ?? 0);
  return Number.isFinite(q) && q > 0 ? q : 0;
};

async function applyEvent(event: Stripe.Event, supabaseAdmin: Admin, env: Env): Promise<void> {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id;
    // Only a paid session grants anything; an unpaid one is followed by a
    // subscription event once (if) payment lands.
    const paid =
      session.payment_status === "paid" || session.payment_status === "no_payment_required";
    if (userId && session.mode === "payment" && paid && session.metadata?.["ck_topup"]) {
      // One-off scan pack: credits never expire, used after the allowance.
      must(await supabaseAdmin.rpc("add_topup_credits", { _user: userId }), "top-up credits");
      return;
    }
    if (userId && session.mode === "subscription" && paid) {
      // A subscriber moving to Teams: end the old subscription now that the
      // new one is paid. Its later "deleted" event matches no row (the id
      // below replaces it) and is skipped.
      const old = session.metadata?.["ck_replace_sub"];
      if (old && old !== session.subscription) {
        const { getStripe } = await import("@/lib/stripe.server");
        try {
          await getStripe().subscriptions.cancel(old);
        } catch (e) {
          console.error(`could not cancel replaced subscription ${old}: ${(e as Error).message}`);
        }
      }
      must(
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
          .eq("id", userId),
        "checkout update",
      );
    }
    return;
  }

  if (
    event.type !== "customer.subscription.updated" &&
    event.type !== "customer.subscription.deleted"
  ) {
    return;
  }

  // Match on the subscription id, not the customer: a late or retried event
  // for an old subscription must not clobber a newer one the customer has
  // since bought.
  const sub = event.data.object;
  const gone =
    event.type === "customer.subscription.deleted" ||
    sub.status === "canceled" ||
    sub.status === "incomplete_expired";
  const active =
    !gone && (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due");

  if (active) {
    // The live price decides the tier — a portal price switch changes the
    // price but keeps the checkout-time metadata forever.
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
    must(
      await supabaseAdmin
        .from("profiles")
        .update({
          plan: ckPlan === "premium" || ckPlan === "team" ? "premium" : "pro",
          plan_expires_at: null,
          // Seat changes (portal quantity updates) land here.
          team_seats: ckPlan === "team" && item?.quantity && item.quantity > 0 ? item.quantity : 0,
        })
        .eq("stripe_subscription_id", sub.id),
      "subscription update",
    );
    return;
  }

  // Not paying right now. Fall back to whatever lifetime/year purchase
  // entitlements the user still holds instead of a hard downgrade to free.
  // Skip silently when the sub id no longer matches (stale event).
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  if (error) throw new WriteFailed(`profile lookup: ${error.message}`);
  if (!profile?.id) return;
  // Keep the link for a subscription that may recover (unpaid, paused,
  // incomplete): when it becomes active again the update must find this row.
  // Only a subscription that is truly over is unlinked.
  must(
    await supabaseAdmin
      .from("profiles")
      .update(gone ? { stripe_subscription_id: null, team_seats: 0 } : { team_seats: 0 })
      .eq("id", profile.id),
    "subscription lapse",
  );
  must(await supabaseAdmin.rpc("restore_entitlement_plan", { _user: profile.id }), "restore plan");
}
