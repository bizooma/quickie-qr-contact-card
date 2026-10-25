// Meta pixel for the marketing site and the app — the same pixel as the
// Pinball funnel, so ad audiences and conversions line up in one account.
// Never loaded on public cards (/c/…): their visitors are our customers'
// contacts, not our prospects.

export const META_PIXEL_ID = "1668595114664637";

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
  if (!import.meta.env.PROD || typeof window === "undefined" || window.fbq) return;
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
