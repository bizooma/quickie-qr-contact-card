import { appHead } from "@/lib/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, ChevronRight, LogOut, Sparkles } from "lucide-react";
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
  annualFreeMonths,
  creditEligible,
  KIND_LABELS,
  PLAN_NAMES,
  PREMIUM_ANNUAL_PRICE_LABEL,
  PREMIUM_PRICE_LABEL,
  premiumAnnualFreeMonths,
  PRO_ANNUAL_PRICE_LABEL,
  PRO_PRICE_LABEL,
  TEAM_MIN_SEATS,
  TEAM_SEAT_ANNUAL_PRICE_LABEL,
  TEAM_SEAT_PRICE_LABEL,
  teamAnnualFreeMonths,
  USAGE_KINDS,
} from "@/lib/plans";
import { InstallInstructions } from "@/components/InstallPrompt";

export const Route = createFileRoute("/app/settings")({ head: appHead('Settings', 'Manage your profile, cards and account.'), component: Settings });

function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const del = useServerFn(deleteMyAccount);
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
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div className="space-y-1">
          <Label>Display name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <ThemePicker />
        <Button onClick={saveProfile}>Save</Button>
      </section>
      <PlanSection />
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
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Install the app</h2>
        <InstallInstructions />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-bold">Notifications & integrations</h2>
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
    plan: "pro" | "premium" | "team",
    interval: "month" | "year" = "month",
    seats?: number,
  ) {
    setBusy(true);
    try {
      const { url } = await createCheckout({
        data: { plan, interval, ...(seats ? { seats } : {}) },
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
    <section className="space-y-3">
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
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{KIND_LABELS[k]}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {u.limit === null ? `${u.used} · unlimited` : `${u.used} / ${u.limit} this month`}
                  {u.limit !== null && bonus > 0 && ` · +${bonus} bonus credits`}
                </span>
              </div>
              {u.limit !== null && (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${pct >= 100 ? "bg-destructive" : "bg-brand"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {billing.plan === "premium" ? (
        <Button variant="outline" disabled={busy || !billing.stripeConfigured} onClick={manage}>
          Manage billing
        </Button>
      ) : (
        <div className="space-y-2">
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
          {billing.teamConfigured && !billing.hasSubscription && (
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
                Get Teams — {TEAM_SEAT_PRICE_LABEL}/mo
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
            Pro ({PRO_PRICE_LABEL}, or {PRO_ANNUAL_PRICE_LABEL} with {annualFreeMonths()} months
            free): unlimited AI scans, enrichment, follow-ups and summaries, plus up to 3 cards.
            Premium ({PREMIUM_PRICE_LABEL}, or {PREMIUM_ANNUAL_PRICE_LABEL} with{" "}
            {premiumAnnualFreeMonths()} months free): everything in Pro, plus unlimited personal
            cards, email signatures, and advanced analytics with CSV export. Teams (
            {TEAM_SEAT_PRICE_LABEL}/mo, {TEAM_MIN_SEATS}-seat minimum): a team workspace with
            everything in Premium for every member. Plans auto-renew; cancelling stops the renewal
            and your plan runs to the end of the period you've paid for.
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
