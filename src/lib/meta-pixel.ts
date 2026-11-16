// Meta pixel for the marketing site and the app. Off until a pixel ID is set
// here (pixel IDs are public, so it can live in code). Never loaded on public
// cards (/c/…): their visitors are our customers' contacts, not our prospects.

export const META_PIXEL_ID = "";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: unknown;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export function initMetaPixel(pathname: string): void {
  if (!META_PIXEL_ID || !import.meta.env.PROD || typeof window === "undefined" || window.fbq)
    return;
  if (pathname.startsWith("/c/")) return;
  // Meta's bootstrap, minus the IIFE: queue calls until fbevents.js loads.
  const fbq: Fbq = (...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue?.push(args);
  };
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.push = fbq;
  window.fbq = fbq;
  window._fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  fbq("init", META_PIXEL_ID);
  fbq("track", "PageView");
}

/** Standard event (CompleteRegistration, …). A no-op when the pixel isn't loaded. */
export function trackMeta(event: string, params?: Record<string, unknown>): void {
  try {
    window.fbq?.("track", event, params);
  } catch {
    // analytics must never break the page
  }
}
