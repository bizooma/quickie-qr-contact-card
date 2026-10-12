import { appHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listCards } from "@/lib/cards-api";
import { publicCardUrl, useQr } from "@/components/card/QrPanel";

// The fastest path to "scan me": launches straight from the app-icon
// shortcut, renders from a localStorage snapshot before any network round
// trip, and — because the QR is generated on-device and the service worker
// serves the shell — keeps working with no signal at all.

type QrSnapshot = {
  slug: string;
  label: string;
  full_name: string;
  accent: string;
  bg: string;
};

const QR_CACHE_KEY = "ck-qr-card";

export const Route = createFileRoute("/app/qr")({ head: appHead('QR code', "Show your card's QR code full screen."), component: QuickQr });

function readSnapshot(): QrSnapshot | null {
  try {
    const raw = localStorage.getItem(QR_CACHE_KEY);
    return raw ? (JSON.parse(raw) as QrSnapshot) : null;
  } catch {
    return null;
  }
}

function QuickQr() {
  const [snap, setSnap] = useState<QrSnapshot | null>(() => readSnapshot());
  const [chosen, setChosen] = useState<string | null>(null);
  const { data: cards } = useQuery({ queryKey: ["cards"], queryFn: listCards });

  const fresh = cards?.find((c) => c.slug === (chosen ?? snap?.slug)) ?? cards?.[0];
  const view: QrSnapshot | null = fresh
    ? {
        slug: fresh.slug,
        label: fresh.label,
        full_name: fresh.full_name,
        accent: fresh.accent_color,
        bg: fresh.background_color,
      }
    : snap;

  // Whatever we last showed becomes the instant snapshot for next launch.
  useEffect(() => {
    if (!fresh) return;
    const next: QrSnapshot = {
      slug: fresh.slug,
      label: fresh.label,
      full_name: fresh.full_name,
      accent: fresh.accent_color,
      bg: fresh.background_color,
    };
    setSnap(next);
    try {
      localStorage.setItem(QR_CACHE_KEY, JSON.stringify(next));
    } catch {
      // Snapshot is a convenience only.
    }
  }, [fresh]);

  const { svg } = useQr(view?.slug ?? "", view?.accent ?? "#111111", view?.bg ?? "#FFFFFF");
  const url = view ? publicCardUrl(view.slug) : "";

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: view?.full_name || "My card", url });
        return;
      }
      throw new Error("no share");
    } catch {
      await navigator.clipboard.writeText(url).catch(() => undefined);
      toast.success("Link copied");
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(url).catch(() => undefined);
    toast.success("Link copied");
  }

  if (!view) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-sm text-muted-foreground">
          Create a card first — your QR code comes from it.{" "}
          <Link to="/app" className="underline">
            Go to cards
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center">
      <Link
        to="/app"
        className="mb-4 inline-flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Cards
      </Link>

      <div className="w-full rounded-3xl bg-white p-6 text-center shadow-float">
        {svg ? (
          <div
            className="mx-auto w-full max-w-[320px] [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="mx-auto aspect-square w-full max-w-[320px] animate-pulse rounded-2xl bg-stone-100" />
        )}
        <p className="mt-4 font-display text-xl font-bold text-stone-900">{view.full_name}</p>
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: view.accent }}
        >
          {view.label}
        </p>
        <p className="mt-1 break-all text-xs text-stone-400">{url.replace(/^https?:\/\//, "")}</p>
      </div>

      {cards && cards.length > 1 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {cards.map((c) => (
            <button
              key={c.id}
              onClick={() => setChosen(c.slug)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                c.slug === view.slug
                  ? "border-brand bg-brand-soft text-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <Button onClick={share}>
          <Share2 className="h-4 w-4" />
          Share link
        </Button>
        <Button variant="outline" onClick={copy}>
          <Copy className="h-4 w-4" />
          Copy
        </Button>
      </div>

      <p className="mt-6 max-w-xs text-center text-xs text-muted-foreground">
        Tip: with the app installed, long-press the ContactKickstart icon and tap “My QR code” to
        land here in one step. This screen works even with no signal.
      </p>
    </div>
  );
}
