import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  CalendarX,
  CheckCircle2,
  ExternalLink,
  Palette,
  QrCode,
  ScanLine,
  Sparkles,
  Trash2,
  UserX,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardView } from "@/components/card/CardView";
import { useAuth } from "@/hooks/use-auth";
import { PLAN_LIMITS, PRO_PRICE_LABEL } from "@/lib/plans";
import {
  AB_STORAGE_KEY,
  HEADLINES,
  pickVariant,
  variantMeta,
  type HeadlineVariant,
} from "@/lib/ab";
import { logSiteEvent } from "@/lib/site-events";
import type { CardData } from "@/lib/card-model";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ContactKickstart — Never lose another lead to a paper card" },
      {
        name: "description",
        content:
          "A digital business card that shares your details with one QR scan — and captures theirs back automatically. Free to start, no app for them to install.",
      },
      { property: "og:title", content: "ContactKickstart — Never lose another lead" },
      {
        property: "og:description",
        content: "Share your card with one QR scan and capture their details back. Free to start.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const DEMO: CardData = {
  slug: "demo",
  label: "Work",
  full_name: "Tamzyn Williams",
  job_title: "Head of Marketing",
  company: "Northwind",
  phones: [{ label: "Mobile", value: "+1 530-867-5309" }],
  emails: [{ label: "Work", value: "TWilliams@Northwind.com" }],
  website: "ContactKickstart.com",
  location: null,
  bio: null,
  headshot_path: null,
  logo_path: null,
  accent_color: "#E8553D",
  background_color: "#FFFFFF",
  font: "display",
  template: "banner",
  links: [
    { label: "LinkedIn", url: "x", icon: "linkedin" },
    { label: "Book a call", url: "x", icon: "calendar" },
  ],
};

const DEMO_CARD_PATH = "/c/tamzyn";

/** Sticky 50/50 headline assignment. SSR and first paint render variant A;
 *  the stored (or freshly drawn) variant applies after hydration. */
function useHeadlineVariant(): HeadlineVariant | null {
  const [ab, setAb] = useState<HeadlineVariant | null>(null);
  useEffect(() => {
    try {
      const v = pickVariant(localStorage.getItem(AB_STORAGE_KEY), Math.random());
      localStorage.setItem(AB_STORAGE_KEY, v);
      setAb(v);
    } catch {
      setAb(pickVariant(null, Math.random()));
    }
  }, []);
  return ab;
}

/** Primary signup CTA; every instance logs where it was clicked + the headline variant. */
function Cta({
  label,
  from,
  ab,
  size = "lg",
  variant = "default",
}: {
  label: string;
  from: string;
  ab: HeadlineVariant | null;
  size?: "lg" | "default";
  variant?: "default" | "outline";
}) {
  const { user } = useAuth();
  return (
    <Button asChild size={size} variant={variant}>
      <Link
        to={user ? "/app" : "/auth"}
        onClick={() => logSiteEvent("cta_click", variantMeta(from, ab))}
      >
        {label} <ArrowRight className="h-4 w-4" />
      </Link>
    </Button>
  );
}

