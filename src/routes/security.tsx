import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "./privacy";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security — ContactKickstart" },
      {
        name: "description",
        content: "How ContactKickstart protects your data: encryption, isolation, GDPR rights.",
      },
      { property: "og:title", content: "Security — ContactKickstart" },
      { property: "og:description", content: "How ContactKickstart protects your data: encryption, isolation, GDPR rights." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Security,
});

function Security() {
  return (
    <LegalPage title="Security at ContactKickstart" updated="October 12, 2026">
      <h2>How your data is protected</h2>
      <p>
        Every connection to ContactKickstart is encrypted in transit with TLS, and strict transport
        security keeps browsers from ever downgrading. Your data is stored in a managed PostgreSQL
        database that encrypts data at rest.
      </p>
      <p>
        Accounts are isolated at the database layer with row-level security: every query runs under
        your identity, and the database itself refuses to return another account&apos;s rows. Public
        card pages go through a small set of fixed, audited functions rather than open database
        access, and those functions validate and rate-limit everything they accept.
      </p>
      <p>
        Photos and card images live in a private storage bucket. Contact photos are readable only by
        the account that captured them; card images are served through short-lived signed URLs.
      </p>
      <h2>Payments</h2>
      <p>
        Payments are processed by Stripe, a PCI DSS Level&nbsp;1 certified provider. Your card
        number never touches our servers — we store only the subscription reference Stripe gives us,
        and every billing notification from Stripe is cryptographically verified before we act on
        it.
      </p>
      <h2>GDPR and your rights</h2>
      <p>
        We collect only what the product needs (see the{" "}
        <a href="/privacy" className="underline">
          privacy policy
        </a>{" "}
        for the full list), and we don&apos;t sell your data. You can export your contacts at any
        time (CSV or vCard from the app), and you can delete your account yourself from Settings —
        deletion removes your cards, contacts, photos and account data. For any other access,
        correction or erasure request, email{" "}
        <a href="mailto:support@myaisummit.dev" className="underline">
          support@myaisummit.dev
        </a>{" "}
        and we&apos;ll handle it promptly.
      </p>
      <p>
        We use a short list of subprocessors to run the service: Supabase (database, authentication,
        file storage), Cloudflare (hosting and delivery), Stripe (payments), and Anthropic (AI
        processing — the card image or text you ask us to process, used only to produce your
        result).
      </p>
      <h2>SOC 2</h2>
      <p>
        Our security controls are modeled on the SOC&nbsp;2 Trust Services Criteria — access
        control, encryption, change management with automated checks on every change, and least
        privilege throughout. ContactKickstart has not yet completed an independent SOC&nbsp;2
        Type&nbsp;II audit; formal certification is on our roadmap as the company grows. If your
        organization needs our current security documentation for a vendor review, email{" "}
        <a href="mailto:support@myaisummit.dev" className="underline">
          support@myaisummit.dev
        </a>
        .
      </p>
      <h2>Reporting a vulnerability</h2>
      <p>
        If you believe you&apos;ve found a security issue, email{" "}
        <a href="mailto:support@myaisummit.dev" className="underline">
          support@myaisummit.dev
        </a>{" "}
        with the details. We read every report and act on them quickly.
      </p>
    </LegalPage>
  );
}
