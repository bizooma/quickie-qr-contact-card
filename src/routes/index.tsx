import { BrandLogo, BrandMark } from "@/components/BrandLogo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { createCheckout, getBillingState } from "@/lib/billing.functions";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  CalendarX,
  CheckCircle2,
  ExternalLink,
  EyeOff,
  Palette,
  QrCode,
  ScanLine,
  Sparkles,
  Trash2,
  UserX,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScanHero } from "@/components/landing/ScanHero";
import { DEMO_CARD_PATH, LiveCardButton, LiveCardDialog } from "@/components/LiveCardDialog";
import { useAuth } from "@/hooks/use-auth";
import {
  annualFreeMonths,
  FREE_SHAREBACK_LIMIT,
  PLAN_LIMITS,
  PREMIUM_ANNUAL_PRICE_LABEL,
  PREMIUM_ANNUAL_USD,
  PREMIUM_PRICE_LABEL,
  premiumAnnualFreeMonths,
  PREMIUM_AI_BENEFIT,
  PRO_AI_BENEFIT,
  PRO_ANNUAL_PRICE_LABEL,
  PRO_ANNUAL_USD,
  PRO_PRICE_LABEL,
  OFFICE_ANNUAL_PRICE_LABEL,
  OFFICE_LARGER_LINE,
  OFFICE_PRICE_LABEL,
  OFFICE_SEATS,
  officeAnnualFreeMonths,
  TOPUP_PACKS,
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
import { ProfileMenu } from "@/components/ProfileMenu";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuickieQR — Digital business cards with the follow-up written for you" },
      {
        name: "description",
        content:
          "Share your card with one QR scan, get their details back, and find the follow-up email already written, with a reminder to send it. Free to start, no app for them to install.",
      },
      {
        property: "og:title",
        content: "QuickieQR — Digital business cards with the follow-up written for you",
      },
      {
        property: "og:description",
        content:
          "Scan their card. We write the follow-up and remind you to send it. Free to start, nothing for them to install.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://quickieqr.com/" },
      // Set explicitly: without it Lovable fills in an auto-screenshot of the page.
      { property: "og:image", content: "https://quickieqr.com/brand/og-card.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content:
          "QuickieQR: Never forget a follow-up. A phone shows a 9am reminder that 14 people are waiting, with a follow-up email already written.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://quickieqr.com/brand/og-card.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "QuickieQR",
          url: "https://quickieqr.com",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description:
            "A digital business card that shares your details with one QR scan, captures theirs back, and writes the follow-up email with a reminder to send it.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
    ],
  }),
  component: Landing,
});

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

const PLAN_RANK = { free: 0, pro: 1, premium: 2 } as const;

/** A pricing card's button. Signed out (or still loading): the usual signup
 *  CTA. Signed in: "Your current plan", "Included in your plan", or a direct
 *  upgrade to that tier for the period shown — Pro subscribers moving to
 *  Premium switch in Settings, where the prorated charge is confirmed. */
function PlanCta({
  target,
  period,
  fallback,
}: {
  target: "free" | "pro" | "premium";
  period: "monthly" | "annual";
  fallback: React.ReactNode;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const { data: billing } = useQuery({
    queryKey: ["billing"],
    queryFn: () => getBillingState(),
    enabled: !!user,
  });
  if (!user || !billing) return <>{fallback}</>;
  if (billing.plan === target)
    return (
      <Button variant="outline" disabled>
        <CheckCircle2 className="h-4 w-4" />
        Your current plan
      </Button>
    );
  if (PLAN_RANK[billing.plan] > PLAN_RANK[target])
    return (
      <Button variant="outline" disabled>
        Included in your plan
      </Button>
    );
  const name = target === "premium" ? "Premium" : "Pro";
  if (target === "premium" && billing.plan === "pro" && billing.hasSubscription)
    return (
      <Button asChild>
        <Link to="/app/settings" hash="plan">
          Upgrade to Premium <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    );
  return (
    <Button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        logSiteEvent("cta_click", `pricing-upgrade-${target}`);
        try {
          const { url } = await createCheckout({
            data: {
              plan: target as "pro" | "premium",
              interval: period === "annual" ? "year" : "month",
            },
          });
          window.location.href = url;
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not start checkout");
          setBusy(false);
        }
      }}
    >
      Upgrade to {name} <ArrowRight className="h-4 w-4" />
    </Button>
  );
}

