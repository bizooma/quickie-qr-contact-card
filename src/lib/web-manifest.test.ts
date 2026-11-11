import { describe, expect, it } from "vitest";
import { appManifest, isAndroidUserAgent } from "./web-manifest";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

describe("appManifest", () => {
  it("leaves /my-qr outside the app on Android so My QR can install", () => {
    const m = appManifest(ANDROID);
    expect(m.scope).toBe("/app");
    expect("/my-qr".startsWith(m.scope)).toBe(false);
    expect(m.start_url.startsWith(m.scope)).toBe(true);
    expect(m.shortcuts.every((s) => s.url.startsWith(m.scope))).toBe(true);
  });

  it("keeps the whole site in the app elsewhere", () => {
    expect(appManifest(IPHONE).scope).toBe("/");
    expect(appManifest(MAC).scope).toBe("/");
    expect(appManifest(null).scope).toBe("/");
  });

  it("keeps the same app identity everywhere", () => {
    expect(appManifest(ANDROID).id).toBe(appManifest(IPHONE).id);
  });
});

describe("isAndroidUserAgent", () => {
  it("spots Android only", () => {
    expect(isAndroidUserAgent(ANDROID)).toBe(true);
    expect(isAndroidUserAgent(IPHONE)).toBe(false);
    expect(isAndroidUserAgent(undefined)).toBe(false);
  });
});
