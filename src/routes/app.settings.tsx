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
import { KIND_LABELS, PRO_PRICE_LABEL, USAGE_KINDS } from "@/lib/plans";
import { InstallInstructions } from "@/components/InstallPrompt";

export const Route = createFileRoute("/app/settings")({ component: Settings });

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
  const { data: billing } = useQuery({ queryKey: ["billing"], queryFn: () => getBillingState() });

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

  async function upgrade() {
    setBusy(true);
    try {
      const { url } = await createCheckout();
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

  if (!billing) return null;
  const pro = billing.plan === "pro";
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold">Plan & usage</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pro ? "bg-brand text-white" : "bg-muted text-muted-foreground"}`}
        >
          {pro ? "Pro" : "Free"}
        </span>
      </div>
      <div className="surface space-y-3 p-4">
        {USAGE_KINDS.map((k) => {
          const u = billing.usage[k];
          const pct = u.limit ? Math.min(100, Math.round((u.used / u.limit) * 100)) : 0;
          return (
            <div key={k}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{KIND_LABELS[k]}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {u.limit === null ? `${u.used} · unlimited` : `${u.used} / ${u.limit} this month`}
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
      {pro ? (
        <Button variant="outline" disabled={busy || !billing.stripeConfigured} onClick={manage}>
          Manage billing
        </Button>
      ) : (
        <div className="space-y-2">
          <Button disabled={busy || !billing.stripeConfigured} onClick={upgrade}>
            <Sparkles className="h-4 w-4" />
            Upgrade to Pro — {PRO_PRICE_LABEL}
          </Button>
          <p className="text-xs text-muted-foreground">
            Pro: unlimited AI scans, enrichment, follow-ups and summaries, plus up to 50 cards.
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
