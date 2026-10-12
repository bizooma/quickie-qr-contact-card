import { appHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Lightbulb, Share2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { openTip } from "@/components/FeatureTip";
import { listCards } from "@/lib/cards-api";
import {
  publicCardUrl,
  useCenterImage,
  useQr,
  type QrCenterImage,
} from "@/components/card/QrPanel";
import { usePlan } from "@/components/PremiumGate";
import { parseQrCenter, qrCenterSource } from "@/lib/qr-logo";
import {
  getOpenOnQr,
  setOpenOnQr,
  WALLPAPER_H,
  WALLPAPER_W,
  wallpaperLayout,
} from "@/lib/quick-qr";

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
  // Inline (data URL) so the photo/logo center still shows with no signal.
  center?: QrCenterImage | null;
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

/** A portrait lock-screen image of the code: the card's colors, a framed QR
 *  and "Scan to save my contact". No name or photo — just the code. */
async function wallpaperBlob(svg: string, accent: string, bg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not draw the QR code"));
      img.src = url;
    });
    const c = document.createElement("canvas");
    c.width = WALLPAPER_W;
    c.height = WALLPAPER_H;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    const { panel, qr, caption } = wallpaperLayout();
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, WALLPAPER_W, WALLPAPER_H);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(panel.x, panel.y, panel.size, panel.size, panel.radius);
    ctx.fill();
    ctx.drawImage(img, qr.x, qr.y, qr.size, qr.size);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `600 ${caption.size}px Helvetica, Arial, sans-serif`;
    ctx.fillText("Scan to save my contact", caption.x, caption.y, WALLPAPER_W * 0.9);
    return await new Promise<Blob>((resolve, reject) =>
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function QuickQr() {
  const [snap, setSnap] = useState<QrSnapshot | null>(() => readSnapshot());
  const [chosen, setChosen] = useState<string | null>(null);
  const { data: cards } = useQuery({ queryKey: ["cards"], queryFn: listCards });

  const { plan } = usePlan();
  const fresh = cards?.find((c) => c.slug === (chosen ?? snap?.slug)) ?? cards?.[0];
  const source = fresh
    ? qrCenterSource(
        parseQrCenter(fresh.qr_center),
        { headshotPath: fresh.headshot_path, logoPath: fresh.logo_path },
        plan,
      )
    : null;
  const centerImg = useCenterImage(source);
  // Settled once the plan is known and the center image has loaded; until
  // then (or offline) keep showing the snapshot's center for the same card.
  const centerSettled = !!fresh && plan !== undefined && centerImg.ready;
  const freshCenter: QrCenterImage | null = centerImg.image;
  const snapCenter = snap && fresh && snap.slug === fresh.slug ? (snap.center ?? null) : null;

  const view: QrSnapshot | null = fresh
    ? {
        slug: fresh.slug,
        label: fresh.label,
        full_name: fresh.full_name,
        accent: fresh.accent_color,
        bg: fresh.background_color,
        center: centerSettled ? freshCenter : snapCenter,
      }
    : snap;

  // Whatever we last showed becomes the instant snapshot for next launch.
  const snapshotKey = view ? JSON.stringify(view) : "";
  useEffect(() => {
    if (!fresh || !centerSettled || !snapshotKey) return;
    const next = JSON.parse(snapshotKey) as QrSnapshot;
    setSnap(next);
    try {
      localStorage.setItem(QR_CACHE_KEY, JSON.stringify(next));
    } catch {
      // Snapshot is a convenience only.
    }
  }, [fresh, centerSettled, snapshotKey]);

  const { svg } = useQr(
    view?.slug ?? "",
    view?.accent ?? "#111111",
    view?.bg ?? "#FFFFFF",
    view?.center ?? null,
  );
  const url = view ? publicCardUrl(view.slug) : "";
  const [openOnQr, setOpenOnQrState] = useState(getOpenOnQr);
  const [savingWallpaper, setSavingWallpaper] = useState(false);

  async function saveWallpaper() {
    if (!svg || !view) return;
    setSavingWallpaper(true);
    try {
      const blob = await wallpaperBlob(svg, view.accent, view.bg);
      const file = new File([blob], `${view.slug}-qr-wallpaper.png`, { type: "image/png" });
      // Phones: the share sheet has "Save Image" (Photos). Elsewhere: download.
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    } catch {
      toast.error("Could not make the wallpaper");
    } finally {
      setSavingWallpaper(false);
    }
  }

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

      <div className="mt-8 w-full space-y-3">
        <label className="surface flex items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Open the app on my QR code</span>
            <span className="block text-xs text-muted-foreground">
              Tapping the app icon on this device shows your code straight away.
            </span>
          </span>
          <Switch
            checked={openOnQr}
            onCheckedChange={(on) => {
              setOpenOnQr(on);
              setOpenOnQrState(on);
              toast.success(
                on ? "The app will open on your QR code" : "The app will open on Cards",
              );
            }}
          />
        </label>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void saveWallpaper()}
          disabled={!svg || savingWallpaper}
        >
          <Smartphone className="h-4 w-4" />
          Save as wallpaper
        </Button>
        <button
          type="button"
          onClick={() => openTip("qr")}
          className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground underline hover:text-foreground"
        >
          <Lightbulb className="h-3.5 w-3.5" />
          How to get to your QR code in one tap
        </button>
        <p className="text-center text-xs text-muted-foreground">
          This screen works even with no signal.
        </p>
      </div>
    </div>
  );
}
