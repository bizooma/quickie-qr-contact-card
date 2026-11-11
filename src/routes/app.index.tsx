import { appHead } from "@/lib/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Lock, Plus, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrPanel } from "@/components/card/QrPanel";
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

export const Route = createFileRoute("/app/")({ head: appHead('My cards', 'All your digital business cards in one place.'), component: CardsPage });

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

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your cards</h1>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
            {"Tap a card to edit.\nChanges go live instantly."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={() => setNewOpen(true)} disabled={atLimit}>
            <Plus className="h-4 w-4" />
            New card
          </Button>
          {billing && cardLimit !== Infinity && (
            <p className="text-xs text-muted-foreground">
              {cards?.length ?? 0} of {cardLimit} card{cardLimit === 1 ? "" : "s"} on{" "}
              {PLAN_NAMES[billing.plan]}
              {atLimit && (
                <>
                  {" · "}
                  <Link to="/app/settings" className="font-medium text-brand underline">
                    Upgrade for more
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards?.map((c) => (
            <div key={c.id} className="surface overflow-hidden">
              <Link to="/app/cards/$id" params={{ id: c.id }} className="block">
                <div className="relative h-20" style={{ background: c.accent_color }}>
                  {c.logo_path && mediaUrls[c.logo_path] && (
                    <img
                      src={mediaUrls[c.logo_path]}
                      alt=""
                      className="absolute right-3 top-3 h-9 max-w-[96px] rounded-md object-contain"
                    />
                  )}
                </div>
                <div className="relative z-10 -mt-8 px-5 pb-4">
                  {c.headshot_path && mediaUrls[c.headshot_path] ? (
                    <img
                      src={mediaUrls[c.headshot_path]}
                      alt={c.full_name || c.label}
                      className="h-16 w-16 rounded-full border-4 border-card object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-card bg-muted font-semibold">
                      {initials(c.full_name || c.label)}
                    </div>
                  )}
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand">
                    {c.label}
                    {locked.has(c.id) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 normal-case tracking-normal text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        Locked · upgrade to edit
                      </span>
                    )}
                  </p>
                  <p className="font-display text-lg font-bold">{c.full_name || "Untitled"}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[c.job_title, c.company].filter(Boolean).join(" · ") || "Add your details"}
                  </p>
                </div>
              </Link>
              <div className="flex border-t">
                <button
                  className="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium hover:bg-muted"
                  onClick={() => setQrCard(c)}
                >
                  <QrCode className="h-4 w-4" />
                  QR
                </button>
                <a
                  className="flex flex-1 items-center justify-center gap-2 border-l py-3 text-sm font-medium hover:bg-muted"
                  href={`/c/${c.slug}`}
                  {...liveLinkProps()}
                >
                  <ExternalLink className="h-4 w-4" />
                  View
                </a>
              </div>
            </div>
          ))}
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
