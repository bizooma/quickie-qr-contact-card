import { describe, expect, it } from "vitest";
import {
  cleanEventName,
  dueGroup,
  eventIsRunning,
  quickPickDate,
  reminderMessage,
} from "./followups";

const now = new Date(2026, 9, 13, 15, 30); // Oct 13, 3:30pm local

describe("quickPickDate", () => {
  it("lands at 9am on the right day", () => {
    const t = quickPickDate("tomorrow", now);
    expect([t.getMonth(), t.getDate(), t.getHours(), t.getMinutes()]).toEqual([9, 14, 9, 0]);
    expect(quickPickDate("3d", now).getDate()).toBe(16);
    expect(quickPickDate("1w", now).getDate()).toBe(20);
    expect(quickPickDate("2w", now).getDate()).toBe(27);
  });
});

describe("dueGroup", () => {
  it("splits overdue, today and upcoming by calendar day", () => {
    expect(dueGroup(new Date(2026, 9, 12, 23, 0), now)).toBe("overdue");
    expect(dueGroup(new Date(2026, 9, 13, 8, 0), now)).toBe("today");
    expect(dueGroup(new Date(2026, 9, 13, 23, 59), now)).toBe("today");
    expect(dueGroup(new Date(2026, 9, 14, 0, 0), now)).toBe("upcoming");
  });
});

describe("reminderMessage", () => {
  it("names one person and uses the note", () => {
    expect(reminderMessage(["Dana Reyes"], "Send the listing")).toEqual({
      title: "Follow up with Dana Reyes",
      body: "Send the listing",
    });
    expect(reminderMessage([" "]).title).toBe("Follow up with a contact");
  });
  it("summarises several", () => {
    expect(reminderMessage(["A", "B"]).body).toBe("A, B.");
    expect(reminderMessage(["A", "B", "C", "D"])).toEqual({
      title: "4 follow-ups due",
      body: "A, B and 2 more.",
    });
  });
});

describe("events", () => {
  it("tidies names", () => {
    expect(cleanEventName("  Denver   Realtor  Expo ")).toBe("Denver Realtor Expo");
    expect(cleanEventName("x".repeat(100))).toHaveLength(80);
  });
  it("runs while active and not past its end date", () => {
    expect(eventIsRunning({ is_active: true, ends_on: null }, now)).toBe(true);
    expect(eventIsRunning({ is_active: true, ends_on: "2026-10-13" }, now)).toBe(true);
    expect(eventIsRunning({ is_active: true, ends_on: "2026-10-12" }, now)).toBe(false);
    expect(eventIsRunning({ is_active: false, ends_on: null }, now)).toBe(false);
  });
});