function Landing() {
  const { user } = useAuth();
  const free = PLAN_LIMITS.free;
  const ab = useHeadlineVariant();
  const headline = HEADLINES[ab ?? "a"];
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <img
          src="/brand/logo-wordmark.webp"
          alt="ContactKickstart"
          className="h-16 w-auto md:h-24"
        />
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <a href="#how" className="hover:text-foreground">
            How it works
          </a>
          <a href="#teams" className="hover:text-foreground">
            Teams
          </a>
          <a href="#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <a href="#faq" className="hover:text-foreground">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link to={user ? "/app" : "/auth"}>{user ? "Open app" : "Sign in"}</Link>
          </Button>
          {!user && (
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/auth" onClick={() => logSiteEvent("cta_click", variantMeta("nav", ab))}>
                Get started free
              </Link>
            </Button>
          )}
        </div>
      </header>

      {/* 2 · Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-16 px-6 pb-16 pt-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="mb-4 inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-accent-foreground">
            Digital business cards
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.05] md:text-6xl">
            {headline.lines[0]}
            <span className="text-brand">{headline.lines[1]}</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">{headline.sub}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Cta label="Create your free card" from="hero" ab={ab} />
            <a
              href={DEMO_CARD_PATH}
              onClick={() => logSiteEvent("demo_click", variantMeta("hero", ab))}
              className="inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
            >
              See a live card <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Free plan forever · No credit card · Ready in 2 minutes
          </p>
          <div className="mt-10 flex max-w-md flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {["No app to install", "iPhone & Android", "Edits go live instantly"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-brand" />
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex justify-center">
          <div className="phone-frame rotate-2">
            <div className="h-full overflow-hidden rounded-[38px]">
              <CardView card={DEMO} headshotUrl="/demo/maya.webp" logoUrl="/demo/logo.webp" />
            </div>
          </div>
        </div>
      </section>

      {/* 3 · Problem */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 md:grid-cols-3">
          {[
            {
              i: Trash2,
              t: "Paper cards get tossed",
              d: "The card you paid for ends up in a drawer or a bin — usually within the week.",
            },
            {
              i: UserX,
              t: "You can't follow up with a pocket",
              d: "Handing out your card gives them your details. It gets you nothing back.",
            },
            {
              i: CalendarX,
              t: "Every event leaks leads",
              d: "Great conversations, a stack of cards, and no idea who was who by Monday.",
            },
          ].map(({ i: I, t, d }) => (
            <div key={t}>
              <I className="mb-3 h-6 w-6 text-brand" />
              <h2 className="text-base font-bold">{t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4 · How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-6 px-6 py-20">
        <h2 className="text-3xl font-extrabold md:text-4xl">How it works</h2>
        <div className="mt-10 grid gap-10 md:grid-cols-3">
          {[
            {
              n: "1",
              t: "Build your card in 2 minutes",
              d: "Name, photo, links, brand colors. It lives at your own link and updates instantly — print nothing, ever again.",
            },
            {
              n: "2",
              t: "They scan your QR — no app",
              d: "Your card opens as a web page on any phone. One tap saves you straight to their contacts.",
            },
            {
              n: "3",
              t: "Their details come back to you",
              d: "A “Share yours” button on your card sends their name, email and phone to your contact list — with a notification the moment it happens.",
            },
          ].map(({ n, t, d }) => (
            <div key={n} className={n === "3" ? "rounded-2xl bg-brand-soft p-6 -m-6 md:m-0" : ""}>
              <span className="font-display text-4xl font-extrabold text-brand">{n}</span>
              <h3 className="mt-3 text-lg font-bold">{t}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm font-semibold text-brand">
          Step 3 is the one paper can't do — the card works in both directions.
        </p>
        <div className="mt-8">
          <Cta label="Make my card free" from="how-it-works" ab={ab} />
        </div>
      </section>

      {/* 5 · Beyond the card */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-extrabold md:text-4xl">More than a card — a workflow</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {[
              {
                i: ScanLine,
                t: "AI card scanner",
                d: "Photograph the paper cards you collect. The scanner reads names, titles, phones, emails, addresses — even the headshot — straight into your contacts.",
              },
              {
                i: BarChart3,
                t: "Know who kept your card",
                d: "Views, saves and link clicks per card, by day and by device. A paper card tells you nothing after it leaves your hand.",
              },
              {
                i: Sparkles,
                t: "AI follow-ups & enrichment",
                d: "Draft the follow-up email from your notes, enrich a thin contact from their company, summarize long voice notes.",
              },
              {
                i: Bell,
                t: "Know the moment they share back",
                d: "Push notifications on your phone, plus webhooks into Make, Zapier or your CRM when a new contact arrives.",
              },
            ].map(({ i: I, t, d }) => (
              <div key={t} className="surface p-6">
                <I className="mb-3 h-6 w-6 text-brand" />
                <h3 className="text-lg font-bold">{t}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6 · Who it's for */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-extrabold md:text-4xl">Built for people who meet people</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Sales teams", "Every rep on-brand, every lead captured to one pipeline."],
            ["Realtors", "Your card on every yard sign and open-house table."],
            ["Recruiters", "Candidates share their details back before they leave the booth."],
            [
              "Founders & freelancers",
              "Look established from day one — and never reprint a title change.",
            ],
          ].map(([t, d]) => (
            <div key={t}>
              <h3 className="text-base font-bold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7 · Teams */}
      <section id="teams" className="border-y bg-muted/40">
        <div className="mx-auto max-w-6xl scroll-mt-6 px-6 py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-extrabold md:text-4xl">Put your whole team on-brand</h2>
            <p className="mt-4 text-muted-foreground">
              Invite your team with a link, provision branded cards for every member, and lock your
              colors and logo so no card drifts off-brand. Opt in to shared contacts and see
              team-wide analytics in one place.
            </p>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { i: Palette, t: "Brand lock", d: "Your colors and logo on every card, enforced." },
              {
                i: Users,
                t: "Shared contacts",
                d: "Every captured lead visible to the team — if you turn it on.",
              },
              {
                i: Building2,
                t: "Team analytics",
                d: "Views, saves and share-backs across all team cards.",
              },
            ].map(({ i: I, t, d }) => (
              <div key={t} className="surface p-5">
                <I className="mb-2 h-5 w-5 text-brand" />
                <h3 className="text-sm font-bold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Cta label="Set up your team" from="teams" ab={ab} />
          </div>
        </div>
      </section>

      {/* 8 · Proof (honest only: live demo + builder's note) */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold md:text-4xl">
              Don't take our word for it — tap one
            </h2>
            <p className="mt-4 text-muted-foreground">
              The fastest way to understand ContactKickstart is to open a real card. This one is
              live right now: save it to your phone, tap the links, try the “Share yours” button.
              Everything you see is what the people you meet will see.
            </p>
            <a
              href={DEMO_CARD_PATH}
              onClick={() => logSiteEvent("demo_click", variantMeta("proof", ab))}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Open Tamzyn's live card <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <div className="surface p-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              “We built ContactKickstart after one conference too many: a pocket full of other
              people's cards, no idea who half of them were, and no clue what happened to the
              hundred cards we'd handed out. A card should work in both directions — share who you
              are, and keep who you meet. That's the whole product.”
            </p>
            <p className="mt-3 text-sm font-semibold">— the ContactKickstart team</p>
          </div>
        </div>
      </section>

      {/* 9 · Pricing */}
      <section id="pricing" className="border-y bg-muted/40">
        <div className="mx-auto max-w-4xl scroll-mt-6 px-6 py-20">
          <h2 className="text-3xl font-extrabold md:text-4xl">Simple pricing</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            A box of 500 paper cards runs $20–40, gets thrown away, and tells you nothing. Start
            free; upgrade when it pays for itself.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="surface p-7">
              <h3 className="text-lg font-bold">Free</h3>
              <p className="mt-1 font-display text-4xl font-extrabold">$0</p>
              <p className="text-xs text-muted-foreground">forever</p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  "1 digital card with QR code & your own link",
                  "Share-back contact capture, unlimited",
                  `${free.scan} AI card scans / month`,
                  "Views, saves & click analytics",
                  "Push & webhook notifications",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Cta label="Start free" from="pricing-free" ab={ab} size="default" />
              </div>
            </div>
            <div className="surface border-2 border-brand p-7">
              <h3 className="text-lg font-bold">Pro</h3>
              <p className="mt-1 font-display text-4xl font-extrabold">{PRO_PRICE_LABEL}</p>
              <p className="text-xs text-muted-foreground">cancel anytime</p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  `Up to ${PLAN_LIMITS.pro.cards} cards — one per audience`,
                  "Unlimited AI card scanning",
                  "Unlimited AI enrichment, follow-ups & summaries",
                  "Teams: branded cards, invites, shared contacts",
                  "Everything in Free",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Cta label="Start free, upgrade in-app" from="pricing-pro" ab={ab} size="default" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10 · FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-6 px-6 py-20">
        <h2 className="text-3xl font-extrabold md:text-4xl">Questions, answered</h2>
        <div className="mt-8 space-y-3">
          {[
            [
              "Does the other person need the app?",
              "No. Your card is a web page — they scan your QR or tap your link, see your card instantly, and save you to their phone with one tap. Nothing to install on their side, ever.",
            ],
            [
              "What if my details change?",
              "Edit your card and it's live everywhere immediately. Your QR code and link never change, so the card on your email signature, slide deck or sticker keeps working.",
            ],
            [
              "How does capturing their info work?",
              "Your card has a “Share yours” button. They type their name and contact details once, you get a push notification, and they land in your ContactKickstart contacts — with notes, tags and AI follow-up drafting ready.",
            ],
            [
              "What happens to my data and my contacts?",
              "They're yours. Export contacts as CSV or vCard anytime, and delete your account — and everything in it — from Settings with one button.",
            ],
            [
              "What does the free plan include, forever?",
              `One card with QR and link, unlimited share-back capture, analytics, notifications, and ${free.scan} AI card scans a month. No credit card to start, no trial clock.`,
            ],
            [
              "Can my whole team use it?",
              "Yes. Pro includes teams: invite members with a link, provision branded cards for each of them, lock your brand colors, and see shared contacts and team analytics in one view.",
            ],
          ].map(([q, a]) => (
            <details key={q} className="surface group px-5 py-4">
              <summary className="cursor-pointer list-none text-sm font-bold marker:content-none">
                {q}
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 11 · Final CTA + footer */}
      <section className="bg-brand">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="mx-auto max-w-2xl text-3xl font-extrabold text-white md:text-4xl">
            The next person you meet should never have to type your name.
          </h2>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg" variant="secondary">
              <Link
                to={user ? "/app" : "/auth"}
                onClick={() => logSiteEvent("cta_click", variantMeta("final", ab))}
              >
                Create your free card <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-white/80">
            Free plan forever · No credit card · Ready in 2 minutes
          </p>
        </div>
      </section>
      <footer className="border-t">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-3">
          <div className="text-sm text-muted-foreground">
            <img src="/brand/logo-wordmark.webp" alt="ContactKickstart" className="h-14 w-auto" />
            <p className="mt-3 max-w-xs">
              Digital business cards that capture every contact you meet.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold">Product</h3>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              <li>
                <a href="#how" className="hover:text-foreground">
                  How it works
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-foreground">
                  Pricing
                </a>
              </li>
              <li>
                <Link to="/help" className="hover:text-foreground">
                  Help
                </Link>
              </li>
              <li>
                <a href="#faq" className="hover:text-foreground">
                  FAQ
                </a>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-foreground">
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-foreground">
                  Terms of service
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold">Get started</h3>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link to="/auth" className="hover:text-foreground">
                  Create your free card
                </Link>
              </li>
              <li>
                <a href={DEMO_CARD_PATH} className="hover:text-foreground">
                  See a live card
                </a>
              </li>
              <li>
                <Link to="/auth" className="hover:text-foreground">
                  Sign in
                </Link>
              </li>
              <li>
                <a href="mailto:support@myaisummit.dev" className="hover:text-foreground">
                  Contact support
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl items-center gap-2 border-t px-6 py-5 text-xs text-muted-foreground">
          <QrCode className="h-4 w-4" />© {new Date().getFullYear()} ContactKickstart
        </div>
      </footer>
    </div>
  );
}
