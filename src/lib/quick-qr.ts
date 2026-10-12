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
