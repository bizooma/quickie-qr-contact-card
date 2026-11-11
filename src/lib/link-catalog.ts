// The platforms a card link can be. One list drives three things: guessing
// the platform from a pasted address, the editor's picker, and how the
// Liquid Glass layout lays a link out. Pure and client-safe.

/** "social" links read as an icon, so they become compact tiles; "link"
 *  needs its words, so it gets a wide tile with the address underneath. */
export type LinkKind = "social" | "link";

export const LINK_GROUPS = [
  "General",
  "Social",
  "Messaging",
  "Video and audio",
  "Work",
  "Booking and payments",
  "Reviews and shops",
] as const;
export type LinkGroup = (typeof LINK_GROUPS)[number];

export type LinkPlatform = {
  id: string;
  label: string;
  group: LinkGroup;
  kind: LinkKind;
  /** Hostname endings that identify it, e.g. "youtu.be". */
  hosts?: readonly string[];
};

// Order matters twice: it is the order of the picker, and the first matching
// host wins when guessing.
export const LINK_PLATFORMS = [
  { id: "link", label: "Link", group: "General", kind: "link" },
  { id: "website", label: "Website", group: "General", kind: "link" },
  { id: "email", label: "Email", group: "General", kind: "link" },
  { id: "phone", label: "Phone", group: "General", kind: "link" },

  {
    id: "linkedin",
    label: "LinkedIn",
    group: "Social",
    kind: "social",
    hosts: ["linkedin.com", "lnkd.in"],
  },
  { id: "x", label: "X", group: "Social", kind: "social", hosts: ["x.com", "twitter.com"] },
  {
    id: "instagram",
    label: "Instagram",
    group: "Social",
    kind: "social",
    hosts: ["instagram.com", "instagr.am"],
  },
  {
    id: "facebook",
    label: "Facebook",
    group: "Social",
    kind: "social",
    hosts: ["facebook.com", "fb.com", "fb.me"],
  },
  { id: "tiktok", label: "TikTok", group: "Social", kind: "social", hosts: ["tiktok.com"] },
  {
    id: "threads",
    label: "Threads",
    group: "Social",
    kind: "social",
    hosts: ["threads.net", "threads.com"],
  },
  {
    id: "bluesky",
    label: "Bluesky",
    group: "Social",
    kind: "social",
    hosts: ["bsky.app", "bsky.social"],
  },
  {
    id: "mastodon",
    label: "Mastodon",
    group: "Social",
    kind: "social",
    hosts: ["mastodon.social", "mastodon.online", "mstdn.social"],
  },
  {
    id: "pinterest",
    label: "Pinterest",
    group: "Social",
    kind: "social",
    hosts: ["pinterest.com", "pin.it"],
  },
  { id: "snapchat", label: "Snapchat", group: "Social", kind: "social", hosts: ["snapchat.com"] },
  { id: "reddit", label: "Reddit", group: "Social", kind: "social", hosts: ["reddit.com"] },

  {
    id: "whatsapp",
    label: "WhatsApp",
    group: "Messaging",
    kind: "social",
    hosts: ["wa.me", "whatsapp.com"],
  },
  {
    id: "telegram",
    label: "Telegram",
    group: "Messaging",
    kind: "social",
    hosts: ["t.me", "telegram.me", "telegram.org"],
  },
  {
    id: "messenger",
    label: "Messenger",
    group: "Messaging",
    kind: "social",
    hosts: ["m.me", "messenger.com"],
  },
  {
    id: "signal",
    label: "Signal",
    group: "Messaging",
    kind: "social",
    hosts: ["signal.me", "signal.group"],
  },
  {
    id: "discord",
    label: "Discord",
    group: "Messaging",
    kind: "social",
    hosts: ["discord.gg", "discord.com"],
  },
  { id: "slack", label: "Slack", group: "Messaging", kind: "social", hosts: ["slack.com"] },
  { id: "line", label: "LINE", group: "Messaging", kind: "social", hosts: ["line.me"] },
  { id: "message", label: "Message", group: "Messaging", kind: "social" },

  {
    id: "youtube",
    label: "YouTube",
    group: "Video and audio",
    kind: "social",
    hosts: ["youtube.com", "youtu.be"],
  },
  { id: "twitch", label: "Twitch", group: "Video and audio", kind: "social", hosts: ["twitch.tv"] },
  { id: "vimeo", label: "Vimeo", group: "Video and audio", kind: "social", hosts: ["vimeo.com"] },
  {
    id: "spotify",
    label: "Spotify",
    group: "Video and audio",
    kind: "social",
    hosts: ["spotify.com", "spotify.link"],
  },
  {
    id: "podcast",
    label: "Podcast",
    group: "Video and audio",
    kind: "social",
    hosts: ["podcasts.apple.com", "pca.st", "overcast.fm"],
  },
  {
    id: "soundcloud",
    label: "SoundCloud",
    group: "Video and audio",
    kind: "social",
    hosts: ["soundcloud.com"],
  },

  { id: "github", label: "GitHub", group: "Work", kind: "social", hosts: ["github.com"] },
  { id: "gitlab", label: "GitLab", group: "Work", kind: "social", hosts: ["gitlab.com"] },
  { id: "behance", label: "Behance", group: "Work", kind: "social", hosts: ["behance.net"] },
  { id: "dribbble", label: "Dribbble", group: "Work", kind: "social", hosts: ["dribbble.com"] },
  { id: "medium", label: "Medium", group: "Work", kind: "social", hosts: ["medium.com"] },
  { id: "substack", label: "Substack", group: "Work", kind: "social", hosts: ["substack.com"] },

  {
    id: "calendar",
    label: "Booking",
    group: "Booking and payments",
    kind: "link",
    hosts: [
      "calendly.com",
      "cal.com",
      "savvycal.com",
      "tidycal.com",
      "zcal.co",
      "acuityscheduling.com",
      "koalendar.com",
      "meetings.hubspot.com",
      "calendar.app.google",
    ],
  },
  {
    id: "videocall",
    label: "Video call",
    group: "Booking and payments",
    kind: "link",
    hosts: ["zoom.us", "meet.google.com", "teams.microsoft.com"],
  },
  {
    id: "payment",
    label: "Payment",
    group: "Booking and payments",
    kind: "link",
    hosts: ["paypal.com", "paypal.me", "venmo.com", "cash.app", "stripe.com", "wise.com"],
  },
  {
    id: "support",
    label: "Support me",
    group: "Booking and payments",
    kind: "link",
    hosts: ["patreon.com", "ko-fi.com", "buymeacoffee.com"],
  },

  {
    id: "reviews",
    label: "Reviews",
    group: "Reviews and shops",
    kind: "link",
    hosts: [
      "g.page",
      "maps.app.goo.gl",
      "yelp.com",
      "trustpilot.com",
      "tripadvisor.com",
      "g2.com",
      "capterra.com",
    ],
  },
  {
    id: "shop",
    label: "Shop",
    group: "Reviews and shops",
    kind: "link",
    hosts: [
      "etsy.com",
      "myshopify.com",
      "shopify.com",
      "gumroad.com",
      "amazon.com",
      "ebay.com",
      "square.site",
    ],
  },
] as const satisfies readonly LinkPlatform[];

