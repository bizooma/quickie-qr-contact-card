import { appHead } from "@/lib/seo";
import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  ChevronRight,
  Copy,
  Gift,
  Lightbulb,
  LogOut,
  Rocket,
  Share2,
  Sparkles,
} from "lucide-react";
import {
  computeReferralDiscount,
  FRIEND_FIRST_PCT,
  MAX_REFERRAL_PCT,
  REFERRER_FIRST_PCT,
  REFERRER_ONGOING_PCT,
  referralLink,
} from "@/lib/referral";
import { useDismissedTips } from "@/components/FeatureTip";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listCards } from "@/lib/cards-api";
import { deleteMyAccount } from "@/lib/account.functions";
import { getVapidPublicKey } from "@/lib/capture.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme, type ThemePref } from "@/hooks/use-theme";
import { createBillingPortal, createCheckout, getBillingState } from "@/lib/billing.functions";
import {
  allowanceLine,
  annualFreeMonths,
  creditEligible,
  FREE_SHAREBACK_LIMIT,
  KIND_LABELS,
  PLAN_NAMES,
  PREMIUM_ANNUAL_PRICE_LABEL,
  PREMIUM_PRICE_LABEL,
  premiumAnnualFreeMonths,
  PRO_AI_BENEFIT,
  PREMIUM_AI_BENEFIT,
  PLAN_LIMITS,
  PRO_ANNUAL_PRICE_LABEL,
  PRO_PRICE_LABEL,
  SCAN_UNIT_NOTE,
  TEAM_MIN_SEATS,
  TEAM_SEAT_ANNUAL_PRICE_LABEL,
  TEAM_SEAT_PRICE_LABEL,
  teamAnnualFreeMonths,
  topupLabel,
  type TopupPack,
  USAGE_KINDS,
} from "@/lib/plans";
import { InstallInstructions } from "@/components/InstallPrompt";
import { ProUpsell, usePlan } from "@/components/PremiumGate";

export const Route = createFileRoute("/app/settings")({ head: appHead('Settings', 'Manage your profile, cards and account.'), component: Settings });