/** "$6.67/mo" style equivalent for an annual price. */
function perMonth(annualUsd: number): string {
  return `$${(annualUsd / 12).toFixed(2).replace(/\.00$/, "")}/mo`;
}

const HERO_PERSON = {
  name: "Joseph Murphy",
  title: "Marketing Technologist",
  company: "Bizooma, LLC",
  photo: "/demo/joe.jpg",
  slug: DEMO_CARD_PATH.split("/").pop()!,
  banner: "/demo/joe-banner.jpg",
  logo: "/demo/joe-logo.png",
  bio: "Marketer who codes. I build websites, software, and AI tools that turn attention into clients, mostly for law firms and nonprofits. Founder of Bizooma, based in Jacksonville.",
  email: "joe@bizooma.com",
  accent: "#B70606",
};

/** Section heading: big, left-aligned, with a highlighter swipe on the accent words. */
function Heading({
  kicker,
  children,
  className = "",
}: {
  kicker?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {kicker && (
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand">{kicker}</p>
      )}
      <h2 className="max-w-3xl text-4xl font-extrabold leading-[1.02] md:text-6xl">{children}</h2>
    </div>
  );
}

/** Highlighter-pen accent for headings. */
function Hl({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative isolate whitespace-nowrap">
      <span
        aria-hidden
        className="absolute -inset-x-1.5 bottom-[0.06em] -z-10 h-[0.42em] -skew-x-12 rounded-sm bg-pop-lime dark:bg-pop-lime/35"
      />
      {children}
    </span>
  );
}

