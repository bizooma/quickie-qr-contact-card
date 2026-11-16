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
  // One-time "what's new" note: no checkbox, closing it dismisses it for good.
  announcement?: boolean;
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
        text: "**Add the app to your Home Screen:** open quickieqr.com in Safari, tap **Share**, then **Add to Home Screen**.",
        only: ["ios"],
      },
      {
        text: "**Install the app:** tap **Add to home screen** below. If it isn't offered, open quickieqr.com in Chrome, tap the **⋮** menu, then **Install app** (or **Add to Home screen**).",
        only: ["android"],
      },
      {
        text: "**Make the app open on your QR:** turn on **Open the app on my QR code** below. Tapping the app icon then shows your code straight away.",
        only: ["ios", "android"],
      },
      {
        text: "**Or add a My QR icon:** touch and hold the QuickieQR icon on your home screen, then drag **My QR code** to an empty spot. Or tap **Add a My QR icon** below and tap **Install My QR**. Either way you get a separate icon that opens straight to your code, even with no signal.",
        only: ["android"],
      },
      {
        text: "**Put it on your lock screen:** tap **Lock-screen wallpaper**, save the image to Photos, then open it and tap **Share → Use as Wallpaper**. Your code shows as soon as you lift your phone. **Home-screen wallpaper** puts it higher up, behind your apps; keep that spot free of icons.",
        only: ["ios"],
      },
      {
        text: "**Put it on your lock screen or home screen:** tap **Lock-screen wallpaper** or **Home-screen wallpaper**, then open the image in Photos or Gallery and choose **Set as wallpaper**. On the home screen, keep the spot behind the code free of icons.",
        only: ["android"],
      },
      {
        text: "**Install the app:** click **Install app** below, or the install icon at the right of the address bar (Chrome or Edge). It then opens in its own window from your dock or Start menu.",
        only: ["desktop"],
      },
      {
        text: "**Keep a copy:** **Lock-screen wallpaper** downloads a phone-sized image of your code, handy for slides or to send to your phone.",
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
        text: "Tap **Read cards**. The scanner reads names, titles, phones, emails, addresses and photos; QR codes on cards (vCard, LinkedIn) are read too.",
      },
      { text: "Check what was read, untick anything you don't want, then tap **Save**." },
      {
        text: "**1 card = 1 scan** — a photo with three cards uses three. Pro: 100 a month, resetting on the 1st. On the free plan, scans come from starter-pack or top-up credits, which also kick in once a paid month's scans are used. What's left shows under the button.",
      },
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
        text: "Tap a contact for notes (typed or voice), tags, a follow-up email draft, and **Enrich contact**.",
      },
      {
        text: "**Start event mode** before a conference or expo: everyone you meet is tagged with the event (Pro and Premium).",
      },
      {
        text: "On a contact, **Remind me to follow up** sends a phone notification when it's time (Premium). Due follow-ups show at the top here.",
      },
      {
        text: "Filter by card, tag or event. **CSV** downloads the list as a spreadsheet for any CRM, on every plan.",
      },
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
        text: "**Plan & usage** shows this month's usage and lets you upgrade or manage billing.",
      },
      {
        text: "**New-lead notifications** ping your phone the moment someone shares their details.",
      },
      { text: "Send new contacts to Make, Zapier or your CRM with a webhook URL." },
      { text: "**Show tips again** brings back every tip you've turned off." },
    ],
    help: "notifications",
  },
  contact: {
    title: "A contact",
    intro: "Everything about one person, and the tools to follow up.",
    steps: [
      {
        text: "**Email**, call or **Save to phone** puts them straight into your phone's contacts.",
      },
      {
        text: "**Remind me to follow up** pings your phone when it's time — Tomorrow, In 3 days, Next week, or any date (Premium).",
      },
      {
        text: "**Draft follow-up email** writes the email for you; open it in your mail app or copy it.",
      },
      { text: "**Enrich contact** fills in a title, company or LinkedIn from public info." },
      {
        text: "Add **tags** and **notes** (typed or by voice). “Met at” shows the event you met them at.",
      },
    ],
    help: "capturing",
  },
  "new-events-reminders": {
    title: "New: event mode & follow-up reminders",
    intro: "Two new ways to turn the people you meet into follow-ups.",
    announcement: true,
    steps: [
      {
        text: "**Event mode** (Pro and Premium): tap **Start event mode** before a conference or expo. Everyone you meet there is tagged with the event, so afterwards you have one list.",
      },
      {
        text: "**Follow-up reminders** (Premium): on any contact, tap **Remind me to follow up** and pick a day. Your phone gets a notification when it's time.",
      },
      {
        text: "From an event's list, **Remind me to follow up with all** sets a reminder for everyone you met there.",
      },
    ],
    help: "capturing",
  },
} satisfies Record<string, Tip>;

export type TipId = keyof typeof TIPS;
export const TIP_IDS = Object.keys(TIPS) as TipId[];

/** Which tip belongs to an /app screen, if any. */
export function tipIdForPath(pathname: string): TipId | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/app") return "cards";
  if (/^\/app\/cards\/[^/]+$/.test(p)) return "editor";
  if (/^\/app\/contacts\/[^/]+$/.test(p)) return "contact";
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

// "What's new" notes, keyed to the screen tip they extend. They only show to
// people who had already turned that tip off (everyone else gets the updated
// tip itself), and turning the tip off now also covers them.
export const ANNOUNCEMENTS: Partial<Record<TipId, TipId>> = {
  contacts: "new-events-reminders",
};

/** The tip a screen should open by itself, given what's been turned off. */
export function autoTipFor(pathname: string, dismissed: readonly string[]): TipId | null {
  const tip = tipIdForPath(pathname);
  if (!tip) return null;
  if (!dismissed.includes(tip)) return tip;
  const news = ANNOUNCEMENTS[tip];
  return news && !dismissed.includes(news) ? news : null;
}

/** Dismissing a screen tip also dismisses its announcement (same content). */
export function withAnnouncements(ids: readonly TipId[]): TipId[] {
  const out = new Set(ids);
  for (const id of ids) {
    const news = ANNOUNCEMENTS[id];
    if (news) out.add(news);
  }
  return [...out];
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
