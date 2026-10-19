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
import { DEMO_CARD_PATH, LiveCardButton, LiveCardDialog } from "@/components/LiveCardDialog";
import { useAuth } from "@/hooks/use-auth";
import {
  annualFreeMonths,
  PLAN_LIMITS,
  PREMIUM_ANNUAL_PRICE_LABEL,
  PREMIUM_ANNUAL_USD,
  PREMIUM_PRICE_LABEL,
  premiumAnnualFreeMonths,
  PRO_AI_BENEFIT,
  PRO_ANNUAL_PRICE_LABEL,
  PRO_ANNUAL_USD,
  PRO_PRICE_LABEL,
  TEAM_MIN_SEATS,
  TEAM_SEAT_ANNUAL_PRICE_LABEL,
  TEAM_SEAT_ANNUAL_USD,
  TEAM_SEAT_MONTHLY_USD,
  TEAM_SEAT_PRICE_LABEL,
  teamAnnualFreeMonths,
} from "@/lib/plans";
import {
  AB_STORAGE_KEY,
  HEADLINES,
  pickVariant,
  variantMeta,
  type HeadlineVariant,
} from "@/lib/ab";
import { logSiteEvent } from "@/lib/site-events";
import { useRevealOnScroll } from "@/hooks/use-reveal";
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
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "ContactKickstart",
          url: "https://contactkickstart.com",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description:
            "A digital business card that shares your details with one QR scan and captures theirs back automatically.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
    ],
  }),
  component: Landing,
});

