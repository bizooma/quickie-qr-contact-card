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
