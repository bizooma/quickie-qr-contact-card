import { describe, expect, it } from "vitest";
import {
  ATTRIBUTION_KEY,
  attributionFromUrl,
  captureAttribution,
  readAttribution,
} from "./attribution";

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

const now = new Date("2026-10-24T12:00:00Z");

describe("attributionFromUrl", () => {
  it("is null for a plain visit", () => {
    expect(attributionFromUrl(new URL("https://quickieqr.com/"), "", now)).toBeNull();
  });

  it("keeps UTM codes, the Facebook click id and the landing page", () => {
    const a = attributionFromUrl(
      new URL(
        "https://quickieqr.com/for/realtors?utm_source=meta&utm_campaign=tier1&fbclid=abc",
      ),
      "https://l.facebook.com/",
      now,
    );
    expect(a).toEqual({
      utm_source: "meta",
      utm_campaign: "tier1",
      fbclid: "abc",
      landing: "/for/realtors",
      referrer: "l.facebook.com",
      at: "2026-10-24T12:00:00.000Z",
    });
  });

  it("records the referring card only next to a ref marker", () => {
    expect(attributionFromUrl(new URL("https://x.com/?ref=card&c=Tamzyn"), "", now)).toMatchObject({
      ref: "card",
      ref_card: "tamzyn",
    });
    expect(attributionFromUrl(new URL("https://x.com/?c=tamzyn"), "", now)).toBeNull();
  });

  it("drops a same-site referrer and truncates long values", () => {
    const a = attributionFromUrl(
      new URL(`https://x.com/?utm_source=${"a".repeat(300)}`),
      "https://x.com/pricing",
      now,
    );
    expect(a?.utm_source).toHaveLength(200);
    expect(a?.referrer).toBeUndefined();
  });
});

describe("captureAttribution", () => {
  it("stores the first touch and never overwrites it", () => {
    const s = new MemoryStorage();
    captureAttribution(s, new URL("https://x.com/?utm_source=meta"), "");
    captureAttribution(s, new URL("https://x.com/?utm_source=google"), "");
    expect(readAttribution(s)["utm_source"]).toBe("meta");
  });

  it("ignores visits without attribution and bad stored data", () => {
    const s = new MemoryStorage();
    captureAttribution(s, new URL("https://x.com/pricing"), "");
    expect(s.getItem(ATTRIBUTION_KEY)).toBeNull();
    s.setItem(ATTRIBUTION_KEY, "{not json");
    expect(readAttribution(s)).toEqual({});
    s.setItem(ATTRIBUTION_KEY, JSON.stringify({ ref: "card", n: 1 }));
    expect(readAttribution(s)).toEqual({ ref: "card" });
  });
});
