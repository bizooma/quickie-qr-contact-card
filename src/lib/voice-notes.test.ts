import { describe, expect, it } from "vitest";
import { canSummarize, formatSummaryNote, mergeTranscript, VOICE_NOTE_PREFIX } from "./voice-notes";

describe("canSummarize", () => {
  it("allows voice transcripts of any length", () => {
    expect(canSummarize(`${VOICE_NOTE_PREFIX}short chat`)).toBe(true);
  });
  it("allows typed notes from 200 characters, not below", () => {
    expect(canSummarize("a".repeat(200))).toBe(true);
    expect(canSummarize("a".repeat(199))).toBe(false);
  });
  it("never offers to summarize a summary", () => {
    expect(canSummarize(`Summary — Oct 9, 2026\n${"a".repeat(300)}`)).toBe(false);
  });
});

describe("formatSummaryNote", () => {
  it("titles with the date and lists points and steps", () => {
    const body = formatSummaryNote({ key_points: ["Needs CRM"], next_steps: [] }, new Date(2026, 9, 9));
    expect(body.startsWith("Summary — Oct 9, 2026")).toBe(true);
    expect(body).toContain("Key points\n• Needs CRM");
    expect(body).toContain("Next steps\n• None");
  });
});

describe("mergeTranscript", () => {
  it("appends dictation after existing text", () => {
    expect(mergeTranscript("Met at expo.", " wants a demo ")).toBe("Met at expo. wants a demo");
    expect(mergeTranscript("", "hello")).toBe("hello");
  });
});
