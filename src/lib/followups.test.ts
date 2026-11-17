import { describe, expect, it } from "vitest";
import {
  cleanEventName,
  dueGroup,
  eventIsRunning,
  quickPickDate,
  reminderMessage,
  queueState,
  plainDraft,
  digestMessage,
  followUpRate,
  emailHref,
  smsHref,
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

describe("follow-up queue", () => {
  const now = new Date("2026-11-18T15:00:00Z");

  it("puts a contact due now, later, or done", () => {
    expect(
      queueState({ follow_up_due_at: "2026-11-18T14:00:00Z", follow_up_done_at: null }, now),
    ).toBe("due");
    expect(
      queueState({ follow_up_due_at: "2026-11-19T14:00:00Z", follow_up_done_at: null }, now),
    ).toBe("later");
    expect(
      queueState(
        { follow_up_due_at: "2026-11-18T14:00:00Z", follow_up_done_at: "2026-11-18T14:30:00Z" },
        now,
      ),
    ).toBe("done");
    expect(queueState({ follow_up_due_at: null, follow_up_done_at: null }, now)).toBeNull();
  });

  it("writes a plain draft that names where they met and signs off", () => {
    const d = plainDraft(
      { full_name: "Jane Doe", met_at: null },
      { full_name: "Joe Murphy" },
      "JBA mixer",
    );
    expect(d.subject).toBe("Great meeting you at JBA mixer");
    expect(d.body.startsWith("Hi Jane,")).toBe(true);
    expect(d.body).toContain("at JBA mixer");
    expect(d.body.endsWith("Best,\nJoe")).toBe(true);
    const bare = plainDraft({ full_name: "Sam", met_at: null }, null);
    expect(bare.subject).toBe("Great meeting you");
    expect(bare.body.endsWith("Best,")).toBe(true);
  });

  it("words the morning summary", () => {
    expect(digestMessage(1, "Jane Doe", null)).toEqual({
      title: "Follow up with Jane Doe",
      body: "Your draft is ready to send.",
    });
    expect(digestMessage(14, "Amy", "the JBA mixer")).toEqual({
      title: "14 people to follow up",
      body: "You met them at the JBA mixer. Your drafts are ready to send.",
    });
  });

  it("computes the follow-up rate", () => {
    expect(followUpRate(0, 0)).toBeNull();
    expect(followUpRate(12, 8)).toBe(67);
    expect(followUpRate(3, 5)).toBe(100);
  });

  it("builds send links with the draft filled in", () => {
    expect(emailHref("a@b.co", { subject: "Hi there", body: "Line 1\nLine 2" })).toBe(
      "mailto:a@b.co?subject=Hi%20there&body=Line%201%0ALine%202",
    );
    expect(smsHref("(904) 555-0100", "Hey & hi")).toBe("sms:9045550100?&body=Hey%20%26%20hi");
  });
});
