// Pure helpers for follow-up reminders and event mode: quick-pick times,
// grouping reminders by when they're due, and the notification text.

export type QuickPick = { id: string; label: string };

export const QUICK_PICKS: QuickPick[] = [
  { id: "tomorrow", label: "Tomorrow" },
  { id: "3d", label: "In 3 days" },
  { id: "1w", label: "Next week" },
  { id: "2w", label: "In 2 weeks" },
];

const DAYS: Record<string, number> = { tomorrow: 1, "3d": 3, "1w": 7, "2w": 14 };

/** 9:00 local time, N days from `now` — a sensible "first thing" reminder. */
export function quickPickDate(id: string, now = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + (DAYS[id] ?? 1));
  d.setHours(9, 0, 0, 0);
  return d;
}

export type DueGroup = "overdue" | "today" | "upcoming";

/** Overdue = before today; today = any time today; upcoming = later. */
export function dueGroup(remindAt: Date, now = new Date()): DueGroup {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  if (remindAt < startOfToday) return "overdue";
  if (remindAt < startOfTomorrow) return "today";
  return "upcoming";
}

/** Notification text for one or more due reminders. */
export function reminderMessage(
  names: string[],
  note?: string | null,
): { title: string; body: string } {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length <= 1) {
    const who = clean[0] || "a contact";
    return {
      title: `Follow up with ${who}`,
      body: note?.trim() || "Tap to open their contact and reach out.",
    };
  }
  const shown = clean.slice(0, 2).join(", ");
  const more = clean.length - 2;
  return {
    title: `${clean.length} follow-ups due`,
    body: more > 0 ? `${shown} and ${more} more.` : `${shown}.`,
  };
}

/** Event name tidied for storage (trimmed, single spaces, max 80). */
export function cleanEventName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, 80);
}

/** An event counts as running while active and not past its end date. */
export function eventIsRunning(
  e: { is_active: boolean; ends_on: string | null },
  today = new Date(),
): boolean {
  if (!e.is_active) return false;
  if (!e.ends_on) return true;
  const end = new Date(`${e.ends_on}T23:59:59`);
  return end >= today;
}

// ---- The follow-up queue ----------------------------------------------------

/** A contact's place in the queue: due now, snoozed until later, or done. */
export type QueueState = "due" | "later" | "done";

export function queueState(
  c: { follow_up_due_at: string | null; follow_up_done_at: string | null },
  now = new Date(),
): QueueState | null {
  if (c.follow_up_done_at) return "done";
  if (!c.follow_up_due_at) return null;
  return new Date(c.follow_up_due_at) <= now ? "due" : "later";
}

/** A draft the person can send without AI (free accounts, or before the AI
 *  draft is made). Plain and safe for any card, attorney cards included: no
 *  claims, no pitch, one easy next step. */
export function plainDraft(
  contact: { full_name: string; met_at: string | null },
  sender: { full_name: string } | null,
  eventName?: string | null,
): { subject: string; body: string } {
  const first = contact.full_name.trim().split(/\s+/)[0] || "there";
  const me = sender?.full_name.trim().split(/\s+/)[0] || "";
  const where = (eventName || contact.met_at || "").trim();
  return {
    subject: where ? `Great meeting you at ${where}` : "Great meeting you",
    body: [
      `Hi ${first},`,
      "",
      where
        ? `It was good to meet you at ${where}. I'd be glad to stay in touch.`
        : "It was good to meet you. I'd be glad to stay in touch.",
      "",
      "If it would help to talk further, just reply and we can find a time.",
      "",
      me ? `Best,\n${me}` : "Best,",
    ].join("\n"),
  };
}

/** The morning summary push for follow-ups waiting. */
export function digestMessage(
  count: number,
  sampleName: string | null,
  eventName: string | null,
): { title: string; body: string } {
  const event = eventName?.trim();
  if (count <= 1) {
    const who = sampleName?.trim() || "someone you met";
    return {
      title: `Follow up with ${who}`,
      body: event
        ? `You met at ${event}. Your draft is ready to send.`
        : "Your draft is ready to send.",
    };
  }
  return {
    title: `${count} people to follow up`,
    body: event
      ? `You met them at ${event}. Your drafts are ready to send.`
      : "Your drafts are ready to send.",
  };
}

/** Share of people met who got a follow-up (0-100), or null with nobody met. */
export function followUpRate(met: number, sent: number): number | null {
  if (met <= 0) return null;
  return Math.round((Math.min(sent, met) / met) * 100);
}

/** mailto: and sms: links with the draft filled in. */
export function emailHref(email: string, d: { subject: string; body: string }): string {
  return `mailto:${email}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
}

export function smsHref(phone: string, body: string): string {
  const to = phone.replace(/[^\d+]/g, "");
  // "?&body=" works on both iPhone and Android.
  return `sms:${to}?&body=${encodeURIComponent(body)}`;
}
