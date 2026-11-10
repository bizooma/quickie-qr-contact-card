import { describe, expect, it } from "vitest";
import {
  MAX_STARRED,
  checklistProgress,
  emptyState,
  parseState,
  starredOpeners,
  toggleChecked,
  toggleStarred,
} from "./event-prep";
import { EVENT_PREP } from "./event-prep-content.server";

describe("event prep content", () => {
  it("has twenty openers numbered 1 to 20", () => {
    const numbers = EVENT_PREP.openers.groups.flatMap((g) => g.items.map((i) => i.n));
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("gives every checklist item a unique id", () => {
    const ids = EVENT_PREP.checklist.sections.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(17);
  });

  it("carries no long dashes", () => {
    expect(JSON.stringify(EVENT_PREP)).not.toMatch(/[–—]/);
  });
});

describe("parseState", () => {
  it("returns an empty state for anything that is not an object", () => {
    for (const raw of [null, undefined, "x", 3, []]) {
      expect(parseState(raw)).toEqual(emptyState());
    }
  });

  it("keeps valid values and repairs the rest", () => {
    const s = parseState({
      checked: ["week-names", 7, "week-names", null],
      starred: [3, 3, 9, 14, 20, "x", 1.5],
      sheet: {
        event: "Web Summit",
        why: 42,
        who: [{ role: "Buyers", because: "pricing" }, "junk"],
        names: "nope",
        target: "8",
      },
    });
    expect(s.checked).toEqual(["week-names"]);
    expect(s.starred).toEqual([3, 9, 14]);
    expect(s.sheet.event).toBe("Web Summit");
    expect(s.sheet.why).toBe("");
    expect(s.sheet.who).toEqual([
      { role: "Buyers", because: "pricing" },
      { role: "", because: "" },
      { role: "", because: "" },
    ]);
    expect(s.sheet.names).toHaveLength(2);
    expect(s.sheet.target).toBe("8");
  });

  it("caps long text", () => {
    expect(parseState({ sheet: { event: "x".repeat(900) } }).sheet.event).toHaveLength(200);
  });
});

describe("toggles", () => {
  it("ticks and unticks a checklist item", () => {
    expect(toggleChecked([], "a")).toEqual(["a"]);
    expect(toggleChecked(["a", "b"], "a")).toEqual(["b"]);
  });

  it("stars up to three openers and refuses a fourth", () => {
    let starred: number[] = [];
    for (const n of [1, 6, 15, 20]) starred = toggleStarred(starred, n);
    expect(starred).toEqual([1, 6, 15]);
    expect(starred).toHaveLength(MAX_STARRED);
    expect(toggleStarred(starred, 6)).toEqual([1, 15]);
  });
});

describe("derived values", () => {
  it("counts checklist progress, ignoring ids that no longer exist", () => {
    expect(checklistProgress(EVENT_PREP, ["week-names", "day-charge", "gone"])).toEqual({
      done: 2,
      total: 17,
    });
  });

  it("lists starred openers in list order", () => {
    expect(starredOpeners(EVENT_PREP, [15, 2])).toEqual([
      "How's the event treating you so far?",
      "Who's your ideal customer? I might know someone.",
    ]);
  });
});
