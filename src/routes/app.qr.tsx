import { appHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  LayoutGrid,
  Lightbulb,
  QrCode,
  Share2,
  Smartphone,
  SquarePlus,
} from "lucide-react";
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
import { GlassMesh } from "@/components/card/GlassMesh";
import { usePlan } from "@/components/PremiumGate";
import { useAuth } from "@/hooks/use-auth";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { detectPlatform } from "@/lib/feature-tips";
import { resolveTheme } from "@/lib/card-theme";
import { PLAN_LIMITS } from "@/lib/plans";
import { parseQrCenter, qrCenterSource } from "@/lib/qr-logo";
import {
  cycleIndex,
  getOpenOnQr,
  homeScreenAction,
  myQrIconHref,
  QR_CACHE_KEY,
  readSnapshot,
  type QrSnapshot,
  type WallpaperKind,
  setOpenOnQr,
  swipeStep,
  WALLPAPER_H,
  WALLPAPER_W,
  wallpaperLayout,
} from "@/lib/quick-qr";

// The fastest path to "scan me": launches straight from the app-icon
// shortcut, renders from a localStorage snapshot before any network round
// trip, and — because the QR is generated on-device and the service worker
// serves the shell — keeps working with no signal at all.

export const Route = createFileRoute("/app/qr")({
  head: appHead("QR code", "Show your card's QR code full screen."),
  // ?card=<slug> opens on that card (the owner's "Show my QR code" on a live card).
  validateSearch: (s: Record<string, unknown>) =>
    typeof s["card"] === "string" ? { card: s["card"] } : {},
  component: QuickQr,
});

/** A portrait wallpaper of the code for the lock or home screen: the card's
 *  colors, a framed QR and "Scan to save my contact". No name or photo. */
