import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — QuickieQR" },
      {
        name: "description",
        content:
          "What data QuickieQR collects, how it's used, and your rights to access and delete it.",
      },
      { property: "og:title", content: "Privacy Policy — QuickieQR" },
      {
        property: "og:description",
        content: "What data QuickieQR collects, how it's used, and your rights.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="November 17, 2026">
      <h2>What we collect</h2>
      <p>
        Your account (email address and password hash), the content you put on your cards (name,
        titles, contact details, photos, links), the contacts you capture or scan, and usage events
        such as card views, saves and link clicks. Card view events record the visitor&apos;s device
        type and operating system, the website or kind of link (QR code, shared link, email
        signature) that brought them, a random per-browser identifier used to count unique visitors,
        and an approximate location at city level derived from their network address. We do not
        store visitors&apos; IP addresses or precise location.
      </p>
      <h2>How we use it</h2>
      <p>
        To run the product: showing your card to people you share it with, storing your contacts,
        sending the notifications you turn on, and showing you your own analytics. AI features (card
        scanning, enrichment, follow-up drafting) send the relevant text or image to our AI provider
        to produce the result you asked for. We don't sell your data.
      </p>
      <h2>What's public</h2>
      <p>
        Only your card pages, at the links you choose to share. Your contacts, notes, analytics and
        settings are private to your account (and to your team, only where you explicitly enable
        sharing).
      </p>
      <h2>Your control</h2>
      <p>
        Export your contacts as CSV or vCard anytime. Delete your account from Settings — this
        permanently removes your cards, contacts, notes and files.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about this policy:{" "}
        <a href="mailto:support@quickieqr.com">support@quickieqr.com</a>.
      </p>
    </LegalPage>
  );
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← QuickieQR
      </Link>
      <h1 className="mt-6 text-3xl font-extrabold">{title}</h1>
      <p className="mt-1 text-xs text-muted-foreground">Last updated {updated}</p>
      <div className="prose-sm mt-8 space-y-4 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_p]:text-sm [&_p]:text-muted-foreground [&_a]:underline">
        {children}
      </div>
    </div>
  );
}
