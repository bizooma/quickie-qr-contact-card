import { appHead } from "@/lib/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Copy,
  Eye,
  ExternalLink,
  Lock,
  Maximize2,
  Plus,
  QrCode,
  Reply,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { publicCardUrl, QrPanel, useQr } from "@/components/card/QrPanel";
import { supabase } from "@/integrations/supabase/client";
import { ScanMyCard } from "@/components/card/ScanMyCard";
import { useAuth } from "@/hooks/use-auth";
import { createCard, createCardFromScan, listCards, type CardRow } from "@/lib/cards-api";
import { initials, lockedCardIds } from "@/lib/card-model";
import type { ScannedCardFields } from "@/lib/own-card";
import { signedUrls } from "@/lib/media";
import { getBillingState } from "@/lib/billing.functions";
import { PLAN_LIMITS, PLAN_NAMES } from "@/lib/plans";
import { liveLinkProps } from "@/hooks/use-pwa-install";

/** Phones and tablets: an autofocused field would open the keyboard at once. */
function coarsePointer() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

export const Route = createFileRoute("/app/")({
  head: appHead("My cards", "All your digital business cards in one place."),
  component: CardsPage,
});

function CardsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const {
    data: cards,
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ["cards"], queryFn: listCards });
  const { data: billing } = useQuery({ queryKey: ["billing"], queryFn: () => getBillingState() });
  const cardLimit = billing ? PLAN_LIMITS[billing.plan].cards : Infinity;
  const atLimit = !!cards && cards.length >= cardLimit;
  const locked = useMemo(
    () =>
      cards && billing && user ? lockedCardIds(cards, user.id, billing.plan) : new Set<string>(),
    [cards, billing, user],
  );
  const [qrCard, setQrCard] = useState<CardRow | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);

  // Signed URLs for each card's headshot and logo (private bucket).
  const mediaPaths = useMemo(
    () =>
      (cards ?? []).flatMap((c) => [c.headshot_path, c.logo_path]).filter((p): p is string => !!p),
    [cards],
  );
  const { data: mediaUrls = {} } = useQuery({
    queryKey: ["card-tile-media", mediaPaths],
    enabled: mediaPaths.length > 0,
    queryFn: () => signedUrls(mediaPaths),
  });

  useEffect(() => {
    if (!cards || cards.length !== 0 || !billing) return;
    // Someone who bought the starter pack came for the scanner, not a card
    // (only 1 in 4 accounts had ever scanned). First visit goes there.
    const key = user ? `ck-welcomed:${user.id}` : null;
    let welcomed = false;
    try {
      welcomed = !!key && localStorage.getItem(key) === "1";
      if (key) localStorage.setItem(key, "1");
    } catch {
      // Storage blocked: fall through to onboarding.
    }
    if (!welcomed && billing.credits.scan > 0 && billing.usage.scan.used === 0) {
      navigate({ to: "/app/scan", search: { welcome: 1 } });
    } else {
      navigate({ to: "/app/onboarding" });
    }
  }, [cards, billing, user, navigate]);

  async function addCardFromScan(fields: ScannedCardFields) {
    if (!user) return;
    try {
      const c = await createCardFromScan(user.id, label.trim() || "Work", fields);
      await qc.invalidateQueries({ queryKey: ["cards"] });
      toast.success("Card created from your business card — review the details");
      navigate({ to: "/app/cards/$id", params: { id: c.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create card");
    }
  }

  async function addCard(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !label.trim() || creating) return;
    setCreating(true);
    try {
      const first = cards?.[0];
      const c = await createCard(user.id, {
        label: label.trim(),
        full_name: first?.full_name ?? "",
        job_title: first?.job_title ?? undefined,
      });
      await qc.invalidateQueries({ queryKey: ["cards"] });
      navigate({ to: "/app/cards/$id", params: { id: c.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create card");
    } finally {
      setCreating(false);
    }
  }

  const primary = cards?.find((c) => !locked.has(c.id)) ?? cards?.[0];

  return (
    <div>
      {primary && <QrHero card={primary} />}

      <div className="mb-6 mt-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Your cards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap a card to edit. Changes go live instantly.
          </p>
        </div>
        {billing && cardLimit !== Infinity && (
          <p className="text-xs text-muted-foreground">
            {cards?.length ?? 0} of {cardLimit} card{cardLimit === 1 ? "" : "s"} on{" "}
            {PLAN_NAMES[billing.plan]}
            {atLimit && (
              <>
                {" · "}
                <Link to="/app/settings" hash="plan" className="font-semibold text-brand underline">
                  Upgrade for more
                </Link>
              </>
            )}
          </p>
        )}
      </div>
      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-3xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="surface p-10 text-center" role="alert">
          <p className="font-semibold">Couldn't load your cards</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your cards are safe and still live — check your connection and try again.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards?.map((c) => (
            <div
              key={c.id}
              className="group overflow-hidden rounded-3xl border bg-surface shadow-soft transition-all hover:-translate-y-1 hover:shadow-float"
            >
              <Link to="/app/cards/$id" params={{ id: c.id }} className="block">
                <div
                  className="relative h-24 overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${c.accent_color}, color-mix(in oklch, ${c.accent_color} 55%, #0E1230))`,
                  }}
                >
                  <div className="qq-dots absolute inset-0 opacity-20" />
                  {c.logo_path && mediaUrls[c.logo_path] && (
                    <img
                      src={mediaUrls[c.logo_path]}
                      alt=""
                      className="absolute right-3 top-3 h-9 max-w-[96px] rounded-md object-contain"
                    />
                  )}
                  <span className="absolute left-4 top-3 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur">
                    {c.label}
                  </span>
                </div>
                <div className="relative z-10 -mt-9 px-5 pb-5">
                  {c.headshot_path && mediaUrls[c.headshot_path] ? (
                    <img
                      src={mediaUrls[c.headshot_path]}
                      alt={c.full_name || c.label}
                      className="h-[72px] w-[72px] rounded-full border-4 border-surface object-cover shadow-soft"
                    />
                  ) : (
                    <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-surface bg-[color-mix(in_oklch,var(--brand)_12%,var(--surface))] font-display text-lg font-extrabold text-brand shadow-soft">
                      {initials(c.full_name || c.label)}
                    </div>
                  )}
                  <p className="mt-3 font-display text-xl font-extrabold tracking-tight">
                    {c.full_name || "Untitled"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[c.job_title, c.company].filter(Boolean).join(" · ") || "Add your details"}
                  </p>
                  {locked.has(c.id) && (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      Locked · upgrade to edit
                    </p>
                  )}
                </div>
              </Link>
              <div className="flex gap-2 px-4 pb-4">
                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand/90"
                  onClick={() => setQrCard(c)}
                >
                  <QrCode className="h-4 w-4" />
                  Share QR
                </button>
                <a
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-muted py-2.5 text-sm font-semibold transition-colors hover:bg-muted/70"
                  href={`/c/${c.slug}`}
                  {...liveLinkProps()}
                >
                  <ExternalLink className="h-4 w-4" />
                  View
                </a>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            disabled={atLimit}
            className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-brand hover:bg-brand-soft disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-soft">
              <Plus className="h-6 w-6" />
            </span>
            <span className="font-display text-lg font-extrabold">New card</span>
            <span className="max-w-[16rem] text-sm text-muted-foreground">
              Side business, personal, a second firm — or snap your paper card and we'll build it.
            </span>
          </button>
        </div>
      )}
      <Dialog open={!!qrCard} onOpenChange={(o) => !o && setQrCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share {qrCard?.label}</DialogTitle>
          </DialogHeader>
          {qrCard && (
            <QrPanel
              cardId={qrCard.id}
              slug={qrCard.slug}
              accent={qrCard.accent_color}
              bg={qrCard.background_color}
              name={qrCard.full_name}
              headshotPath={qrCard.headshot_path}
              logoPath={qrCard.logo_path}
              qrCenter={qrCard.qr_center}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New card</DialogTitle>
          </DialogHeader>
          {/* Scan first: on a phone the keyboard and the Create button used
              to push it out of sight. No autofocus on touch screens, so the
              keyboard only opens when they choose to type a name. */}
          <div className="space-y-2 text-center">
            <ScanMyCard className="w-full" onScanned={addCardFromScan} />
            <p className="text-xs text-muted-foreground">
              Build it from your paper business card — logo, colors, photo and all.
            </p>
          </div>
          <form onSubmit={addCard} className="space-y-3 border-t pt-4">
            <p className="text-center text-xs text-muted-foreground">Or start with a blank card</p>
            <Input
              autoFocus={!coarsePointer()}
              aria-label="Card label"
              placeholder="e.g. Side business, Personal"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={40}
            />
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={!label.trim() || creating}
            >
              Create card
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const sinceIso30 = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 29);
  return d.toISOString();
};

/** Top of the dashboard: the code people came here to show, plus how it's
 *  doing. Dark ink panel to match the landing hero. */
function QrHero({ card }: { card: CardRow }) {
  const { svg } = useQr(card.slug, "#0E1230", "#FFFFFF");
  const url = publicCardUrl(card.slug);
  const first = (card.full_name || "").trim().split(/\s+/)[0];
  const { data: totals } = useQuery({
    queryKey: ["events-home-30"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("card_event_series", { p_since: sinceIso30() });
      if (error) throw error;
      return (data as unknown as { totals: { view: number; save: number; shareback: number } })
        .totals;
    },
  });
  const stats = [
    { label: "Views", value: totals?.view, icon: Eye },
    { label: "Saves", value: totals?.save, icon: UserPlus },
    { label: "Share-backs", value: totals?.shareback, icon: Reply },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Card link copied");
    } catch {
      toast.error("Couldn't copy — long-press the link instead");
    }
  }

  return (
    <section className="dark relative overflow-hidden rounded-[2rem] bg-[#0B0D1C] p-6 text-foreground sm:p-8 md:p-10">
      <div className="qq-dots pointer-events-none absolute inset-0 opacity-[0.07]" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/40 blur-3xl" />
      <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto] md:gap-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-pop-lime">
            {first ? `Hey ${first}` : "Hey there"} — you're live
          </p>
          <h2 className="mt-3 font-display text-[1.7rem] font-extrabold leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
            Hold it up.
            <br />
            <span className="text-white/45">They're saved in seconds.</span>
          </h2>
          <p className="mt-4 max-w-md truncate font-mono text-sm text-white/55">
            {url.replace(/^https?:\/\//, "")}
          </p>
          <div className="mt-6 flex gap-2 sm:gap-3">
            <Link
              to="/app/qr"
              className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-pop-lime px-4 py-3 text-sm font-extrabold sm:flex-none sm:px-5 text-[#0E1230] transition-transform hover:-translate-y-0.5"
            >
              <Maximize2 className="h-4 w-4" />
              Full-screen QR
            </Link>
            <button
              type="button"
              onClick={copy}
              className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white/10 px-4 py-3 text-sm font-bold sm:flex-none sm:px-5 text-white transition-colors hover:bg-white/15"
            >
              <Copy className="h-4 w-4" />
              Copy link
            </button>
          </div>
          <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Last 30 days
          </p>
          <div className="mt-2 grid max-w-lg grid-cols-3 gap-2 sm:gap-3">
            {stats.map((s) => (
              <Link
                key={s.label}
                to="/app/analytics"
                className="rounded-2xl bg-white/[0.06] p-3 transition-colors hover:bg-white/10 sm:p-4"
              >
                <s.icon className="h-4 w-4 text-white/45" />
                <p className="mt-2 font-display text-2xl font-extrabold tabular-nums sm:text-3xl">
                  {s.value ?? "–"}
                </p>
                <p className="text-[11px] font-medium text-white/50">{s.label}</p>
              </Link>
            ))}
          </div>
        </div>
        <Link
          to="/app/qr"
          aria-label="Open full-screen QR code"
          className="group relative order-first mx-auto block w-full max-w-[200px] rotate-[3deg] md:order-none md:max-w-[260px] rounded-[1.75rem] bg-white p-4 shadow-float transition-transform hover:rotate-0 md:w-[260px]"
        >
          <div
            className="aspect-square w-full [&>svg]:h-full [&>svg]:w-full"
            // SVG generated locally by the qrcode library from our own URL.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-[#0E1230]">
            {card.label}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </p>
        </Link>
      </div>
    </section>
  );
}
