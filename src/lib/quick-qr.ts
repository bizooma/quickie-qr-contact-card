// Quick access to the QR screen: an opt-in "open the app on my QR code"
// launch preference (per device), the separate "My QR" home-screen app, and
// the layout of the wallpaper images. Pure pieces are unit-tested; storage is
// wrapped so a blocked localStorage just means "off".

import type { QrCenterImage } from "@/components/card/QrPanel";

export const OPEN_ON_QR_KEY = "ck-open-on-qr";
const LAUNCHED_KEY = "ck-launched";

/** The last code the QR screen showed. Cached so the code renders before any
 *  network round trip, and read by the My QR app, which shares this storage
 *  with the main app on Android. */
export type QrSnapshot = {
  slug: string;
  label: string;
  full_name: string;
  accent: string;
  bg: string;
  // Inline (data URL) so the photo/logo center still shows with no signal.
  center?: QrCenterImage | null;
};

export const QR_CACHE_KEY = "ck-qr-card";

export function readSnapshot(): QrSnapshot | null {
  try {
    const raw = localStorage.getItem(QR_CACHE_KEY);
    return raw ? (JSON.parse(raw) as QrSnapshot) : null;
  } catch {
    return null;
  }
}

/** The My QR app: its own manifest and scope, so it installs as a second
 *  home-screen icon that opens straight to the code. */
export const MY_QR_PATH = "/my-qr";

export function getOpenOnQr(): boolean {
  try {
    return localStorage.getItem(OPEN_ON_QR_KEY) === "1";
  } catch {
    return false;
  }
}

export function setOpenOnQr(on: boolean) {
  try {
    if (on) localStorage.setItem(OPEN_ON_QR_KEY, "1");
    else localStorage.removeItem(OPEN_ON_QR_KEY);
  } catch {
    // Preference just doesn't stick on this device.
  }
}

/** True once per app launch (session), so later visits to /app aren't hijacked. */
export function consumeLaunch(): boolean {
  try {
    if (sessionStorage.getItem(LAUNCHED_KEY)) return false;
    sessionStorage.setItem(LAUNCHED_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** Whether a fresh launch of the installed app should jump to the QR screen. */
export function shouldOpenOnQr(opts: {
  enabled: boolean;
  standalone: boolean;
  pathname: string;
  firstLoad: boolean;
}): boolean {
  // The installed app starts at /app (manifest start_url); only redirect that.
  return opts.enabled && opts.standalone && opts.firstLoad && /^\/app\/?$/.test(opts.pathname);
}

export type HomeScreenAction = { kind: "install" | "tip"; label: string };

/** The QR screen's button for installing the app itself. A web app can't
 *  place an icon on its own: where the browser offers install we trigger it;
 *  otherwise the button opens the steps. Nothing to add once installed. */
export function homeScreenAction(opts: {
  platform: "ios" | "android" | "desktop";
  standalone: boolean;
  canPrompt: boolean;
}): HomeScreenAction | null {
  const { platform, standalone, canPrompt } = opts;
  if (standalone) return null;
  const label = platform === "desktop" ? "Install app" : "Add to home screen";
  if (canPrompt) return { kind: "install", label };
  return platform === "desktop" ? null : { kind: "tip", label };
}

export const MY_QR_PIN_KEY = "ck-my-qr-card";

/** The card the My QR app shows: the one it was installed for (?card= on the
 *  install page, then remembered), else the main app's last code. The main
 *  app's snapshot wins when it is the same card, since it is the freshest;
 *  a card with no snapshot here still gets a plain, scannable code. */
export function myQrSnapshot(
  card: string | undefined,
  pinned: QrSnapshot | null,
  latest: QrSnapshot | null,
): QrSnapshot | null {
  const slug = card ?? pinned?.slug ?? latest?.slug;
  if (!slug) return null;
  if (latest?.slug === slug) return latest;
  if (pinned?.slug === slug) return pinned;
  return { slug, label: "", full_name: "", accent: "#111111", bg: "#FFFFFF" };
}

/** Where the "Add a My QR icon" button goes, or null where it can't work.
 *  Android only: Chrome installs the My QR app from its page. Inside the
 *  installed app that page would open in the app's own window, where Chrome
 *  offers no install, so it opens in Chrome itself. */
export function myQrIconHref(opts: {
  platform: "ios" | "android" | "desktop";
  standalone: boolean;
  slug: string;
  host: string;
}): string | null {
  if (opts.platform !== "android") return null;
  const path = `${MY_QR_PATH}?card=${encodeURIComponent(opts.slug)}`;
  if (!opts.standalone) return path;
  return `intent://${opts.host}${path}#Intent;scheme=https;package=com.android.chrome;end`;
}

// Wallpapers: portrait, iPhone-sized (works on Android too). On the lock
// screen the code sits below the clock and above the flashlight/camera
// buttons; on the home screen it sits higher and smaller, in a band the
// owner keeps free of app icons.
export const WALLPAPER_W = 1170;
export const WALLPAPER_H = 2532;
export type WallpaperKind = "lock" | "home";

export function wallpaperLayout(w = WALLPAPER_W, h = WALLPAPER_H, kind: WallpaperKind = "lock") {
  const panel = Math.round(w * (kind === "home" ? 0.56 : 0.72));
  const pad = Math.round(panel * 0.07);
  const x = Math.round((w - panel) / 2);
  const y = Math.round(h * (kind === "home" ? 0.33 : 0.6) - panel / 2);
  return {
    panel: { x, y, size: panel, radius: Math.round(panel * 0.08) },
    qr: { x: x + pad, y: y + pad, size: panel - pad * 2 },
    caption: { x: w / 2, y: y + panel + Math.round(h * 0.03), size: Math.round(w * 0.05) },
  };
}

/** A horizontal swipe on the QR: +1 = next card (finger moved left), -1 =
 *  previous, 0 = too short or mostly vertical (a scroll, not a swipe). */
export function swipeStep(dx: number, dy: number, threshold = 40): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

/** Index after moving `step` through `length` cards, wrapping at both ends. */
export function cycleIndex(index: number, step: number, length: number): number {
  if (length <= 0) return 0;
  return (((index + step) % length) + length) % length;
}