function Landing() {
  const { user } = useAuth();
  const ab = useHeadlineVariant();
  const headline = HEADLINES[ab ?? "a"];
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  useRevealOnScroll();
  return (
    <div className="min-h-screen overflow-x-clip">
      {/* 1 · Header + hero: one full-bleed dark band */}
      <div className="dark relative overflow-hidden bg-background text-foreground">
        <div aria-hidden className="qq-dots pointer-events-none absolute inset-0" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 top-10 h-[620px] w-[620px] rounded-full bg-brand/35 blur-[140px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 left-1/4 h-[360px] w-[360px] rounded-full bg-pop-rose/20 blur-[120px]"
        />

        <header className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <BrandLogo className="text-[1.5rem] md:text-[2rem]" />
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            {(
              [
                ["#how", "How it works"],
                ["#who", "Who it's for"],
                ["#pricing", "Pricing"],
                ["#faq", "FAQ"],
              ] as const
            ).map(([href, label]) => (
              <a key={href} href={href} className="transition-colors hover:text-foreground">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link to={user ? "/app" : "/auth"}>{user ? "Open app" : "Sign in"}</Link>
            </Button>
            {user && <ProfileMenu />}
            {!user && (
              <Button
                asChild
                size="sm"
                className="hidden bg-pop-lime text-[#0E1230] hover:bg-pop-lime/85 sm:inline-flex"
              >
                <Link to="/auth" onClick={() => logSiteEvent("cta_click", variantMeta("nav", ab))}>
                  Get started free
                </Link>
              </Button>
            )}
          </div>
        </header>

        <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-8 lg:min-h-[calc(100svh-180px)] lg:grid-cols-[1.05fr_1fr] lg:px-10 lg:pb-20">
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/85">
              <Zap className="h-3.5 w-3.5 text-pop-lime" />
              Scan their card. We write the follow-up.
            </p>
            <h1 className="text-[3rem] font-extrabold leading-[0.95] tracking-[-0.04em] text-white sm:text-7xl xl:text-[5.75rem]">
              {headline.lines[0]}
              <span className="relative isolate whitespace-nowrap text-[#0E1230]">
                <span
                  aria-hidden
                  className="absolute -inset-x-2 inset-y-[0.08em] -z-10 -skew-x-6 rounded-lg bg-pop-lime"
                />
                {headline.lines[1].trim()}
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-base text-white/70 sm:text-lg md:text-xl">
              {headline.sub}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 bg-pop-lime px-7 text-base font-bold text-[#0E1230] hover:bg-pop-lime/85"
              >
                <Link
                  to={user ? "/app" : "/auth"}
                  onClick={() => logSiteEvent("cta_click", variantMeta("hero", ab))}
                >
                  Create your free card <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <LiveCardDialog from={variantMeta("hero", ab)}>
                <LiveCardButton />
              </LiveCardDialog>
            </div>
            <p className="mt-4 text-sm text-white/50">
              Free plan forever · No credit card · Nothing for them to install
            </p>
          </div>
          <div>
            <ScanHero person={HERO_PERSON} />
          </div>
        </section>

        <div className="relative border-t border-white/10">
          <dl className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-white/10 px-6 lg:px-10">
            {(
              [
                ["0", "apps they need"],
                ["1", "tap to save you"],
                ["~3s", "hello to saved"],
              ] as const
            ).map(([n, l]) => (
              <div key={l} className="px-3 py-6 first:pl-0 sm:px-8 sm:first:pl-0">
                <dt className="sr-only">{l}</dt>
                <dd className="font-display text-3xl font-extrabold text-white sm:text-5xl">{n}</dd>
                <dd className="mt-1 text-xs text-white/55 sm:text-sm">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* 2 · How it works: three beats on a timeline */}
      <section id="how" className="scroll-mt-6 px-6 py-24 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Heading kicker="How it works">
            From hello to <Hl>followed up</Hl>, in four beats.
          </Heading>
          <ol className="relative mt-16 grid gap-12 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
            <span
              aria-hidden
              className="absolute left-0 right-0 top-[2.1rem] hidden h-px bg-border lg:block"
            />
            {[
              {
                at: "0:00",
                t: "Hold up your code",
                d: "On your phone, your lock screen, a sticker on your laptop, the back of your old paper card. Build it once in about two minutes.",
              },
              {
                at: "0:01",
                t: "They point their camera",
                d: "No app, no download. Your card opens on any iPhone or Android, and one tap drops you into their contacts.",
              },
              {
                at: "0:03",
                t: "You get them back",
                d: "The “Share yours” button sends their name, email and phone straight to your contact list, with a ping the moment it lands.",
              },
              {
                at: "Day 2",
                t: "Your follow-up is waiting",
                d: "Next morning, the email is already written and QuickieQR reminds you to send it. One tap and it's in their inbox, while they still remember you.",
              },
            ].map(({ at, t, d }, idx) => (
              <li key={at} data-reveal={idx} className="relative">
                <span className="relative inline-flex items-center gap-3 bg-background pr-4">
                  <span
                    className={`h-3 w-3 rounded-full ${idx === 3 ? "bg-pop-lime ring-4 ring-pop-lime/30" : "bg-brand"}`}
                  />
                  <span className="font-display text-5xl font-extrabold tabular-nums tracking-tight text-brand md:text-6xl">
                    {at}
                  </span>
                </span>
                <h3 className="mt-5 text-xl font-bold">{t}</h3>
                <p className="mt-2 max-w-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Cta label="Make my card free" from="how-it-works" ab={ab} />
            <p className="text-sm font-semibold text-muted-foreground">
              Beats three and four are the ones paper can't do.
            </p>
          </div>
        </div>
      </section>

      {/* 3 · Paper vs QuickieQR: a full-bleed split */}
      <section className="grid md:grid-cols-2">
        <div className="bg-muted px-6 py-20 lg:px-16">
          <div className="ml-auto max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              The paper card
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-muted-foreground line-through decoration-pop-rose decoration-4 md:text-4xl">
              Hand it over and hope.
            </h2>
            <ul className="mt-10 space-y-7">
              {[
                {
                  i: Trash2,
                  t: "It gets tossed",
                  d: "The card you paid for ends up in a drawer or a bin, usually within the week.",
                },
                {
                  i: UserX,
                  t: "It only works one way",
                  d: "They get your details. You get nothing back.",
                },
                {
                  i: CalendarX,
                  t: "Events leak leads",
                  d: "Great conversations, a stack of cards, and no idea who was who by Monday.",
                },
              ].map(({ i: I, t, d }) => (
                <li key={t} className="flex gap-4">
                  <I className="mt-0.5 h-6 w-6 shrink-0 text-pop-rose" />
                  <div>
                    <h3 className="font-bold">{t}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="relative overflow-hidden bg-brand px-6 py-20 text-white lg:px-16">
          <QrCode
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -right-16 h-72 w-72 text-white/10"
          />
          <div className="relative max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-pop-lime">QuickieQR</p>
            <h2 className="mt-3 text-3xl font-extrabold md:text-4xl">Scan, save, follow up.</h2>
            <ul className="mt-10 space-y-7">
              {[
                {
                  t: "It lives in their phone",
                  d: "Saved straight to their contacts, with your photo, links and booking page.",
                },
                {
                  t: "It works both ways",
                  d: "They share their details back with a tap, and you get notified.",
                },
                {
                  t: "Monday is already sorted",
                  d: "Every contact stamped with when and where you met, ready for notes, tags and follow-up.",
                },
              ].map(({ t, d }) => (
                <li key={t} className="flex gap-4">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-pop-lime" />
                  <div>
                    <h3 className="font-bold">{t}</h3>
                    <p className="mt-1 text-sm text-white/75">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 4 · Beyond the card: a bento grid */}
      <section className="px-6 py-24 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Heading kicker="Beyond the card">
            More than a card. It's your <Hl>follow-up</Hl> machine.
          </Heading>
          <div className="mt-14 grid gap-4 md:grid-cols-3 md:grid-rows-2">
            <div
              data-reveal="0"
              className="dark relative overflow-hidden rounded-3xl border border-white/10 bg-background p-8 text-foreground md:col-span-2 md:row-span-2 md:p-10"
            >
              <div aria-hidden className="qq-dots pointer-events-none absolute inset-0" />
              <ScanLine className="relative h-10 w-10 text-pop-lime" />
              <h3 className="relative mt-6 max-w-md text-3xl font-extrabold md:text-4xl">
                Card scanner for the paper ones you still get
              </h3>
              <p className="relative mt-4 max-w-md text-white/70">
                Photograph the paper cards people hand you. The scanner reads names, titles, phones,
                emails, addresses, even the headshot, straight into your contacts.
              </p>
              <div className="relative mt-10 flex flex-wrap gap-2">
                {["Name", "Title", "Phone", "Email", "Address", "Headshot"].map((f) => (
                  <span
                    key={f}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
            {[
              {
                i: BarChart3,
                t: "Know who kept your card",
                d: "Views, saves and link clicks per card, by day and device.",
                c: "bg-pop-lime/25 dark:bg-pop-lime/10",
              },
              {
                i: Sparkles,
                t: "Follow-ups, drafted",
                d: "Draft the follow-up email from your notes, enrich a thin contact, summarize voice notes.",
                c: "bg-brand-soft",
              },
            ].map(({ i: I, t, d, c }, idx) => (
              <div key={t} data-reveal={idx + 1} className={`rounded-3xl p-7 ${c}`}>
                <I className="h-7 w-7 text-brand" />
                <h3 className="mt-4 text-lg font-bold">{t}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <div
            data-reveal="3"
            className="mt-4 flex flex-col gap-4 rounded-3xl bg-pop-rose-soft p-7 sm:flex-row sm:items-center"
          >
            <Bell className="h-7 w-7 shrink-0 text-pop-rose" />
            <div>
              <h3 className="text-lg font-bold">Know the moment they share back</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                On Pro: a push notification on your phone, plus webhooks into Make, Zapier or your
                CRM when a new contact arrives.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5 · Who it's for: editorial rows */}
      <section id="who" className="scroll-mt-6 border-t px-6 py-24 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Heading kicker="Who it's for">
            Built for people who <Hl>meet people</Hl>.
          </Heading>
          <ul className="mt-12 border-t">
            {(
              [
                [
                  "Lawyers & law firms",
                  "Bar luncheons, CLEs, the courthouse hallway. They save you in a tap, and their details come back for your follow-up.",
                  "lawyers",
                ],
                [
                  "Sales teams",
                  "Every rep on-brand, every lead captured to one pipeline.",
                  "teams",
                ],
                ["Realtors", "Your card on every yard sign and open-house table.", "realtors"],
                [
                  "Nonprofits",
                  "A Donate button, volunteer sign-ups, and a low-profile mode for people who can't be public.",
                  "nonprofits",
                ],
                [
                  "Recruiters",
                  "Candidates share their details back before they leave the booth.",
                  "recruiters",
                ],
                [
                  "Founders & freelancers",
                  "Look established from day one, and never reprint a title change.",
                  null,
                ],
              ] as const
            ).map(([t, d, slug]) => {
              const row = (
                <>
                  <span className="font-display text-2xl font-extrabold tracking-tight md:text-4xl">
                    {t}
                  </span>
                  <span className="text-muted-foreground md:max-w-md">{d}</span>
                  <ArrowRight
                    className={`hidden h-6 w-6 shrink-0 justify-self-end text-brand transition-transform group-hover:translate-x-1 md:block ${slug ? "" : "invisible"}`}
                  />
                </>
              );
              const cls =
                "group grid gap-2 border-b py-7 md:grid-cols-[1.1fr_1.4fr_auto] md:items-center md:gap-8";
              return (
                <li key={t}>
                  {slug ? (
                    <Link
                      to="/for/$audience"
                      params={{ audience: slug }}
                      className={`${cls} transition-colors hover:text-brand`}
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className={cls}>{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 6 · Office (teams): full-bleed dark band */}
      <section
        id="teams"
        className="dark relative scroll-mt-6 overflow-hidden bg-background px-6 py-24 text-foreground lg:px-10"
      >
        <div aria-hidden className="qq-dots pointer-events-none absolute inset-0" />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-brand/30 blur-[120px]"
        />
        <div className="relative mx-auto grid max-w-7xl gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-pop-lime">
              QuickieQR Office
            </p>
            <h2 className="text-4xl font-extrabold leading-[1.02] text-white md:text-6xl">
              Your whole office, one flat price.
            </h2>
            <p className="mt-6 max-w-lg text-lg text-white/70">
              {OFFICE_PRICE_LABEL} covers up to {OFFICE_SEATS} people. No per-seat math. Invite your
              team with a link, give everyone a branded card, and lock your colors and logo so no
              card drifts off-brand. Take the QuickieQR name off every card, share contacts if you
              choose, and see team-wide analytics in one place.
            </p>
            <div className="mt-9">
              <Button
                asChild
                size="lg"
                className="h-12 bg-pop-lime px-7 font-bold text-[#0E1230] hover:bg-pop-lime/85"
              >
                <Link
                  to={user ? "/app" : "/auth"}
                  onClick={() => logSiteEvent("cta_click", variantMeta("teams", ab))}
                >
                  Set up your team <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2">
            {[
              { i: Palette, t: "Brand lock", d: "Your colors and logo on every card, enforced." },
              {
                i: EyeOff,
                t: "Your brand only",
                d: "Remove QuickieQR branding from every team card. Only on Office.",
              },
              {
                i: Users,
                t: "Shared contacts",
                d: "Every captured lead visible to the team, if you turn it on.",
              },
              {
                i: Building2,
                t: "Team analytics",
                d: "Views, saves and share-backs across all team cards.",
              },
            ].map(({ i: I, t, d }) => (
              <div key={t} className="bg-background p-7">
                <I className="h-6 w-6 text-pop-lime" />
                <h3 className="mt-4 font-bold text-white">{t}</h3>
                <p className="mt-1 text-sm text-white/60">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7 · Try one: a real card */}
      <section className="px-6 py-24 lg:px-10">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.3fr_1fr]">
          <blockquote>
            <p className="font-display text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
              “A business card should work both ways: share who you are, and{" "}
              <Hl>keep who you meet</Hl>. Paper does half of that, badly.”
            </p>
            <footer className="mt-6 text-sm font-semibold text-muted-foreground">
              — the QuickieQR team
            </footer>
          </blockquote>
          <div className="rounded-3xl border-2 border-dashed border-brand/40 p-8">
            <h2 className="text-2xl font-extrabold">Don't take our word for it.</h2>
            <p className="mt-3 text-muted-foreground">
              Open a real card. Save it to your phone, tap the links, try the “Share yours” button.
              It's exactly what the people you meet will see.
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
                Open a live card
              </button>
            </LiveCardDialog>
          </div>
        </div>
      </section>

      {/* 8 · Pricing */}
      <section id="pricing" className="scroll-mt-6 border-t bg-muted/50 px-6 py-24 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Heading kicker="Pricing">
            Cheaper than a <Hl>box of cards</Hl>.
          </Heading>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            500 paper cards run $20–40, get thrown away, and tell you nothing. Start free; upgrade
            when it pays for itself.
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
                  `Collect up to ${FREE_SHAREBACK_LIMIT} contacts through “Share yours”`,
                  "Scan QR codes & digital contact cards",
                  "Views, saves & click analytics",
                  "Export contacts to your phone or any CRM (CSV)",
                  `Try card scanning with a $${TOPUP_PACKS.small.usd} top-up`,
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <PlanCta
                  target="free"
                  period={period}
                  fallback={<Cta label="Start free" from="pricing-free" ab={ab} size="default" />}
                />
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
                  `${PLAN_LIMITS.pro.enrich} contact enrichments a month & note summaries`,
                  "Unlimited share-backs, with an instant alert for each",
                  "Webhooks into Zapier, Make or your CRM",
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
                <PlanCta
                  target="pro"
                  period={period}
                  fallback={
                    <Cta
                      label="Start free, upgrade in-app"
                      from="pricing-pro"
                      ab={ab}
                      size="default"
                    />
                  }
                />
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
                  "Advanced analytics",
                  "Email signature builder",
                  "Follow-up reminders on your phone",
                  `Everything in Pro, with ${PREMIUM_AI_BENEFIT.replace(/\.$/, "")}`,
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <PlanCta
                  target="premium"
                  period={period}
                  fallback={
                    <Cta
                      label="Start free, go Premium in-app"
                      from="pricing-premium"
                      ab={ab}
                      size="default"
                    />
                  }
                />
              </div>
            </div>
            <div data-reveal="3" className="surface card-lift border border-pop-teal/60 p-7">
              <h3 className="text-lg font-bold">Office</h3>
              <p className="mt-1 font-display text-4xl font-extrabold">
                {period === "annual" ? OFFICE_ANNUAL_PRICE_LABEL : OFFICE_PRICE_LABEL}
              </p>
              <p className="text-xs text-muted-foreground">
                Flat price, up to {OFFICE_SEATS} people
                {period === "annual" && (
                  <>
                    {" — "}
                    <span className="font-semibold text-brand">
                      {officeAnnualFreeMonths()} months free
                    </span>
                  </>
                )}
                {" · auto-renews, cancel anytime"}
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  "Everything in Premium — for every member",
                  "Brand lock: your colors & logo on every card",
                  "Your brand only: no QuickieQR branding",
                  "Shared contacts: one team pipeline",
                  "Team-wide analytics",
                  `More than ${OFFICE_SEATS}? We'll set you up`,
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
                  from="pricing-office"
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
            mid-term; they just don't renew. Office is one flat price ({OFFICE_PRICE_LABEL} or{" "}
            {OFFICE_ANNUAL_PRICE_LABEL}) for up to {OFFICE_SEATS} people, owner included.{" "}
            {OFFICE_LARGER_LINE}
          </p>
        </div>
      </section>

      {/* 9 · FAQ */}
      <section id="faq" className="scroll-mt-6 px-6 py-24 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div className="lg:sticky lg:top-10 lg:self-start">
            <Heading kicker="FAQ">
              Quick <Hl>answers</Hl>.
            </Heading>
            <p className="mt-5 text-muted-foreground">
              Something else?{" "}
              <a href="mailto:support@quickieqr.com" className="font-semibold text-brand underline">
                support@quickieqr.com
              </a>
            </p>
          </div>
          <div className="divide-y border-y">
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
                "Your card has a “Share yours” button. They type their name and contact details once, you get a push notification, and they land in your QuickieQR contacts — with notes, tags and follow-up drafting ready.",
              ],
              [
                "What happens to my data and my contacts?",
                "They're yours. Every contact can be saved to your phone as a vCard or exported as a CSV for any spreadsheet or CRM — on every plan, free included — and you can delete your account — and everything in it — from Settings with one button.",
              ],
              [
                "What does the free plan include, forever?",
                `One card with QR and link, ${FREE_SHAREBACK_LIMIT} share-backs, QR-code scanning, analytics and CSV export, so you can try QuickieQR before you pay. Card scanning, follow-up drafts, enrichment, unlimited share-backs and lead alerts come with Pro. No credit card to start, and your card stays live for life.`,
              ],
              [
                "What happens if I cancel a paid plan?",
                "Your plan runs to the end of the month or year you've already paid for — you lose nothing you paid for — and it simply doesn't renew after that. Annual plans aren't refunded mid-term; cancelling just turns off the renewal. Either way your digital card (link + QR) stays live on the free plan — free for life.",
              ],
              [
                "Can my whole team use it?",
                `Yes. The Office plan (${OFFICE_PRICE_LABEL} flat, for up to ${OFFICE_SEATS} people) gives every member full Premium features plus a shared workspace: invite members with a link, provision branded cards for each of them, lock your brand colors, remove QuickieQR branding so cards show your brand only (Office is the only plan with this), and see shared contacts and team analytics in one view. More than ${OFFICE_SEATS} people? Email support@quickieqr.com.`,
              ],
            ].map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-bold marker:content-none">
                  {q}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xl leading-none text-brand transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 10 · Final CTA: full-bleed lime */}
      <section className="relative overflow-hidden bg-pop-lime px-6 py-24 text-[#0E1230] lg:px-10">
        <BrandMark className="pointer-events-none absolute -right-20 -top-20 h-[420px] w-[420px] rotate-12 opacity-[0.12]" />
        <div className="relative mx-auto max-w-7xl">
          <h2 className="max-w-4xl text-4xl font-extrabold leading-[1.02] md:text-7xl">
            The next person you meet should never have to type your name.
          </h2>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button
              asChild
              size="lg"
              className="h-12 bg-[#0E1230] px-7 text-base font-bold text-white hover:bg-[#0E1230]/85"
            >
              <Link
                to={user ? "/app" : "/auth"}
                onClick={() => logSiteEvent("cta_click", variantMeta("final", ab))}
              >
                Create your free card <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="text-sm font-semibold text-[#0E1230]/70">
              Free plan forever · No credit card · Ready in 2 minutes
            </p>
          </div>
        </div>
      </section>
      <footer className="border-t">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-3">
          <div className="text-sm text-muted-foreground">
            <BrandLogo className="text-[1.75rem]" />
            <p className="mt-3 max-w-xs">
              The quickest hello in the room. Digital business cards that capture every contact you
              meet.
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
                <Link to={user ? "/app" : "/auth"} className="hover:text-foreground">
                  {user ? "Your cards" : "Create your free card"}
                </Link>
              </li>
              <li>
                <a href={DEMO_CARD_PATH} className="hover:text-foreground">
                  See a live card
                </a>
              </li>
              <li>
                <Link to={user ? "/app" : "/auth"} className="hover:text-foreground">
                  {user ? "Open app" : "Sign in"}
                </Link>
              </li>
              <li>
                <a href="mailto:support@quickieqr.com" className="hover:text-foreground">
                  Contact support
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl items-center gap-2 border-t px-6 py-5 text-xs text-muted-foreground">
          <QrCode className="h-4 w-4" />© {new Date().getFullYear()} QuickieQR
        </div>
      </footer>
    </div>
  );
}
