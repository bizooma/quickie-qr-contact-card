// How a visitor reached a card, and what they were on, for card analytics.
// Pure (tested). The QR code, share buttons and email signature add a small
// "?via=" tag to the card link; the card page reads it, logs it with the
// view, and drops it from the address bar so it isn't passed along.

export const VIA = ["qr", "nfc", "email", "link"] as const;
export type Via = (typeof VIA)[number];

export const OS = ["iphone", "ipad", "android", "mac", "windows", "linux", "other"] as const;
export type Os = (typeof OS)[number];

/** The card link with its "via" tag (keeps any query it already has). */
export function withVia(url: string, via: Via): string {
  return `${url}${url.includes("?") ? "&" : "?"}via=${via}`;
}

/** The tag in a query string ("?via=qr"), or null for anything else. */
export function parseVia(search: string): Via | null {
  const v = new URLSearchParams(search).get("via")?.trim().toLowerCase();
  return v && (VIA as readonly string[]).includes(v) ? (v as Via) : null;
}

/** The same query string without the tag ("" when nothing else is left). */
export function withoutVia(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("via");
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

/** The visitor's operating system from the user agent. iPads that report as
 *  a Mac are told apart by their touch screen. */
export function osFrom(userAgent: string, maxTouchPoints = 0): Os {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipod/.test(ua)) return "iphone";
  if (/ipad/.test(ua) || (/macintosh/.test(ua) && maxTouchPoints > 1)) return "ipad";
  if (/android/.test(ua)) return "android";
  if (/macintosh|mac os x/.test(ua)) return "mac";
  if (/windows/.test(ua)) return "windows";
  if (/linux|cros/.test(ua)) return "linux";
  return "other";
}

/** Labels for the Analytics page. "web" and "direct" come from the database:
 *  a view with a referring site, or with nothing to go on. */
export const SOURCE_LABELS: Record<string, string> = {
  qr: "QR code scan",
  nfc: "NFC tap",
  email: "Email signature",
  link: "Shared link",
  web: "From a website",
  direct: "Direct or older QR code",
};

export const OS_LABELS: Record<string, string> = {
  iphone: "iPhone",
  ipad: "iPad",
  android: "Android",
  mac: "Mac",
  windows: "Windows",
  linux: "Linux",
  other: "Other",
};