async function wallpaperBlob(
  svg: string,
  accent: string,
  bg: string,
  kind: WallpaperKind,
): Promise<Blob> {
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
    const { panel, qr, caption } = wallpaperLayout(WALLPAPER_W, WALLPAPER_H, kind);
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
  const { card: wanted } = Route.useSearch();
  const [chosen, setChosen] = useState<string | null>(wanted ?? null);
  const { data: cards } = useQuery({ queryKey: ["cards"], queryFn: listCards });
  const { user } = useAuth();

  const { plan } = usePlan();
  // Only the person's own cards: team members can also read teammates' cards.
  const mine = cards?.filter((c) => c.user_id === user?.id);
  // Swiping between cards is for plans with more than one card. A free
  // account (e.g. after a downgrade) shows its first card, the one it edits.
  const canSwipe = !!plan && PLAN_LIMITS[plan].cards > 1 && (mine?.length ?? 0) > 1;
  const fresh =
    plan === "free"
      ? mine?.[0]
      : (mine?.find((c) => c.slug === (chosen ?? snap?.slug)) ?? mine?.[0]);
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
        template: fresh.template,
        font: fresh.font,
        theme: fresh.theme,
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
  // The QR screen follows the card's look: glass cards get their lights.
  const glass =
    view?.template === "glass"
      ? resolveTheme({ accent_color: view.accent, font: view.font ?? "sans", theme: view.theme })
      : null;
  const [openOnQr, setOpenOnQrState] = useState(getOpenOnQr);
  const [slideFrom, setSlideFrom] = useState<"left" | "right" | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const index =
    mine && view
      ? Math.max(
          0,
          mine.findIndex((c) => c.slug === view.slug),
        )
      : 0;

  function step(delta: number) {
    if (!canSwipe || !mine) return;
    const next = mine[cycleIndex(index, delta, mine.length)];
    if (!next) return;
    setSlideFrom(delta > 0 ? "right" : "left");
    setChosen(next.slug);
  }
  const [savingWallpaper, setSavingWallpaper] = useState<WallpaperKind | null>(null);
  const { canPrompt, promptInstall, standalone } = usePwaInstall();
  const [platform] = useState(() => detectPlatform(navigator.userAgent, navigator.maxTouchPoints));
  const homeScreen = homeScreenAction({ platform, standalone, canPrompt });
  const myQrHref = view
    ? myQrIconHref({ platform, standalone, slug: view.slug, host: window.location.host })
    : null;

  async function addToHomeScreen() {
    if (homeScreen?.kind !== "install") return openTip("qr");
    const outcome = await promptInstall();
    if (outcome === "unavailable") return openTip("qr");
    if (outcome !== "accepted") return;
    if (platform === "desktop") {
      toast.success("Installed. Open it from your dock or Start menu");
      return;
    }
    // They installed from the QR screen, so the new icon should open on the code.
    setOpenOnQr(true);
    setOpenOnQrState(true);
    toast.success("Added. Tap the QuickieQR icon on your home screen to show this code");
  }

  async function saveWallpaper(kind: WallpaperKind) {
    if (!svg || !view) return;
    setSavingWallpaper(kind);
    try {
      const blob = await wallpaperBlob(svg, view.accent, view.bg, kind);
      const file = new File([blob], `${view.slug}-qr-${kind}-wallpaper.png`, {
        type: "image/png",
      });
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
      setSavingWallpaper(null);
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

  const slideClass =
    slideFrom === "right"
      ? "animate-in fade-in slide-in-from-right-8 duration-200"
      : slideFrom === "left"
        ? "animate-in fade-in slide-in-from-left-8 duration-200"
        : "";
  const code = svg ? (
    <div
      className="mx-auto w-full max-w-[320px] [&_svg]:h-auto [&_svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  ) : (
    <div className="mx-auto aspect-square w-full max-w-[320px] animate-pulse rounded-2xl bg-stone-100" />
  );

  return (
    <div className="mx-auto flex max-w-md flex-col items-center">
      <Link
        to="/app"
        className="mb-4 inline-flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Cards
      </Link>

      <div
        className="relative w-full touch-pan-y select-none"
        onTouchStart={(e) => {
          const t = e.touches[0];
          touch.current = t ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const start = touch.current;
          const t = e.changedTouches[0];
          touch.current = null;
          if (start && t) step(swipeStep(t.clientX - start.x, t.clientY - start.y));
        }}
      >
        {glass ? (
          // Glass cards: the card's own lights behind a frosted panel.
          <div className="ck-glass-card ck-qr-stage" style={glass.vars as CSSProperties}>
            <GlassMesh />
            <div
              key={view.slug}
              className={`ck-shimmer rounded-3xl ${slideClass}`}
              style={{ "--ck-shine": glass.accent } as CSSProperties}
            >
              <div className="ck-glass ck-qr-panel">
                <div className="rounded-2xl bg-white p-3">{code}</div>
                <p
                  className="mt-3 text-xl font-bold"
                  style={{ fontFamily: "var(--ck-font-heading)" }}
                >
                  {view.full_name}
                </p>
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--ck-muted)" }}
                >
                  {view.label}
                </p>
                <p className="mt-1 break-all text-xs" style={{ color: "var(--ck-muted)" }}>
                  {url.replace(/^https?:\/\//, "")}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            key={view.slug}
            className={`ck-shimmer w-full rounded-3xl bg-white p-6 text-center shadow-float ${slideClass}`}
            style={{ "--ck-shine": view.accent } as CSSProperties}
          >
            {code}
            <p className="mt-4 font-display text-xl font-bold text-stone-900">{view.full_name}</p>
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: view.accent }}
            >
              {view.label}
            </p>
            <p className="mt-1 break-all text-xs text-stone-400">
              {url.replace(/^https?:\/\//, "")}
            </p>
          </div>
        )}
        {canSwipe && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous card"
              className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background p-2 shadow-soft transition-colors hover:bg-muted"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next card"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full bg-background p-2 shadow-soft transition-colors hover:bg-muted"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {canSwipe && mine && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2" role="tablist" aria-label="Your cards">
            {mine.map((c, i) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={c.label}
                onClick={() => step(i - index)}
                className={`h-2 rounded-full transition-all ${
                  i === index
                    ? "w-6 bg-brand"
                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Swipe for your other cards · {index + 1} of {mine.length}
          </p>
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
        {homeScreen && (
          <Button variant="outline" className="w-full" onClick={() => void addToHomeScreen()}>
            <SquarePlus className="h-4 w-4" />
            {homeScreen.label}
          </Button>
        )}
        {myQrHref && (
          <Button asChild variant="outline" className="w-full">
            <a href={myQrHref}>
              <QrCode className="h-4 w-4" />
              Add a My QR icon
            </a>
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void saveWallpaper("lock")}
          disabled={!svg || !!savingWallpaper}
        >
          <Smartphone className="h-4 w-4" />
          Lock-screen wallpaper
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void saveWallpaper("home")}
          disabled={!svg || !!savingWallpaper}
        >
          <LayoutGrid className="h-4 w-4" />
          Home-screen wallpaper
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
