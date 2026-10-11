import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Center — ContactKickstart" },
      {
        name: "description",
        content:
          "How to build and share your digital business card, capture contacts, scan paper cards, set up your team, and manage your plan.",
      },
    ],
  }),
  component: Help,
});

const SECTIONS: { id: string; title: string; items: [string, string][] }[] = [
  {
    id: "getting-started",
    title: "Getting started",
    items: [
      [
        "Create your card",
        "Sign up free, then fill in your name, title, photo, links and brand colors. Your card is live immediately at its own link — there's nothing to publish or print.",
      ],
      [
        "Edit anytime",
        "Open Cards, tap your card, and change anything. Edits go live instantly everywhere your card is already out in the world; your link and QR code never change.",
      ],
      [
        "Install the app on your phone",
        "ContactKickstart works as an app without an app store: open Settings → Install the app and follow the two-tap instructions for iPhone or Android.",
      ],
    ],
  },
  {
    id: "sharing",
    title: "Sharing your card",
    items: [
      [
        "Share with a QR code",
        "Every card has a QR code (Cards → your card → QR). Let people scan it from your screen — their phone opens your card in the browser, no app needed on their side.",
      ],
      [
        "Share the link",
        "Your card lives at contactkickstart.com/c/your-name. Put it in your email signature, social bios, or send it in a text with the Share button.",
      ],
      [
        "They save you in one tap",
        "The Save contact button on your card downloads your details straight into their phone's contacts.",
      ],
    ],
  },
  {
    id: "capturing",
    title: "Capturing contacts",
    items: [
      [
        "Share-back: their details come to you",
        "Your card has a “Share yours” button. When someone fills it in, they land in your Contacts and you get a notification. This works on the free plan, unlimited.",
      ],
      [
        "Scan paper business cards",
        "Open Scan and photograph any paper card. The AI reads the name, title, company, phone, email, address — even the headshot — and files it as a contact.",
      ],
      [
        "Notes, tags and follow-ups",
        "On any contact: add notes (typed or voice), tag them, draft an AI follow-up email, or enrich thin contacts from their company's public info.",
      ],
      [
        "Export everything",
        "Contacts export as CSV or vCard from the Contacts page. Your data is yours.",
      ],
    ],
  },
  {
    id: "notifications",
    title: "Notifications & integrations",
    items: [
      [
        "Push notifications",
        "Turn on push in Settings → Notifications to get pinged the moment someone shares their details back.",
      ],
      [
        "Webhooks (Make, Zapier, your CRM)",
        "Paste a webhook URL in Settings and every new contact is POSTed to it as JSON — name, email, phone, company, address and source.",
      ],
    ],
  },
  {
    id: "teams",
    title: "Teams",
    items: [
      [
        "Create a team",
        "On the Pro plan, open Team and name your team. Invite members with a single-use link (14-day expiry) as members or admins.",
      ],
      [
        "Branded cards for everyone",
        "Admins provision cards for members, and Brand lock keeps your colors and logo on every team card — nobody drifts off-brand.",
      ],
      [
        "Shared contacts & analytics",
        "Flip on contact sharing to give the team one pipeline, and watch views, saves and share-backs across all team cards in one view.",
      ],
    ],
  },
  {
    id: "billing",
    title: "Plans & billing",
    items: [
      [
        "What's free, forever",
        "One card with QR and link, unlimited share-back capture, analytics, notifications, and 10 AI card scans a month. No credit card to start.",
      ],
      [
        "What Pro adds ($8/mo)",
        "Up to 50 cards, unlimited AI scanning, unlimited AI enrichment, follow-ups and summaries, and Teams. Upgrade from Settings; cancel anytime and it runs to the end of the period.",
      ],
    ],
  },
  {
    id: "account",
    title: "Account & data",
    items: [
      [
        "Reset your password",
        "On the sign-in page, enter your email and tap “Forgot password?” for a reset link.",
      ],
      [
        "Delete your account",
        "Settings → Danger zone deletes your account and everything in it — cards, contacts, notes and files — permanently.",
      ],
    ],
  },
];

function Help() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← ContactKickstart
      </Link>
      <h1 className="mt-6 text-3xl font-extrabold">Help Center</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Everything in ContactKickstart, explained. Can't find it? Email{" "}
        <a href="mailto:support@myaisummit.dev" className="underline">
          support@myaisummit.dev
        </a>
        .
      </p>
      <nav className="mt-6 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {s.title}
          </a>
        ))}
      </nav>
      {SECTIONS.map((s) => (
        <section key={s.id} id={s.id} className="mt-10 scroll-mt-6">
          <h2 className="text-lg font-bold">{s.title}</h2>
          <div className="mt-3 space-y-4">
            {s.items.map(([q, a]) => (
              <div key={q}>
                <h3 className="text-sm font-semibold">{q}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="mt-12 border-t pt-6 text-sm text-muted-foreground">
        Still stuck? Email{" "}
        <a href="mailto:support@myaisummit.dev" className="underline">
          support@myaisummit.dev
        </a>{" "}
        — a human reads it.
      </p>
    </div>
  );
}
