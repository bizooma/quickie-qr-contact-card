// In-app "how this works" tips, one per screen. Pure data and helpers so
// the content and routing stay unit-testable; the dialog lives in
// src/components/FeatureTip.tsx.

export type Platform = "ios" | "android" | "desktop";

export type TipStep = {
  // Plain text; **double asterisks** mark bold words.
  text: string;
  // Only show on these platforms (default: all).
  only?: Platform[];
};

export type Tip = {
  title: string;
  intro: string;
  steps: TipStep[];
  // Steps differ a lot by phone, so the dialog offers iPhone/Android/Computer tabs.
  platformTabs?: boolean;
  // Help Center section with more detail.
  help?: string;
};

export const TIPS = {
  cards: {
    title: "Your cards",
    intro: "Each card is a digital business card with its own link and QR code.",
    steps: [
      {
        text: "Tap a card to edit it. Changes go live instantly — your link and QR code never change.",
      },
      {
        text: "Under each card, **QR** shows its code and **View** opens it the way others see it.",
      },
      {
        text: "**New card** adds another (Pro: up to 3, Premium: unlimited). Have a paper card? **Scan my business card** builds one from a photo.",
      },
      {
        text: "The orange QR button at the bottom right shows your code from anywhere in the app.",
        only: ["ios", "android"],
      },
    ],
    help: "getting-started",
  },
  editor: {
    title: "Editing your card",
    intro: "Everything you change here saves automatically and goes live right away.",
    steps: [
      { text: "**Details**: name, title, phone numbers, emails, your photo and company logo." },
      { text: "**Links**: your website, socials or booking page. Taps show up in Analytics." },
      { text: "**Style**: colors and layout. The preview shows exactly what people will see." },
      {
        text: "**Share**: your QR code and link. On Pro and Premium you can put your photo or logo in the middle of the QR code.",
      },
      {
        text: "Have a paper card? **Fill from my business card** fills everything in from a photo.",
      },
    ],
    help: "getting-started",
  },
  qr: {
    title: "Get to your QR code in one tap",
    intro:
      "Phone widgets need an app from the App Store or Play Store, but these get you just as close: one tap from your home screen, or your code right on your lock screen.",
    platformTabs: true,
    steps: [
      {
        text: "**Add the app to your Home Screen:** open contactkickstart.com in Safari, tap **Share**, then **Add to Home Screen**.",
        only: ["ios"],
      },
      {
        text: "**Install the app:** in Chrome, tap the **⋮** menu, then **Install app** (or **Add to Home screen**).",
        only: ["android"],
      },
      {
        text: "**Make the app open on your QR:** turn on **Open the app on my QR code** below. Tapping the app icon then shows your code straight away.",
        only: ["ios", "android"],
      },
      {
        text: "**Or add a My QR icon:** touch and hold the ContactKickstart icon, then drag **My QR code** onto your home screen.",
        only: ["android"],
      },
      {
        text: "**Put it on your lock screen:** tap **Save as wallpaper**, save the image to Photos, then open it and tap **Share → Use as Wallpaper**. Your code shows as soon as you lift your phone.",
        only: ["ios"],
      },
      {
        text: "**Put it on your lock screen:** tap **Save as wallpaper**, then open the image in Photos or Gallery and choose **Set as wallpaper → Lock screen**.",
        only: ["android"],
      },
      {
        text: "**Install the app:** click the install icon at the right of the address bar (Chrome or Edge). It then opens in its own window from your dock or Start menu.",
        only: ["desktop"],
      },
      {
        text: "**Keep a copy:** **Save as wallpaper** downloads a phone-sized image of your code, handy for slides or to send to your phone.",
        only: ["desktop"],
      },
      { text: "This screen works with no signal, so it's ready at events with bad Wi-Fi." },
    ],
    help: "quick-qr",
  },
  scan: {
    title: "Scanning business cards",
    intro: "Turn a stack of paper cards into contacts in seconds.",
    steps: [
      {
        text: "Take or upload photos of business cards — up to 12 photos at once, and a photo can hold several cards.",
      },
      {
        text: "Tap **Upload Contact**. AI reads names, titles, phones, emails, addresses and photos; QR codes on cards (vCard, LinkedIn) are read too.",
      },
      { text: "Check what was read, untick anything you don't want, then tap **Save**." },
      { text: "Free plan: 5 AI scans a month. Pro and Premium: unlimited." },
    ],
    help: "capturing",
  },
  contacts: {
    title: "Your contacts",
    intro:
      "Everyone who shares their details from your card lands here, along with people you scan or add.",
    steps: [
      { text: "New share-backs show a badge on **Contacts** until you've looked." },
      {
        text: "Tap a contact for notes (typed or voice), tags, an AI follow-up email draft, and **Enrich with AI**.",
      },
      {
        text: "**Start event mode** before a conference or expo: everyone you meet is tagged with the event (Pro and Premium).",
      },
      {
        text: "On a contact, **Remind me to follow up** sends a phone notification when it's time (Premium). Due follow-ups show at the top here.",
      },
      { text: "Filter by card, tag or event. Premium can export everything as CSV." },
    ],
    help: "capturing",
  },
  analytics: {
    title: "Analytics",
    intro: "See how your cards are doing.",
    steps: [
      { text: "Views, saves and unique visitors for each card, plus devices and top referrers." },
      { text: "**Most-tapped links** shows which of your links people actually open." },
      { text: "Use the card filter to compare one card against another." },
    ],
  },
  tools: {
    title: "Tools",
    intro: "Extras that put your card to work in more places.",
    steps: [
      {
        text: "**Email signature** (Premium): a signature built from your card for Gmail, Outlook or Apple Mail.",
      },
      { text: "**Virtual background**: a Zoom, Meet or Teams background with your QR code on it." },
    ],
  },
  background: {
    title: "Virtual backgrounds",
    intro: "Make a video-call background people can scan to save your contact.",
    steps: [
      { text: "Pick a background: a preset, any color, a gradient, or your own photo." },
      {
        text: "**Company logo** adds your card's logo in one tap. Add your own text or pictures too.",
      },
      {
        text: "Drag anything on the preview to move it. Tap a layer to resize, recolor, hide or delete it.",
      },
      { text: "Your design saves automatically and will be here next time." },
      {
        text: "**Download PNG**, then add it in Zoom (Settings → Background & effects → **+**), Google Meet (**Apply visual effects** → **Add**) or Teams (**Video effects** → **Add new**).",
      },
      { text: "**Download for Canva** to keep editing in Canva: Create a design → Import file." },
    ],
  },
  signature: {
    title: "Email signature",
    intro: "A professional signature built from your card, with a link back to it.",
    steps: [
      { text: "Pick the card, check the preview, and copy the signature." },
      { text: "Follow the steps under **Add it to your email** for Gmail, Outlook or Apple Mail." },
    ],
  },
  team: {
    title: "Your team",
    intro: "Give everyone on your team a matching card and one place for contacts.",
    steps: [
      {
        text: "Create your team, then share **Invite links** — each link works once and expires in 14 days.",
      },
      { text: "**Lock brand on team cards** keeps everyone's colors and logo on-brand." },
      { text: "Turn on the **Shared contact pool** so the whole team sees every lead." },
      { text: "**Team analytics** shows views, saves and share-backs across all team cards." },
    ],
    help: "teams",
  },
  settings: {
    title: "Settings",
    intro: "Your plan, notifications and app preferences.",
    steps: [
      {
        text: "**Plan & usage** shows this month's AI usage and lets you upgrade or manage billing.",
      },
      {
        text: "**New-lead notifications** ping your phone the moment someone shares their details.",
      },
      { text: "Send new contacts to Make, Zapier or your CRM with a webhook URL." },
      { text: "**Show tips again** brings back every tip you've turned off." },
    ],
    help: "notifications",
  },
} satisfies Record<string, Tip>;