function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const del = useServerFn(deleteMyAccount);
  const { plan } = usePlan();
  const { data: cards = [] } = useQuery({ queryKey: ["cards"], queryFn: listCards });
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (profile) setName(profile.display_name ?? "");
  }, [profile]);

  async function saveProfile() {
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() || null })
      .eq("id", user!.id);
    if (error) toast.error(error.message);
    else toast.success("Profile saved");
  }
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }
  async function deleteAccount() {
    setBusy(true);
    try {
      await del();
      await supabase.auth.signOut();
      navigate({ to: "/" });
      toast.success("Your account and data were deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete account");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-10 pb-10">
      <h1 className="text-3xl font-bold">Settings</h1>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Profile</h2>
        <div className="space-y-1">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={user?.email ?? ""} disabled />
        </div>
        <div className="space-y-1">
          <Label htmlFor="display-name">Display name</Label>
          <Input id="display-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <ThemePicker />
        <Button onClick={saveProfile}>Save</Button>
        <Link
          to="/app/roadmap"
          className="surface flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
        >
          <Rocket className="h-4 w-4 text-brand" />
          <span className="flex-1">
            <span className="block text-sm font-medium">Roadmap & requests</span>
            <span className="block text-xs text-muted-foreground">
              See what's coming, vote for what you want, and request features
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </section>
      <PlanSection />
      <InviteSection />
      <section>
        <h2 className="mb-3 text-lg font-bold">Team</h2>
        <Link to="/app/org" className="surface flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium">Manage your team</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold">Cards</h2>
        <ul className="surface divide-y">
          {cards.map((c) => (
            <li key={c.id}>
              <Link
                to="/app/cards/$id"
                params={{ id: c.id }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
              >
                <span className="h-3 w-3 rounded-full" style={{ background: c.accent_color }} />
                <span className="flex-1 font-medium">{c.label}</span>
                <span className="text-xs text-muted-foreground">/c/{c.slug}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <TipsSection />
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Install the app</h2>
        <InstallInstructions />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-bold">Notifications & integrations</h2>
        {plan === "free" ? (
          <ProUpsell feature="An instant alert when someone shares their details">
            <p className="text-sm text-muted-foreground">
              Pro can also send every new contact to Zapier or your CRM through a webhook.
            </p>
          </ProUpsell>
        ) : (
          <>
            <PushToggle />
            <WebhookField
              initial={profile?.webhook_url ?? ""}
              onSave={async (url) => {
                const { error } = await supabase
                  .from("profiles")
                  .update({ webhook_url: url || null })
                  .eq("id", user!.id);
                if (error) toast.error(error.message);
                else toast.success(url ? "Webhook saved" : "Webhook removed");
              }}
            />
          </>
        )}
      </section>
      <section className="space-y-3">
        <Button variant="outline" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </section>
      <DangerZone
        confirm={confirm}
        setConfirm={setConfirm}
        busy={busy}
        deleteAccount={deleteAccount}
      />
    </div>
  );
}


type ReferralSummary = {
  signups: number;
  paying: number;
  bonus_pending: number;
  friend_discount: boolean;
  card_slug: string | null;
};

/** Invite friends: their link, the deal, and what it's earning them now. */
function InviteSection() {
  const { data: s } = useQuery({
    queryKey: ["referral-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_referral_summary");
      if (error) throw error;
      return data as unknown as ReferralSummary;
    },
  });
  if (!s) return null;
  const link = s.card_slug ? referralLink(window.location.origin, s.card_slug) : null;
  const next = computeReferralDiscount({
    friend: false,
    paying: s.paying,
    pending: s.bonus_pending,
  }).pct;

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy — select the link and copy it instead");
    }
  }
  async function share() {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "ContactKickstart",
          text: `Turn business cards into contacts and follow-ups. Get ${FRIEND_FIRST_PCT}% off your first month of Pro or Premium with my link:`,
          url: link,
        });
        return;
      } catch {
        // Cancelled — fall back to copying.
      }
    }
    await copy();
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">Invite friends</h2>
      <p className="text-sm text-muted-foreground">
        Friends who sign up with your link get {FRIEND_FIRST_PCT}% off their first month (or
        year) of Pro or Premium. When they pay, you get {REFERRER_FIRST_PCT}% off your next
        payment, then {REFERRER_ONGOING_PCT}% off every payment for as long as they stay
        subscribed — it stacks, up to {MAX_REFERRAL_PCT}% off with{" "}
        {MAX_REFERRAL_PCT / REFERRER_ONGOING_PCT} paying friends. You also get 5 bonus card scans for
        every friend who signs up.
      </p>
      {link ? (
        <div className="surface space-y-3 p-4">
          <div className="flex items-center gap-2">
            <input
              readOnly
              aria-label="Your invite link"
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
            />
            <Button size="sm" variant="outline" onClick={() => void copy()}>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
            <Button size="sm" onClick={() => void share()}>
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div>
              <dt className="text-xs text-muted-foreground">Signed up</dt>
              <dd className="text-lg font-bold tabular-nums">{s.signups}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Paying</dt>
              <dd className="text-lg font-bold tabular-nums">{s.paying}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Your next payment</dt>
              <dd className="text-lg font-bold tabular-nums">{next}% off</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            Discounts apply to your own Pro or Premium subscription (Teams bills aren't
            discounted). No subscription yet? They're applied when you start one.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Create your card first — your invite link is based on it.
        </p>
      )}
    </section>
  );
}

/** Brings back every "how this works" tip the user turned off. */
function TipsSection() {
  const { dismissed, resetAll } = useDismissedTips();
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">Tips</h2>
      <p className="text-sm text-muted-foreground">
        Each screen has a short guide — tap <strong>Tips</strong> at the top of any screen to see
        it. {dismissed.length > 0 && `You've turned off ${dismissed.length} of them.`}
      </p>
      <Button
        variant="outline"
        disabled={!dismissed.length}
        onClick={async () => {
          await resetAll();
          toast.success("Tips will show again as you visit each screen");
        }}
      >
        <Lightbulb className="h-4 w-4" />
        Show tips again
      </Button>
    </section>
  );
}

/** Light / Dark / System appearance dropdown; applies instantly, no reload. */
function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="space-y-1">
      <Label>Appearance</Label>
      <Select value={theme} onValueChange={(v) => setTheme(v as ThemePref)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="system">🖥️ System</SelectItem>
          <SelectItem value="light">☀️ Light</SelectItem>
          <SelectItem value="dark">🌙 Dark</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">System follows your device's setting.</p>
    </div>
  );
}

const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5);

