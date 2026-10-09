// Client-safe helpers for voice notes and AI note summaries.
import { format } from "date-fns";
import type { NoteSummary } from "./ai-model";

export const VOICE_NOTE_PREFIX = "Voice note: ";
export const SUMMARY_PREFIX = "Summary — ";
export const SUMMARIZE_MIN_CHARS = 200;

export function isSummaryNote(body: string): boolean {
  return body.startsWith(SUMMARY_PREFIX);
}

/** Voice transcripts and long notes qualify; summaries never do. */
export function canSummarize(body: string): boolean {
  if (isSummaryNote(body)) return false;
  return body.startsWith(VOICE_NOTE_PREFIX) || body.trim().length >= SUMMARIZE_MIN_CHARS;
}

/** Joins the text before dictation started with the live transcript. */
export function mergeTranscript(base: string, transcript: string): string {
  const t = transcript.trim();
  if (!t) return base;
  return base.trim() ? `${base.trimEnd()} ${t}` : t;
}

export function formatSummaryNote(summary: NoteSummary, date: Date): string {
  const list = (items: string[]) => (items.length ? items.map((i) => `• ${i.trim()}`).join("\n") : "• None");
  return `${SUMMARY_PREFIX}${format(date, "MMM d, yyyy")}\n\nKey points\n${list(summary.key_points)}\n\nNext steps\n${list(summary.next_steps)}`;
}