export type LinkIconId = (typeof LINK_PLATFORMS)[number]["id"];

const BY_ID = new Map<string, LinkPlatform>(LINK_PLATFORMS.map((p) => [p.id, p]));

export function linkPlatform(icon: string): LinkPlatform {
  return BY_ID.get(icon) ?? LINK_PLATFORMS[0];
}

export function linkKind(icon: string): LinkKind {
  return linkPlatform(icon).kind;
}

export function linkLabel(icon: string): string {
  return linkPlatform(icon).label;
}

/** Tidies a web address as people actually type it. A phone keyboard adds a
 *  space after a full stop and capitalises the next word ("Cal Farley. Org"),
 *  and a sentence-ending dot gets left on the end. A host can hold neither,
 *  and a browser shows the space as "%20" and opens nothing. The host loses
 *  its spaces and trailing dots; a space later in the address becomes "%20".
 *  Email, phone and text links come back untouched. */
export function tidyWebAddress(url: string): string {
  const t = url.trim();
  if (!t || /^(mailto|tel|sms):/i.test(t)) return t;
  const m = /^(https?:\/\/)?([^/?#]*)([\s\S]*)$/i.exec(t);
  if (!m) return t;
  const scheme = (m[1] ?? "").toLowerCase();
  const host = (m[2] ?? "").replace(/\s+/g, "").replace(/\.+$/, "");
  const rest = (m[3] ?? "").trim().replace(/\s/g, "%20");
  return scheme + host + rest;
}

/** A bare email address, as people type it without "mailto:". No spaces, one
 *  "@", a dotted domain — and no "://" or path characters, so a web address
 *  that merely carries an address in its query is not misread. */
export function isBareEmail(value: string): boolean {
  const t = value.trim();
  if (/[:/?#]/.test(t)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t);
}

/** A phone number typed without "tel:": an optional "+", then only digits and
 *  the separators keyboards offer, with at least 7 digits. Letters, a space
 *  before a dot or a colon rule it out, so a name or a web address is never
 *  read as a number. */
export function isBarePhone(value: string): boolean {
  const t = value.trim();
  if (!/^\+?[\d\s.()-]+$/.test(t)) return false;
  return (t.match(/\d/g) ?? []).length >= 7;
}

/** The digits part of a phone number: the spaces, dots, dashes and brackets
 *  people type are dropped, so "tel:" gets what a dialer expects. */
export function phoneDigits(value: string): string {
  return value.trim().replace(/[\s().-]/g, "");
}

/** A web address for showing on a card: tidied, without "https://" or a
 *  bare trailing slash, in the capitals its owner typed. */
export function displayUrl(url: string): string {
  return tidyWebAddress(url)
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

/** The host of a pasted address, lower-cased and without "www.". Accepts an
 *  address typed without "https://". Empty for anything that is not a web
 *  address. */
function hostOf(url: string): string {
  const t = tidyWebAddress(url).toLowerCase();
  if (!t || /^(mailto|tel|sms):/.test(t)) return "";
  try {
    return new URL(/^https?:\/\//.test(t) ? t : `https://${t}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Guess the platform from an address so pasting a link "just works". Matches
 *  on the host, so a booking link that merely mentions another site in its
 *  path is not misread. */
export function guessPlatform(url: string): LinkIconId {
  const t = url.trim().toLowerCase();
  if (t.startsWith("mailto:")) return "email";
  if (t.startsWith("tel:")) return "phone";
  if (isBareEmail(t)) return "email";
  if (isBarePhone(t)) return "phone";
  const host = hostOf(t);
  if (!host) return "link";
  for (const p of LINK_PLATFORMS) {
    if ("hosts" in p && p.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return p.id;
  }
  return "link";
}

/** A short, human form of an address for the line under a link's label:
 *  "cal.com" for a web address, the address or number for email and phone. */
export function linkHost(url: string): string {
  const t = url.trim();
  const scheme = /^(mailto|tel):(.*)$/i.exec(t);
  if (scheme) return (scheme[2] ?? "").split("?")[0] ?? "";
  // A bare address or number is shown whole: its domain alone ("acme.com")
  // would leave the owner's address or number half-hidden on the card.
  if (isBareEmail(t) || isBarePhone(t)) return t;
  return hostOf(t);
}