export type TipId = keyof typeof TIPS;
export const TIP_IDS = Object.keys(TIPS) as TipId[];

/** Which tip belongs to an /app screen, if any. */
export function tipIdForPath(pathname: string): TipId | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/app") return "cards";
  if (/^\/app\/cards\/[^/]+$/.test(p)) return "editor";
  const exact: Record<string, TipId> = {
    "/app/qr": "qr",
    "/app/scan": "scan",
    "/app/contacts": "contacts",
    "/app/analytics": "analytics",
    "/app/tools": "tools",
    "/app/tools/background": "background",
    "/app/tools/signature": "signature",
    "/app/org": "team",
    "/app/settings": "settings",
  };
  return exact[p] ?? null;
}

export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  // iPadOS reports as a Mac; real Macs have no touch points.
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/android/i.test(userAgent)) return "android";
  return "desktop";
}

export function stepsFor(tip: Tip, platform: Platform): TipStep[] {
  return tip.steps.filter((s) => !s.only || s.only.includes(platform));
}

/** Splits "**bold** text" into parts for rendering. */
export function boldParts(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**")
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false },
    );
}

/** Union of dismissed tip ids, keeping only ones that still exist. */
export function mergeDismissed(...lists: (readonly string[] | null | undefined)[]): TipId[] {
  const known = new Set<string>(TIP_IDS);
  const out = new Set<TipId>();
  for (const list of lists) for (const id of list ?? []) if (known.has(id)) out.add(id as TipId);
  return [...out];
}
