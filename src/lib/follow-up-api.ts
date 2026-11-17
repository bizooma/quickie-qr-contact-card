// The follow-up queue (browser client; RLS: the owner's own contacts).
// Teammates can read shared contacts, so every query also filters on the
// signed-in person's id: the queue is only ever your own people.

import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import type { FollowUpDraft } from "./ai-model";

export const QUEUE_KEY = ["follow-up-queue"];
export const QUEUE_COUNT_KEY = ["follow-up-count"];

export type QueueItem = {
  id: string;
  full_name: string;
  company: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  met_at: string | null;
  source: string;
  created_at: string;
  card_id: string | null;
  follow_up_due_at: string | null;
  follow_up_done_at: string | null;
  follow_up_outcome: string | null;
  follow_up_draft: FollowUpDraft | null;
  event: string | null;
};

const COLUMNS =
  "id, full_name, company, job_title, email, phone, met_at, source, created_at, card_id, " +
  "follow_up_due_at, follow_up_done_at, follow_up_outcome, follow_up_draft, events(name)";

type Raw = Omit<QueueItem, "event" | "follow_up_draft"> & {
  follow_up_draft: unknown;
  events: { name: string } | null;
};

function asDraft(v: unknown): FollowUpDraft | null {
  if (!v || typeof v !== "object") return null;
  const d = v as Record<string, unknown>;
  return typeof d["subject"] === "string" && typeof d["body"] === "string"
    ? { subject: d["subject"], body: d["body"] }
    : null;
}

const toItem = (r: Raw): QueueItem => ({
  ...r,
  follow_up_draft: asDraft(r.follow_up_draft),
  event: r.events?.name ?? null,
});

export type Queue = {
  open: QueueItem[];
  recentlyDone: QueueItem[];
  /** People met in the last 30 days, and how many got a follow-up sent. */
  met30: number;
  sent30: number;
};

export async function loadQueue(userId: string): Promise<Queue> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [open, done, met, sent] = await Promise.all([
    supabase
      .from("contacts")
      .select(COLUMNS)
      .eq("user_id", userId)
      .is("follow_up_done_at", null)
      .not("follow_up_due_at", "is", null)
      .order("follow_up_due_at")
      .limit(200),
    supabase
      .from("contacts")
      .select(COLUMNS)
      .eq("user_id", userId)
      .gte("follow_up_done_at", weekAgo)
      .order("follow_up_done_at", { ascending: false })
      .limit(50),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since)
      .eq("follow_up_outcome", "sent"),
  ]);
  if (open.error) throw open.error;
  if (done.error) throw done.error;
  return {
    open: ((open.data ?? []) as unknown as Raw[]).map(toItem),
    recentlyDone: ((done.data ?? []) as unknown as Raw[]).map(toItem),
    met30: met.count ?? 0,
    sent30: sent.count ?? 0,
  };
}

/** How many follow-ups are due right now (the nav badge). */
export async function countDue(userId: string): Promise<number> {
  const { count } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("follow_up_done_at", null)
    .lte("follow_up_due_at", new Date().toISOString());
  return count ?? 0;
}

async function update(id: string, patch: TablesUpdate<"contacts">) {
  const { error } = await supabase.from("contacts").update(patch).eq("id", id);
  if (error) throw error;
}

/** Closes it: "sent" when they reached out, "skipped" when no follow-up is needed. */
export const markDone = (id: string, outcome: "sent" | "skipped") =>
  update(id, { follow_up_done_at: new Date().toISOString(), follow_up_outcome: outcome });

/** Back into the queue, due now. */
export const reopen = (id: string) =>
  update(id, {
    follow_up_done_at: null,
    follow_up_outcome: null,
    follow_up_due_at: new Date().toISOString(),
  });

export const snooze = (id: string, until: Date) =>
  update(id, { follow_up_due_at: until.toISOString() });

/** Keeps the person's edits to a draft. */
export const saveDraft = (id: string, draft: FollowUpDraft) =>
  update(id, {
    follow_up_draft: { subject: draft.subject.slice(0, 300), body: draft.body.slice(0, 8000) },
  });

/** The sender's first card (for the plain draft's sign-off). */
export async function myFirstCardName(userId: string): Promise<{ full_name: string } | null> {
  const { data } = await supabase
    .from("cards")
    .select("full_name")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Records the device's time zone so the morning summary lands at ~8am. */
export async function syncTimeZone(userId: string): Promise<void> {
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return;
  }
  if (!tz) return;
  const flag = `ck-tz:${userId}`;
  try {
    if (localStorage.getItem(flag) === tz) return;
  } catch {
    // No storage: just send it.
  }
  const { error } = await supabase.from("profiles").update({ time_zone: tz }).eq("id", userId);
  if (error) return;
  try {
    localStorage.setItem(flag, tz);
  } catch {
    // Fine: we'll send it again next load.
  }
}
