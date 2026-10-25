// What's coming to the app, shown under Settings → Profile → Roadmap & requests.
// Only near-term, attainable work goes here: people vote on these, so every
// item should be something we expect to ship. Keys are stored with votes
// (roadmap_votes.item_key) — never rename a key, retire it instead.

export type RoadmapStage = "next" | "planned";

export type RoadmapItem = {
  key: string;
  title: string;
  desc: string;
  stage: RoadmapStage;
  /** Plans it will be part of, when not every plan. */
  plans?: string;
};

export const ROADMAP_STAGES: Record<RoadmapStage, string> = {
  next: "Up next",
  planned: "Planned",
};

export const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    key: "referral-discount",
    title: "Referral discount",
    desc: "Friends you refer get a percentage off their monthly or annual Pro or Premium subscription. (You already earn 5 bonus AI scans for every friend who signs up from your card.)",
    stage: "next",
  },
  {
    key: "contact-import",
    title: "Import your contacts",
    desc: "Bring contacts in from a CSV file, a vCard or Google Contacts, with duplicates merged automatically.",
    stage: "next",
  },
  {
    key: "calendar-reminders",
    title: "Follow-up reminders in your calendar",
    desc: "Add any follow-up reminder to Google, Apple or Outlook Calendar in one tap.",
    stage: "next",
    plans: "Premium",
  },
  {
    key: "bulk-actions",
    title: "Bulk actions and smarter search",
    desc: "Tag, export or delete many contacts at once, and search inside notes and tags too.",
    stage: "planned",
  },
  {
    key: "weekly-summary",
    title: "Weekly summary email",
    desc: "Every Monday: views, saves, new leads, and who's due a follow-up.",
    stage: "planned",
  },
  {
    key: "custom-questions",
    title: "Custom questions on your “Share yours” form",
    desc: "Ask people what they're looking for, their budget, or anything else when they share their details.",
    stage: "planned",
  },
  {
    key: "wallet-pass",
    title: "Apple Wallet & Google Wallet card",
    desc: "Your QR code in your phone's Wallet, a double-press away from the lock screen.",
    stage: "planned",
    plans: "Pro & Premium",
  },
  {
    key: "offline-scan",
    title: "Scan with no signal",
    desc: "Photograph cards at a busy venue with no reception; they're read as soon as you're back online.",
    stage: "planned",
  },
];

/** Items of one stage, most-wanted first (ties keep the listed order). */
export function itemsForStage(
  stage: RoadmapStage,
  votes: Record<string, number> = {},
): RoadmapItem[] {
  return ROADMAP_ITEMS.map((item, i) => ({ item, i }))
    .filter(({ item }) => item.stage === stage)
    .sort((a, b) => (votes[b.item.key] ?? 0) - (votes[a.item.key] ?? 0) || a.i - b.i)
    .map(({ item }) => item);
}

// ---- Feature requests --------------------------------------------------------

export const REQUEST_MIN = 10;
export const REQUEST_MAX = 1000;
export const REQUESTS_PER_DAY = 5;

export const REQUEST_STATUSES = ["new", "planned", "in_progress", "done", "declined"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** How a request's status reads to the person who sent it. */
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: "Received",
  planned: "Planned",
  in_progress: "In progress",
  done: "Shipped",
  declined: "Not planned",
};

export function requestStatusLabel(status: string): string {
  return (REQUEST_STATUS_LABELS as Record<string, string>)[status] ?? "Received";
}

/** Trims a request and checks its length; the database enforces the same bounds. */
export function cleanRequest(
  text: string,
): { ok: true; text: string } | { ok: false; error: string } {
  const t = text.replace(/\s+\n/g, "\n").trim();
  if (t.length < REQUEST_MIN)
    return { ok: false, error: "Tell us a little more — a sentence is plenty." };
  if (t.length > REQUEST_MAX)
    return { ok: false, error: `Please keep it under ${REQUEST_MAX} characters.` };
  return { ok: true, text: t };
}
