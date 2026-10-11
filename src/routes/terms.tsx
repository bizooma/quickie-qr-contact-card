import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "./privacy";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — ContactKickstart" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="October 11, 2026">
      <h2>The service</h2>
      <p>
        ContactKickstart lets you create digital business cards, share them, and manage the contacts
        you collect. The free plan is free; paid plans (Pro, Premium and Teams) are subscriptions
        billed monthly or annually — Teams per seat, with a 3-seat minimum.
      </p>
      <h2>Billing, renewal & cancellation</h2>
      <p>
        All paid subscriptions renew automatically — monthly plans each month, annual plans each
        year — until you cancel. You can cancel anytime from Settings → Manage billing.
      </p>
      <p>
        Cancelling stops the next renewal; it does not end your current term. You keep full access
        to everything you paid for until the end of the current billing period (the month, or the
        year, you've already paid), and you are not charged again after that. Payments already made
        are non-refundable: cancelling an annual plan mid-year does not refund the remainder of the
        year — you simply keep the service through the end of that year and it doesn't renew.
      </p>
      <p>
        Founding offers purchased outside the app (the Founding Lifetime and Founding Year passes)
        are one-time payments, never auto-renew, and carry the money-back guarantee stated where
        they are sold. A Founding Year pass simply ends 12 months after purchase unless you choose
        to continue on a subscription.
      </p>
      <h2>Your content</h2>
      <p>
        You own what you put on your cards and in your contacts, and you're responsible for having
        the right to share it. Don't use the service to impersonate others, send spam, or host
        unlawful content — we may suspend accounts that do.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Contacts captured through share-back gave their details to you; treat them accordingly and
        follow the laws that apply to your outreach.
      </p>
      <h2>Availability & changes</h2>
      <p>
        We work to keep the service fast and available but provide it “as is,” without warranty. We
        may update features and these terms; material changes will be noted on this page.
      </p>
      <h2>Contact</h2>
      <p>
        Questions: <a href="mailto:support@myaisummit.dev">support@myaisummit.dev</a>.
      </p>
    </LegalPage>
  );
}
