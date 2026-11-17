import { appHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  WifiOff,
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
import { AppleWalletRow } from "@/components/wallet/AppleWalletButton";
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
      <div className="dark relative mx-auto max-w-xl overflow-hidden rounded-[2rem] bg-[#0B0D1C] p-10 text-center text-foreground">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-pop-lime text-[#0E1230]">
          <QrCode className="h-7 w-7" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-extrabold tracking-tight">
          Your code comes from your card.
        </h1>
        <p className="mt-2 text-sm text-white/60">Make your card first — it takes a minute.</p>
        <Link
          to="/app"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-pop-lime px-5 py-3 text-sm font-extrabold text-[#0E1230]"
        >
          Go to cards
        </Link>
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
      className="mx-auto w-full max-w-[340px] [&_svg]:h-auto [&_svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  ) : (
    <div className="mx-auto aspect-square w-full max-w-[340px] animate-pulse rounded-2xl bg-stone-100" />
  );

  const rowClass =
    "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/60 disabled:opacity-50";
  const chip =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand";

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to="/app"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Cards
      </Link>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* The stage: nothing but the code, big, on dark so it pops. */}
        <section className="dark relative overflow-hidden rounded-[2rem] bg-[#0B0D1C] px-6 pb-8 pt-6 text-foreground sm:px-10 sm:pb-10">
          <div className="qq-dots pointer-events-none absolute inset-0 opacity-[0.07]" />
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
            style={{ background: view.accent }}
          />
          <div className="relative mb-6 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-pop-lime px-3.5 py-1.5 text-xs font-extrabold text-[#0E1230]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#0E1230]" />
              Ready to scan
            </span>
          </div>

          <div
            className="relative mx-auto w-full max-w-md touch-pan-y select-none"
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
                className={`ck-shimmer w-full rounded-[1.75rem] bg-white p-6 text-center shadow-float ${slideClass}`}
                style={{ "--ck-shine": view.accent } as CSSProperties}
              >
                {code}
                <p className="mt-4 font-display text-2xl font-extrabold tracking-tight text-[#0E1230]">
                  {view.full_name}
                </p>
                <p
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: view.accent }}
                >
                  {view.label}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-[#5A6080]">
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
                  className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-2 text-[#0E1230] shadow-float transition-transform hover:scale-105"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next card"
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full bg-white p-2 text-[#0E1230] shadow-float transition-transform hover:scale-105"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {canSwipe && mine && (
            <div className="relative mt-5 flex flex-col items-center gap-2">
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
                      i === index ? "w-6 bg-pop-lime" : "w-2 bg-white/30 hover:bg-white/50"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-white/50">
                Swipe for your other cards · {index + 1} of {mine.length}
              </p>
            </div>
          )}

          <p className="relative mt-6 flex items-center justify-center gap-1.5 text-xs text-white/45">
            <WifiOff className="h-3.5 w-3.5" />
            Works even with no signal
          </p>
        </section>

        <aside className="space-y-5">
          <div className="surface rounded-3xl p-5">
            <h2 className="font-display text-lg font-extrabold">Share it</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Not in the room? Send the link instead.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={share}
                className="h-11 flex-1 rounded-full bg-brand font-bold text-white hover:bg-brand/90"
              >
                <Share2 className="h-4 w-4" />
                Share link
              </Button>
              <Button variant="outline" className="h-11 rounded-full px-5" onClick={copy}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>

          <div className="surface overflow-hidden rounded-3xl">
            <div className="px-5 pb-2 pt-5">
              <h2 className="font-display text-lg font-extrabold">Get here in one tap</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                The quicker your code is up, the quicker they're saved.
              </p>
            </div>
            <div className="divide-y">
              <AppleWalletRow card={fresh} rowClass={rowClass} chipClass={chip} />
              <label className={`${rowClass} cursor-pointer`}>
                <span className={chip}>
                  <QrCode className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Open the app on my QR</span>
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
                <button type="button" className={rowClass} onClick={() => void addToHomeScreen()}>
                  <span className={chip}>
                    <SquarePlus className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-semibold">{homeScreen.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              {myQrHref && (
                <a href={myQrHref} className={rowClass}>
                  <span className={chip}>
                    <QrCode className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-semibold">Add a My QR icon</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </a>
              )}
              <button
                type="button"
                className={rowClass}
                onClick={() => void saveWallpaper("lock")}
                disabled={!svg || !!savingWallpaper}
              >
                <span className={chip}>
                  <Smartphone className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Lock-screen wallpaper</span>
                  <span className="block text-xs text-muted-foreground">
                    Your code on the lock screen, no unlocking needed.
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                type="button"
                className={rowClass}
                onClick={() => void saveWallpaper("home")}
                disabled={!svg || !!savingWallpaper}
              >
                <span className={chip}>
                  <LayoutGrid className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm font-semibold">Home-screen wallpaper</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => openTip("qr")}
              className="flex w-full items-center justify-center gap-1.5 border-t bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              How to get to your QR code in one tap
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
