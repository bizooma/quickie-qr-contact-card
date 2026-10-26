// Quick access to the QR screen: an opt-in "open the app on my QR code"
// launch preference (per device) and the layout of the lock-screen
// wallpaper image. Pure pieces are unit-tested; storage is wrapped so a
// blocked localStorage just means "off".

export const OPEN_ON_QR_KEY = "ck-open-on-qr";
const LAUNCHED_KEY = "ck-launched";

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

// Lock-screen wallpaper: portrait, iPhone-sized (works on Android too). The
// code sits below the clock and above the flashlight/camera buttons.
export const WALLPAPER_W = 1170;
export const WALLPAPER_H = 2532;

export function wallpaperLayout(w = WALLPAPER_W, h = WALLPAPER_H) {
  const panel = Math.round(w * 0.72);
  const pad = Math.round(panel * 0.07);
  const x = Math.round((w - panel) / 2);
  const y = Math.round(h * 0.6 - panel / 2);
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
