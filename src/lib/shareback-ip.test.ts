import { describe, expect, it } from "vitest";
import { sharebackVisitorIp } from "./shareback-ip";

describe("share-back visitor IP", () => {
  it("prefers cf-connecting-ip over x-forwarded-for", () => {
    expect(sharebackVisitorIp(new Headers({
      "cf-connecting-ip": "203.0.113.1", "x-forwarded-for": "198.51.100.2, 198.51.100.3",
    }))).toBe("203.0.113.1");
  });
  it("uses only the first forwarded address when Cloudflare's header is absent", () => {
    expect(sharebackVisitorIp(new Headers({ "x-forwarded-for": "198.51.100.2, 198.51.100.3" })))
      .toBe("198.51.100.2");
  });
  it("falls back when Cloudflare's header is empty", () => {
    expect(sharebackVisitorIp(new Headers({ "cf-connecting-ip": " ", "x-forwarded-for": "198.51.100.2" })))
      .toBe("198.51.100.2");
  });
  it("returns no identity when neither header is present", () => {
    expect(sharebackVisitorIp(new Headers())).toBeNull();
  });
});