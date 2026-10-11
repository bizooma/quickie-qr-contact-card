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
    <LegalPage title="Terms of Service" updated="October 10, 2026">
      <h2>The service</h2>
      <p>
        ContactKickstart lets you create digital business cards, share them, and manage the contacts
        you collect. The free plan is free; paid plans (Pro and Premium) are billed monthly or
        annually and can be cancelled anytime, taking effect at the end of the billing period.
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