const DEMO: CardData = {
  slug: "demo",
  label: "Work",
  full_name: "Tamzyn Williams",
  job_title: "Head of Marketing",
  company: "Contact Kickstart",
  phones: [{ label: "Mobile", value: "+1 530-867-5309" }],
  emails: [{ label: "Work", value: "TWilliams@ContactKickstart.com" }],
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
  variant?: "default" | "outline" | "secondary";
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

/** "$6.67/mo" style equivalent for an annual price. */
function perMonth(annualUsd: number): string {
  return `$${(annualUsd / 12).toFixed(2).replace(/\.00$/, "")}/mo`;
}

function Landing() {
  const { user } = useAuth();
  const free = PLAN_LIMITS.free;
  const ab = useHeadlineVariant();
  const headline = HEADLINES[ab ?? "a"];
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  useRevealOnScroll();
  return (
    <div className="min-h-screen overflow-x-clip">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <img
          src="/brand/logo-wordmark.webp"
          alt="ContactKickstart"
          className="h-16 w-auto md:h-24"
        />
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          {(
            [
              ["#how", "How it works"],
              ["#teams", "Teams"],
              ["#pricing", "Pricing"],
              ["#faq", "FAQ"],
            ] as const
          ).map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="relative transition-colors after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:rounded-full after:bg-brand after:transition-all after:duration-300 hover:text-foreground hover:after:w-full"
            >
              {label}
            </a>
          ))}
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
      <section className="relative mx-auto grid max-w-6xl items-center gap-16 px-6 pb-16 pt-10 lg:grid-cols-[1.1fr_1fr]">
        {/* Soft aurora wash behind the hero — color without noise. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="aurora-blob absolute -left-24 -top-16 h-80 w-80 rounded-full bg-brand-soft blur-3xl" />
          <div className="aurora-blob absolute right-0 top-8 h-96 w-96 rounded-full bg-pop-amber-soft blur-3xl" />
          <div className="aurora-blob absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-pop-teal-soft blur-3xl" />
        </div>
        <div>
          <p
            data-reveal="0"
            className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand-soft px-3.5 py-1 text-xs font-semibold text-accent-foreground"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Digital business cards
          </p>
          <h1 data-reveal="1" className="text-4xl font-extrabold leading-[1.05] md:text-6xl">
            {headline.lines[0]}
            <span className="text-gradient-brand">{headline.lines[1]}</span>
          </h1>
          <p data-reveal="2" className="mt-6 max-w-md text-lg text-muted-foreground">
            {headline.sub}
          </p>
          <div data-reveal="3" className="mt-8 flex flex-wrap items-center gap-4">
            <Cta label="Create your free card" from="hero" ab={ab} />
            <LiveCardDialog from={variantMeta("hero", ab)}>
              <LiveCardButton />
            </LiveCardDialog>
          </div>
          <p data-reveal="4" className="mt-3 text-xs text-muted-foreground">
            Free plan forever · No credit card · Ready in 2 minutes
          </p>
          <div
            data-reveal="5"
            className="mt-10 flex max-w-md flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            {["No app to install", "iPhone & Android", "Edits go live instantly"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-brand" />
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="relative flex justify-center">
          <div className="phone-frame phone-float rotate-2">
            <div className="h-full overflow-hidden rounded-[38px]">
              <CardView card={DEMO} headshotUrl="/demo/maya.webp" logoUrl="/demo/logo.webp" />
            </div>
          </div>
          {/* The conversation, kickstarted. Decorative — screen readers skip it. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden sm:block">
            <div
              className="chat-bubble bubble-pop absolute -left-2 top-10 max-w-[180px] lg:-left-12"
              style={{ "--pop-delay": "0.5s" } as React.CSSProperties}
            >
              Great meeting you today! 👋
            </div>
            <div
              className="chat-bubble-brand bubble-pop absolute -right-2 top-36 lg:-right-10"
              style={{ "--pop-delay": "1.1s" } as React.CSSProperties}
            >
              Saved to contacts ✓
            </div>
            <div
              className="chat-bubble bubble-pop absolute -left-1 bottom-20 lg:-left-8"
              style={{ "--pop-delay": "1.7s" } as React.CSSProperties}
            >
              <span className="inline-flex items-center gap-1.5">
                Coffee Tuesday?
                <span className="inline-flex items-end gap-0.5 pb-0.5">
                  <span className="typing-dot h-1 w-1 rounded-full bg-pop-teal" />
                  <span className="typing-dot h-1 w-1 rounded-full bg-pop-teal" />
                  <span className="typing-dot h-1 w-1 rounded-full bg-pop-teal" />
                </span>
              </span>
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
          ].map(({ i: I, t, d }, idx) => (
            <div key={t} data-reveal={idx}>
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-pop-rose-soft">
                <I className="h-5 w-5 text-pop-rose" />
              </span>
              <h2 className="text-base font-bold">{t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4 · How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-6 px-6 py-20">
        <h2 className="text-3xl font-extrabold md:text-4xl">How it works</h2>
        <div className="mt-3 h-1 w-14 rounded-full bg-[linear-gradient(90deg,var(--brand),var(--pop-amber))]" />
        <div className="mt-10 grid gap-10 md:grid-cols-3">
          {[
            {
              n: "1",
              t: "Build your card in 2 minutes",
              d: "Name, photo, links, brand colors. It lives at your own link and updates instantly, print nothing, ever again.",
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
          ].map(({ n, t, d }, idx) => (
            <div
              key={n}
              data-reveal={idx}
              className={n === "3" ? "rounded-2xl bg-brand-soft p-6 -m-6 md:m-0" : ""}
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--brand),var(--pop-rose))] font-display text-xl font-extrabold text-white shadow-soft">
                {n}
              </span>
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
          <h2 className="text-3xl font-extrabold md:text-4xl">More than a card, it's a workflow</h2>
          <div className="mt-3 h-1 w-14 rounded-full bg-[linear-gradient(90deg,var(--pop-teal),var(--brand))]" />
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
            ].map(({ i: I, t, d }, idx) => {
              const tones = [
                ["bg-brand-soft", "text-brand"],
                ["bg-pop-amber-soft", "text-pop-amber"],
                ["bg-pop-teal-soft", "text-pop-teal"],
                ["bg-pop-rose-soft", "text-pop-rose"],
              ] as const;
              const [chip, icon] = tones[idx % tones.length]!;
              return (
                <div key={t} data-reveal={idx} className="surface card-lift p-6">
                  <span
                    className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl ${chip}`}
                  >
                    <I className={`h-5 w-5 ${icon}`} />
                  </span>
                  <h3 className="text-lg font-bold">{t}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6 · Who it's for */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-extrabold md:text-4xl">Built for people who meet people</h2>
        <div className="mt-3 h-1 w-14 rounded-full bg-[linear-gradient(90deg,var(--pop-amber),var(--pop-rose))]" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["Sales teams", "Every rep on-brand, every lead captured to one pipeline.", "teams"],
              ["Realtors", "Your card on every yard sign and open-house table.", "realtors"],
              [
                "Recruiters",
                "Candidates share their details back before they leave the booth.",
                "recruiters",
              ],
              [
                "Founders & freelancers",
                "Look established from day one — and never reprint a title change.",
                null,
              ],
            ] as const
          ).map(([t, d, slug], idx) => {
            const bars = ["var(--brand)", "var(--pop-teal)", "var(--pop-amber)", "var(--pop-rose)"];
            const bar = (
              <span
                className="mb-3 block h-1 w-9 rounded-full"
                style={{ background: bars[idx % bars.length] }}
              />
            );
            return slug ? (
              <Link
                key={t}
                to="/for/$audience"
                params={{ audience: slug }}
                data-reveal={idx}
                className="surface card-lift group block p-5 hover:border-brand"
              >
                {bar}
                <h3 className="text-base font-bold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                  Learn more{" "}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ) : (
              <div key={t} data-reveal={idx} className="p-5">
                {bar}
                <h3 className="text-base font-bold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 7 · Teams — a deep-ink panel for contrast */}
      <section id="teams" className="mx-auto max-w-6xl scroll-mt-6 px-6 py-10">
        <div
          data-reveal="0"
          className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-14 text-white shadow-float md:px-12"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="aurora-blob absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
            <div className="aurora-blob absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-pop-teal/20 blur-3xl" />
          </div>
          <div className="relative max-w-2xl">
            <h2 className="text-3xl font-extrabold md:text-4xl">Put your whole team on-brand</h2>
            <div className="mt-3 h-1 w-14 rounded-full bg-[linear-gradient(90deg,var(--brand),var(--pop-amber))]" />
            <p className="mt-4 text-white/70">
              Invite your team with a link, provision branded cards for every member, and lock your
              colors and logo so no card drifts off-brand. Opt in to shared contacts and see
              team-wide analytics in one place.
            </p>
          </div>
          <div className="relative mt-8 grid gap-6 sm:grid-cols-3">
            {[
              {
                i: Palette,
                t: "Brand lock",
                d: "Your colors and logo on every card, enforced.",
                c: "text-pop-amber",
              },
              {
                i: Users,
                t: "Shared contacts",
                d: "Every captured lead visible to the team — if you turn it on.",
                c: "text-pop-teal",
              },
              {
                i: Building2,
                t: "Team analytics",
                d: "Views, saves and share-backs across all team cards.",
                c: "text-brand",
              },
            ].map(({ i: I, t, d, c }) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <I className={`mb-2 h-5 w-5 ${c}`} />
                <h3 className="text-sm font-bold">{t}</h3>
                <p className="mt-1 text-sm text-white/60">{d}</p>
              </div>
            ))}
          </div>
          <div className="relative mt-8">
            <Cta label="Set up your team" from="teams" ab={ab} variant="secondary" />
          </div>
        </div>
      </section>

      {/* 8 · Proof (honest only: live demo + builder's note) */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold md:text-4xl">
              Don't take our word for it, tap one now!
            </h2>
            <p className="mt-4 text-muted-foreground">
              The fastest way to understand ContactKickstart is to open a real card. This one is
              live right now: save it to your phone, tap the links, try the “Share yours” button.
              Everything you see is what the people you meet will see.
            </p>
            <LiveCardDialog from={variantMeta("proof", ab)}>
              <button
                type="button"
                className="mt-6 inline-flex items-center gap-2.5 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                </span>
                Open Tamzyn's live card
              </button>
            </LiveCardDialog>
          </div>
          <div data-reveal="1" className="surface card-lift relative p-7">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-4 left-5 font-serif text-7xl leading-none text-brand/25"
            >
              “
            </span>
            <p className="relative font-serif text-lg italic leading-relaxed text-foreground/85">
              “We built ContactKickstart after one conference too many: a pocket full of other
              people's cards, no idea who half of them were, and no clue what happened to the
              hundred cards we'd handed out. A card should work in both directions — share who you
              are, and keep who you meet. That's the whole product.”
            </p>
            <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
              <span className="h-1 w-6 rounded-full bg-[linear-gradient(90deg,var(--brand),var(--pop-amber))]" />
              — the ContactKickstart team
            </p>
          </div>
        </div>
      </section>

      {/* 9 · Pricing */}
      <section id="pricing" className="border-y bg-muted/40">
        <div className="mx-auto max-w-6xl scroll-mt-6 px-6 py-20">
          <h2 className="text-3xl font-extrabold md:text-4xl">Simple pricing</h2>
          <div className="mt-3 h-1 w-14 rounded-full bg-[linear-gradient(90deg,var(--brand),var(--pop-rose))]" />
          <p className="mt-3 max-w-2xl text-muted-foreground">
            A box of 500 paper cards runs $20–40, gets thrown away, and tells you nothing. Start
            free; upgrade when it pays for itself.
          </p>
          <div className="mt-8 inline-flex items-center rounded-full border bg-surface p-1 shadow-soft">
            <button
              type="button"
              onClick={() => setPeriod("monthly")}
              className={
                period === "monthly"
                  ? "rounded-full bg-foreground px-5 py-2 text-sm font-bold text-background"
                  : "rounded-full px-5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setPeriod("annual")}
              className={
                period === "annual"
                  ? "inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2 text-sm font-bold text-background"
                  : "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              Annual
              <span className="rounded-full bg-pop-amber-soft px-2 py-0.5 text-[10px] font-bold text-foreground">
                {annualFreeMonths()} months free
              </span>
            </button>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <div data-reveal="0" className="surface card-lift p-7">
              <h3 className="text-lg font-bold">Free</h3>
              <p className="mt-1 font-display text-4xl font-extrabold">$0</p>
              <p className="text-xs text-muted-foreground">forever</p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  "1 digital card with QR code & your own link",
                  "Share-back contact capture, unlimited",
                  `${free.scan} AI card scans / month (1 card = 1 scan)`,
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
            <div data-reveal="1" className="surface card-lift relative border-2 border-brand p-7">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[linear-gradient(90deg,var(--brand),var(--pop-rose))] px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-soft">
                Most popular
              </span>
              <h3 className="text-lg font-bold">Pro</h3>
              <p className="mt-1 font-display text-4xl font-extrabold">
                {period === "annual" ? PRO_ANNUAL_PRICE_LABEL : PRO_PRICE_LABEL}
              </p>
              <p className="text-xs text-muted-foreground">
                {period === "annual" ? (
                  <>
                    {perMonth(PRO_ANNUAL_USD)} equivalent —{" "}
                    <span className="font-semibold text-brand">
                      {annualFreeMonths()} months free
                    </span>
                    {" · auto-renews, cancel anytime"}
                  </>
                ) : (
                  <>
                    or {PRO_ANNUAL_PRICE_LABEL} —{" "}
                    <span className="font-semibold text-brand">
                      {annualFreeMonths()} months free
                    </span>
                    {" · auto-renews, cancel anytime"}
                  </>
                )}
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  "Up to 3 digital cards",
                  PRO_AI_BENEFIT,
                  "1 card = 1 scan, so 100 scans reads 100 cards",
                  "AI contact enrichment & note summaries",
                  "Event mode: tag everyone you meet at an event",
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
            <div data-reveal="2" className="surface card-lift border border-pop-amber/60 p-7">
              <h3 className="text-lg font-bold">Premium</h3>
              <p className="mt-1 font-display text-4xl font-extrabold">
                {period === "annual" ? PREMIUM_ANNUAL_PRICE_LABEL : PREMIUM_PRICE_LABEL}
              </p>
              <p className="text-xs text-muted-foreground">
                {period === "annual" ? (
                  <>
                    {perMonth(PREMIUM_ANNUAL_USD)} equivalent —{" "}
                    <span className="font-semibold text-brand">
                      {premiumAnnualFreeMonths()} months free
                    </span>
                    {" · auto-renews, cancel anytime"}
                  </>
                ) : (
                  <>
                    or {PREMIUM_ANNUAL_PRICE_LABEL} —{" "}
                    <span className="font-semibold text-brand">
                      {premiumAnnualFreeMonths()} months free
                    </span>
                    {" · auto-renews, cancel anytime"}
                  </>
                )}
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  "Unlimited personal cards",
                  "Advanced analytics + CSV export",
                  "Email signature builder",
                  "Follow-up reminders on your phone",
                  "Everything in Pro, with higher AI limits",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Cta
                  label="Start free, go Premium in-app"
                  from="pricing-premium"
                  ab={ab}
                  size="default"
                />
              </div>
            </div>
            <div data-reveal="3" className="surface card-lift border border-pop-teal/60 p-7">
              <h3 className="text-lg font-bold">Teams</h3>
              <p className="mt-1 font-display text-4xl font-extrabold">
                {period === "annual" ? TEAM_SEAT_ANNUAL_PRICE_LABEL : `${TEAM_SEAT_PRICE_LABEL}/mo`}
              </p>
              <p className="text-xs text-muted-foreground">
                {TEAM_MIN_SEATS}-seat minimum — from{" "}
                {period === "annual"
                  ? `$${TEAM_MIN_SEATS * TEAM_SEAT_ANNUAL_USD}/yr`
                  : `$${TEAM_MIN_SEATS * TEAM_SEAT_MONTHLY_USD}/mo`}
                {period === "annual" && (
                  <>
                    {" — "}
                    <span className="font-semibold text-brand">
                      {teamAnnualFreeMonths()} months free
                    </span>
                  </>
                )}
                {" · auto-renews, cancel anytime"}
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  "Everything in Premium — for every member",
                  "Brand lock: your colors & logo on every card",
                  "Shared contacts: one team pipeline",
                  "Team-wide analytics",
                  "Add seats anytime as you grow",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Cta
                  label="Start free, add your team in-app"
                  from="pricing-teams"
                  ab={ab}
                  size="default"
                />
              </div>
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-xs text-muted-foreground">
            Paid plans renew automatically — monthly plans each month, annual plans each year.
            Cancel anytime from Settings: you keep full access until the end of the month or year
            you've paid for, and you're simply not billed again. Annual plans aren't refunded
            mid-term; they just don't renew. Teams are billed per seat ({TEAM_SEAT_PRICE_LABEL}
            /mo or {TEAM_SEAT_ANNUAL_PRICE_LABEL}, minimum {TEAM_MIN_SEATS} seats; the owner uses
            one) and seats can be added or reduced anytime from billing.
          </p>
        </div>
      </section>

      {/* 10 · FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-6 px-6 py-20">
        <h2 className="text-3xl font-extrabold md:text-4xl">Questions, answered</h2>
        <div className="mt-3 h-1 w-14 rounded-full bg-[linear-gradient(90deg,var(--pop-teal),var(--pop-amber))]" />
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
              "They're yours. Every contact can be saved to your phone as a vCard, Premium adds one-click CSV export of everything, and you can delete your account — and everything in it — from Settings with one button.",
            ],
            [
              "What does the free plan include, forever?",
              `One card with QR and link, unlimited share-back capture, analytics, notifications, and ${free.scan} AI card scans a month. No credit card to start, no trial clock.`,
            ],
            [
              "What happens if I cancel a paid plan?",
              "Your plan runs to the end of the month or year you've already paid for — you lose nothing you paid for — and it simply doesn't renew after that. Annual plans aren't refunded mid-term; cancelling just turns off the renewal. Either way your digital card (link + QR) stays live on the free plan — free for life.",
            ],
            [
              "Can my whole team use it?",
              "Yes. The Teams plan ($10 per user/month, 3-seat minimum) gives every member full Premium features plus a shared workspace: invite members with a link, provision branded cards for each of them, lock your brand colors, and see shared contacts and team analytics in one view.",
            ],
          ].map(([q, a]) => (
            <details
              key={q}
              className="surface group px-5 py-4 transition-colors hover:border-brand/40"
            >
              <summary className="cursor-pointer list-none text-sm font-bold marker:content-none">
                {q}
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 11 · Final CTA + footer */}
      <section className="relative overflow-hidden bg-[linear-gradient(130deg,oklch(0.64_0.21_35),oklch(0.5_0.2_18))]">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-6 h-48 w-48 rounded-full border border-white/15" />
          <div className="absolute -right-10 bottom-0 h-64 w-64 rounded-full border border-white/10" />
          <QrCode className="absolute right-[12%] top-8 h-10 w-10 text-white/15" />
          <div className="absolute left-[10%] bottom-10 rounded-2xl rounded-bl-sm border border-white/20 px-4 py-2 text-xs font-semibold text-white/40">
            Great meeting you! 👋
          </div>
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-16 text-center">
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
              <li>
                <Link to="/security" className="hover:text-foreground">
                  Security
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
