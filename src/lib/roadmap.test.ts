import { describe, expect, it } from "vitest";
import {
  cleanRequest,
  itemsForStage,
  REQUEST_MAX,
  requestStatusLabel,
  ROADMAP_ITEMS,
} from "./roadmap";

describe("roadmap items", () => {
  it("have unique keys the database accepts", () => {
    const keys = ROADMAP_ITEMS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z0-9-]{1,40}$/);
  });

  it("lists the referral discount as up next", () => {
    expect(ROADMAP_ITEMS.find((i) => i.key === "referral-discount")?.stage).toBe("next");
  });

  it("puts the most-wanted items of a stage first and keeps order on ties", () => {
    const planned = itemsForStage("planned").map((i) => i.key);
    const voted = itemsForStage("planned", { "offline-scan": 3, "weekly-summary": 1 }).map(
      (i) => i.key,
    );
    expect(voted[0]).toBe("offline-scan");
    expect(voted[1]).toBe("weekly-summary");
    expect(voted.slice(2)).toEqual(
      planned.filter((k) => k !== "offline-scan" && k !== "weekly-summary"),
    );
    expect(itemsForStage("next").every((i) => i.stage === "next")).toBe(true);
  });
});

describe("feature requests", () => {
  it("trims and accepts a normal request", () => {
    expect(cleanRequest("  Let me tag contacts in bulk please  ")).toEqual({
      ok: true,
      text: "Let me tag contacts in bulk please",
    });
  });

  it("rejects requests that are too short or too long", () => {
    expect(cleanRequest("  hi ").ok).toBe(false);
    expect(cleanRequest("x".repeat(REQUEST_MAX + 1)).ok).toBe(false);
  });

  it("labels statuses for the person who asked", () => {
    expect(requestStatusLabel("done")).toBe("Shipped");
    expect(requestStatusLabel("new")).toBe("Received");
    expect(requestStatusLabel("something-else")).toBe("Received");
  });
});