/** Current plan, this month's AI usage, and the upgrade/manage actions. */
function PlanSection() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const {
    data: billing,
    isError: billingFailed,
    refetch: refetchBilling,
  } = useQuery({ queryKey: ["billing"], queryFn: () => getBillingState() });
  const [seats, setSeats] = useState(TEAM_MIN_SEATS);

  // The avatar menu links here as #plan and #top-ups; both render only once
  // billing has loaded, so scroll after that.
  const { hash } = useLocation();
  useEffect(() => {
    if (billing && hash) document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
  }, [billing, hash]);

  // Back from Stripe Checkout: thank the user and refetch until the webhook
  // has flipped the plan (it usually lands within a few seconds).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("billing");
    if (!state) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (state === "success") {
      toast.success("Payment received — your plan updates in a moment");
      const timers = [2000, 5000, 10000].map((ms) =>
        setTimeout(() => qc.invalidateQueries({ queryKey: ["billing"] }), ms),
      );
      return () => timers.forEach(clearTimeout);
    }
    if (state === "cancelled") toast("Checkout cancelled — no charge was made");
    return;
  }, [qc]);

  async function upgrade(
    plan: "pro" | "premium" | "team" | "topup",
    interval: "month" | "year" = "month",
    seats?: number,
    pack?: TopupPack,
  ) {
    setBusy(true);
    try {
      const { url } = await createCheckout({
        data: { plan, interval, ...(seats ? { seats } : {}), ...(pack ? { pack } : {}) },
      });
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start checkout");
      setBusy(false);
    }
  }

  async function manage() {
    setBusy(true);
    try {
      const { url } = await createBillingPortal();
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open billing");
      setBusy(false);
    }
  }

  if (billingFailed && !billing)
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Plan & usage</h2>
        <p className="text-sm text-muted-foreground">
          Couldn’t load your plan.{" "}
          <button type="button" onClick={() => refetchBilling()} className="underline">
            Try again
          </button>
        </p>
      </section>
    );
  if (!billing) return null;
  const paid = billing.plan !== "free";
  return (
    <section id="plan" className="scroll-mt-20 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">Plan & usage</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${paid ? "bg-brand text-white" : "bg-muted text-muted-foreground"}`}
        >
          {PLAN_NAMES[billing.plan]}
        </span>
      </div>
      <div className="surface space-y-3 p-4">
        {USAGE_KINDS.map((k) => {
          const u = billing.usage[k];
          const pct = u.limit ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
          const bonus = creditEligible(k) ? billing.credits[k] : 0;
          return (
            <div key={k}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-medium">
                  {KIND_LABELS[k]}
                  {k === "scan" && (
                    <span className="font-normal text-muted-foreground"> ({SCAN_UNIT_NOTE})</span>
                  )}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {u.limit === null
                    ? `${u.used} this month`
                    : u.limit === 0
                      ? bonus > 0
                        ? `${bonus} credits left · never expire`
                        : "Comes with Pro"
                      : allowanceLine(k, u.used, u.limit)}
                </span>
              </div>
              {u.limit !== null && u.limit > 0 && (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${pct >= 100 ? "bg-destructive" : "bg-brand"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
              {u.limit !== null && u.limit > 0 && bonus > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  +{bonus} starter credits — used after your monthly allowance, never expire
                </p>
              )}
            </div>
          );
        })}
        {billing.sharebacksUsed !== null && (
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="font-medium">Share-backs</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.max(0, FREE_SHAREBACK_LIMIT - billing.sharebacksUsed)} of{" "}
                {FREE_SHAREBACK_LIMIT} free left · unlimited on Pro
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${billing.sharebacksUsed >= FREE_SHAREBACK_LIMIT ? "bg-destructive" : "bg-brand"}`}
                style={{
                  width: `${Math.min(100, Math.round((billing.sharebacksUsed / FREE_SHAREBACK_LIMIT) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
      {billing.planExpiresAt && billing.plan !== "free" && !billing.hasSubscription && (
        <p className="rounded-xl border border-brand/40 bg-brand-soft/40 px-3 py-2 text-xs">
          Your {PLAN_NAMES[billing.plan]} plan runs until{" "}
          {new Date(billing.planExpiresAt).toLocaleDateString()}
          {daysUntil(billing.planExpiresAt) <= 30 &&
            " — after that your account moves to the free plan. Keep everything by subscribing below."}
        </p>
      )}
      {billing.coveredByTeam ? (
        <p className="text-sm text-muted-foreground">
          Premium is covered by your seat on <strong>{billing.coveredByTeam}</strong>. The team owner
          manages billing.
        </p>
      ) : billing.plan === "premium" ? (
        <div id="top-ups" className="flex scroll-mt-20 flex-wrap gap-2">
          {billing.hasSubscription && (
            <Button variant="outline" disabled={busy || !billing.stripeConfigured} onClick={manage}>
              Manage billing
            </Button>
          )}
          {billing.teamConfigured && billing.teamSeats < TEAM_MIN_SEATS && (
            <Button variant="outline" disabled={busy} onClick={() => upgrade("team", "month", seats)}>
              Get Teams — {TEAM_SEAT_PRICE_LABEL}/mo
            </Button>
          )}
          {billing.topupPacks.map((pack) => (
            <Button
              key={pack}
              variant="outline"
              disabled={busy}
              onClick={() => upgrade("topup", "month", undefined, pack)}
            >
              Add {topupLabel(pack)}
            </Button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {billing.referralPct > 0 && (
            <p className="flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-sm font-medium text-foreground">
              <Gift className="h-4 w-4 shrink-0 text-brand" />
              Referral discount: {billing.referralPct}% off your first payment, applied at checkout.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {billing.plan === "free" && (
              <>
                <Button
                  disabled={busy || !billing.stripeConfigured}
                  onClick={() => upgrade("pro", "month")}
                >
                  <Sparkles className="h-4 w-4" />
                  Upgrade to Pro — {PRO_PRICE_LABEL}
                </Button>
                {billing.annualConfigured && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => upgrade("pro", "year")}
                    className="border-brand"
                  >
                    {PRO_ANNUAL_PRICE_LABEL} — {annualFreeMonths()} months free
                  </Button>
                )}
              </>
            )}
            {billing.hasSubscription ? (
              <Button
                variant="outline"
                disabled={busy || !billing.stripeConfigured}
                onClick={manage}
              >
                Manage billing / switch plan
              </Button>
            ) : (
              <>
                <Button
                  variant={billing.plan === "pro" ? "default" : "outline"}
                  disabled={busy || !billing.premiumConfigured}
                  onClick={() => upgrade("premium")}
                  className={billing.plan === "pro" ? undefined : "border-brand"}
                >
                  <Sparkles className="h-4 w-4" />
                  Go Premium — {PREMIUM_PRICE_LABEL}
                </Button>
                {billing.premiumAnnualConfigured && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => upgrade("premium", "year")}
                    className="border-brand"
                  >
                    {PREMIUM_ANNUAL_PRICE_LABEL} — {premiumAnnualFreeMonths()} months free
                  </Button>
                )}
              </>
            )}
          </div>
          {billing.topupPacks.length > 0 && (
            <div id="top-ups" className="flex scroll-mt-20 flex-wrap items-center gap-2">
              <span className="w-full text-xs font-semibold text-muted-foreground">
                Top-ups · credits never expire
              </span>
              {billing.topupPacks.map((pack) => (
                <Button
                  key={pack}
                  variant="outline"
                  disabled={busy}
                  onClick={() => upgrade("topup", "month", undefined, pack)}
                >
                  Add {topupLabel(pack)}
                </Button>
              ))}
            </div>
          )}
          {billing.teamConfigured && billing.teamSeats < TEAM_MIN_SEATS && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="flex items-center gap-1 rounded-xl border px-2 py-1">
                <button
                  type="button"
                  className="px-2 text-sm font-bold text-muted-foreground hover:text-foreground"
                  onClick={() => setSeats((n) => Math.max(TEAM_MIN_SEATS, n - 1))}
                  aria-label="Fewer seats"
                >
                  −
                </button>
                <span className="w-14 text-center text-sm font-semibold tabular-nums">
                  {seats} seats
                </span>
                <button
                  type="button"
                  className="px-2 text-sm font-bold text-muted-foreground hover:text-foreground"
                  onClick={() => setSeats((n) => Math.min(500, n + 1))}
                  aria-label="More seats"
                >
                  +
                </button>
              </div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => upgrade("team", "month", seats)}
              >
                {billing.hasSubscription ? "Switch to Teams" : "Get Teams"} — {TEAM_SEAT_PRICE_LABEL}
                /mo
              </Button>
              {billing.teamAnnualConfigured && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => upgrade("team", "year", seats)}
                >
                  {TEAM_SEAT_ANNUAL_PRICE_LABEL} — {teamAnnualFreeMonths()} months free
                </Button>
              )}
            </div>
          )}
          {billing.teamSeats >= TEAM_MIN_SEATS && (
            <p className="text-xs font-medium text-brand">
              Teams plan active: {billing.teamSeats} seats. Manage seats from Manage billing.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Free is for trying ContactKickstart: one card, {FREE_SHAREBACK_LIMIT} share-backs and
            QR-code scanning. Pro ({PRO_PRICE_LABEL}, or {PRO_ANNUAL_PRICE_LABEL} with{" "}
            {annualFreeMonths()} months free): {PRO_AI_BENEFIT} ({SCAN_UNIT_NOTE}.) Plus{" "}
            {PLAN_LIMITS.pro.enrich} contact enrichments a month, note summaries, unlimited
            share-backs, instant lead alerts, the Zapier webhook, event mode, and up to 3 cards.
            Premium ({PREMIUM_PRICE_LABEL}, or {PREMIUM_ANNUAL_PRICE_LABEL} with{" "}
            {premiumAnnualFreeMonths()} months free): everything in Pro, with{" "}
            {PREMIUM_AI_BENEFIT.replace(/\.$/, "")}, plus unlimited personal cards, email
            signatures, follow-up reminders, and advanced analytics. Teams ({TEAM_SEAT_PRICE_LABEL}
            /mo, {TEAM_MIN_SEATS}-seat minimum): a team workspace with everything in Premium for
            every member. Plans auto-renew; cancelling stops the renewal and your plan runs to the
            end of the period you've paid for. Every account keeps one live digital card (link + QR)
            free for life.
          </p>
          {!billing.stripeConfigured && (
            <p className="text-xs text-muted-foreground">
              Upgrades are not available yet (billing is still being set up).
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Opt in/out of a push notification when someone shares their details back. */
function PushToggle() {
  const { user } = useAuth();
  const [supported] = useState(
    () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window,
  );
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {});
  }, [supported]);

  async function toggle(on: boolean) {
    if (!user) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (on) {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          toast.error("Notifications are blocked for this site");
          return;
        }
        const { key } = await getVapidPublicKey();
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
        });
        const json = sub.toJSON();
        const { error } = await supabase.from("push_subscriptions").upsert(
          {
            user_id: user.id,
            endpoint: sub.endpoint,
            p256dh: json.keys?.["p256dh"] ?? "",
            auth: json.keys?.["auth"] ?? "",
          },
          { onConflict: "endpoint" },
        );
        if (error) throw error;
        setEnabled(true);
        toast.success("You'll get a notification when someone shares their details");
      } else {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          await sub.unsubscribe();
        }
        setEnabled(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update notifications");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Push notifications need the installed app (Add to Home Screen) on this device.
      </p>
    );
  }
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">New-lead notifications</p>
        <p className="text-xs text-muted-foreground">
          Get a push on this device when someone shares their details back.
        </p>
      </div>
      <Switch
        checked={enabled}
        disabled={busy}
        onCheckedChange={toggle}
        aria-label="New-lead notifications"
      />
    </div>
  );
}

/** Zapier-style outbound webhook: every new captured contact is POSTed to it. */
function WebhookField({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (url: string) => Promise<void>;
}) {
  const [url, setUrl] = useState(initial);
  useEffect(() => setUrl(initial), [initial]);
  const valid = !url.trim() || /^https:\/\/.+/i.test(url.trim());
  return (
    <div className="space-y-1">
      <Label htmlFor="webhook">Webhook URL (Zapier, Make, …)</Label>
      <p className="text-xs text-muted-foreground">
        New contacts are POSTed here as JSON — connect a Zap to add them to your CRM.
      </p>
      <div className="flex gap-2">
        <Input
          id="webhook"
          type="url"
          placeholder="https://hooks.zapier.com/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button
          variant="outline"
          disabled={!valid || url === initial}
          onClick={() => onSave(url.trim())}
        >
          Save
        </Button>
      </div>
      {!valid && <p className="text-xs text-destructive">Must be an https:// URL</p>}
    </div>
  );
}

function DangerZone({
  confirm,
  setConfirm,
  busy,
  deleteAccount,
}: {
  confirm: string;
  setConfirm: (v: string) => void;
  busy: boolean;
  deleteAccount: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <section className="rounded-xl border border-destructive/40 p-5">
        <h2 className="text-lg font-bold text-destructive">Delete account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently deletes your cards, contacts, notes, analytics, photos and login.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="mt-4">
              Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete everything?</AlertDialogTitle>
              <AlertDialogDescription>
                This can't be undone. Type DELETE to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              aria-label="Type DELETE to confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirm !== "DELETE" || busy}
                onClick={(e) => {
                  e.preventDefault();
                  deleteAccount();
                }}
              >
                {busy ? "Deleting…" : "Delete forever"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
