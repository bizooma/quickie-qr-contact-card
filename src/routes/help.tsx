import { createFileRoute, Link } from "@tanstack/react-router";
import { PRO_AI_BENEFIT, PLAN_LIMITS, PREMIUM_AI_BENEFIT } from "@/lib/plans";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Center — ContactKickstart" },
      {
        name: "description",
        content:
          "How to build and share your digital business card, capture contacts, scan paper cards, set up your team, and manage your plan.",
      },
      { property: "og:title", content: "Help Center — ContactKickstart" },
      { property: "og:description", content: "Guides for building, sharing and getting the most from your ContactKickstart card." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
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
    id: "quick-qr",
    title: "Quick access to your QR code",
    items: [
      [
        "Can I add a QR widget to my phone?",
        "Home-screen widgets need an app from the App Store or Play Store, so ContactKickstart can't add one. You can get just as close: one tap from your home screen, or your code right on your lock screen. The steps are below, and in the app under My QR → “How to get to your QR code in one tap”.",
      ],
      [
        "iPhone: one tap from your home screen",
        "Open contactkickstart.com in Safari, tap Share, then Add to Home Screen. Then open the app, go to My QR and turn on “Open the app on my QR code” — tapping the icon now shows your code straight away.",
      ],
      [
        "Android: one tap from your home screen",
        "In Chrome, tap ⋮ then Install app (or Add to Home screen). For a separate one-tap QR icon, go to My QR, tap “Add a My QR icon”, then “Install My QR” — or turn on “Open the app on my QR code” in My QR.",
      ],
      [
        "Put your QR code on your lock screen or home screen",
        "In My QR, tap “Lock-screen wallpaper” or “Home-screen wallpaper” and save the image. iPhone: open it in Photos, tap Share → Use as Wallpaper. Android: open it in Photos or Gallery → Set as wallpaper. The home-screen version sits higher up, so keep that spot free of app icons.",
      ],
      [
        "Works with no signal",
        "The My QR screen is generated on your phone, so it still works at events with bad Wi-Fi or no reception.",
      ],
    ],
  },
  {
    id: "capturing",
    title: "Capturing contacts",
    items: [
      [
        "Share-back: their details come to you",
        "Your card has a “Share yours” button. When someone fills it in, they land in your Contacts and you get a notification. Free accounts collect up to 5 this way; Pro and Premium are unlimited.",
      ],
      [
        "Scan paper business cards",
        "Open Scan and photograph any paper card. The scanner reads the name, title, company, phone, email, address — even the headshot — and files it as a contact.",
      ],
      [
        "Notes, tags and follow-ups",
        "On any contact: add notes (typed or voice), tag them, draft a follow-up email, or enrich thin contacts from their company's public info.",
      ],
      [
        "Event mode (Pro and Premium)",
        "Going to a conference, expo or open house? On Contacts, tap “Start event mode” and name the event. Everyone who scans your card, shares their details or gets scanned by you is tagged with it until you end the event (or its last day passes). Afterwards, filter Contacts by the event to see everyone you met there.",
      ],
      [
        "Follow-up reminders (Premium)",
        "On any contact, tap Tomorrow, In 3 days, Next week or pick a time, and we'll send a notification to your phone when it's time to reach out (turn on notifications in Settings). Due follow-ups also show at the top of Contacts. From an event's list, one tap sets a reminder for everyone you met there.",
      ],
      [
        "Export everything",
        "Contacts export as CSV (for spreadsheets and any CRM) or vCard (for your phone) from the Contacts page, on every plan. Your data is yours.",
      ],
    ],
  },
  {
    id: "notifications",
    title: "Notifications & integrations",
    items: [
      [
        "Push notifications",
        "On Pro and Premium, turn on push in Settings → Notifications to get pinged the moment someone shares their details back.",
      ],
      [
        "Webhooks (Make, Zapier, your CRM)",
        "On Pro and Premium, paste a webhook URL in Settings and every new contact is POSTed to it as JSON — name, email, phone, company, address and source.",
      ],
    ],
  },
  {
    id: "teams",
    title: "Teams",
    items: [
      [
        "Create a team",
        "On the Teams plan ($10 per user/month, 3-seat minimum), open Team and name your team. Invite members with a single-use link (14-day expiry) as members or admins — every member gets full Premium features, and the owner uses one seat.",
      ],
      [
        "Branded cards for everyone",
        "Admins provision cards for members, and Brand lock keeps your colors and logo on every team card — nobody drifts off-brand.",
      ],
      [
        "Remove ContactKickstart branding",
        "Only on Teams. On the Team page, under Brand & sharing, an owner or admin can turn on Remove ContactKickstart branding. Every member's card then shows your brand only: no ContactKickstart badge on cards without a logo, no \"Create your own card\" link under the card, and no ContactKickstart name on the share-back form or link preview. Link previews update the next time each card is saved. If the Teams plan ends, the branding comes back by itself.",
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
        "Free is for trying ContactKickstart: one card with QR and link, 5 share-backs, QR-code scanning, analytics and CSV export. Card scanning, follow-up drafts, unlimited share-backs and lead alerts come with Pro. No credit card to start. Every account keeps its digital cards live for life — including after a paid plan ends. On free you can edit one of them; the rest stay live but locked until you upgrade.",
      ],
      [
        "What Pro adds ($8/mo, or $80/yr)",
        `Up to 3 cards, event mode, ${PLAN_LIMITS.pro.enrich} contact enrichments a month, note summaries, and ${PRO_AI_BENEFIT.replace(/\.$/, "")} (on the 1st, UTC; unused scans and drafts don't roll over). Settings shows what's left. Upgrade from Settings; cancel anytime and it runs to the end of the period.`,
      ],
      [
        "What Premium adds ($12/mo, or $120/yr)",
        `Everything in Pro, with ${PREMIUM_AI_BENEFIT.replace(/\.$/, "")}, plus unlimited personal cards, the email signature builder, and advanced analytics. Need more in a busy month? Add a top-up pack in Settings.`,
      ],
      [
        "What Teams adds ($10/user/mo, or $100/user/yr)",
        "A shared workspace billed per seat (3-seat minimum, owner included): every member gets full Premium features, plus brand lock, the option to remove ContactKickstart branding from every card, shared contacts and team-wide analytics. Add or remove seats anytime from Manage billing.",
      ],
      [
        "Auto-renewal & cancelling",
        "Paid plans renew automatically (monthly plans each month, annual plans each year). Cancel anytime from Settings → Manage billing: you keep full access to the end of the period you've paid for, then the plan simply doesn't renew. Annual plans aren't refunded mid-term.",
      ],
      [
        "Founding offers (lifetime & year)",
        "Bought the Founding Lifetime or Founding Year offer? Create your account with the same email you used at checkout and Pro unlocks automatically, with its monthly allowance. Lifetime deals never expire. Year passes run 12 months from purchase, then the account moves to the free plan by itself — no charge, and nothing in it is lost.",
      ],
      [
        "What counts as a scan",
        "1 card = 1 scan. Each business card the scanner reads uses one scan, so a photo with three cards on it uses three. Scanning your own card to build your digital card never counts.",
      ],
      [
        "Starter pack credits",
        "The starter pack adds 25 card scans and 25 follow-up drafts that never expire. They're used only after your plan's monthly allowance runs out, so on Pro they're a backup that waits until you need it.",
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
