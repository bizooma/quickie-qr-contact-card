import { describe, expect, it } from "vitest";
import {
  attachVisitorGeo,
  geoFromCf,
  GEO_HEADERS,
  readGeoHeaders,
  withGeoHeaders,
} from "./visitor-geo";

describe("visitor location", () => {
  it("uses the US state code and the full region elsewhere", () => {
    expect(
      geoFromCf({ city: "Jacksonville", region: "Florida", regionCode: "FL", country: "US" }),
    ).toEqual({
      city: "Jacksonville",
      region: "FL",
      country: "US",
    });
    expect(
      geoFromCf({ city: "London", region: "England", regionCode: "ENG", country: "GB" }),
    ).toEqual({
      city: "London",
      region: "England",
      country: "GB",
    });
    expect(geoFromCf({ country: "XX" }).country).toBeNull();
    expect(geoFromCf(undefined)).toEqual({ city: null, region: null, country: null });
  });

  it("round-trips non-ASCII city names through headers", () => {
    const h = withGeoHeaders(new Headers(), {
      city: "São Paulo",
      region: "São Paulo",
      country: "BR",
    });
    expect(readGeoHeaders(h)).toEqual({ city: "São Paulo", region: "São Paulo", country: "BR" });
  });

  it("throws away location headers a browser sent itself", () => {
    const spoofed = new Headers({ [GEO_HEADERS.city]: "Fake", [GEO_HEADERS.country]: "ZZ" });
    const h = withGeoHeaders(spoofed, { city: null, region: null, country: null });
    expect(readGeoHeaders(h)).toEqual({ city: null, region: null, country: null });
  });

  it("only touches server-function requests", () => {
    const page = new Request("https://quickieqr.com/c/joe", {
      headers: { [GEO_HEADERS.city]: "Fake" },
    });
    expect(attachVisitorGeo(page)).toBe(page);
    const fn = new Request("https://quickieqr.com/_serverFn/abc", {
      method: "POST",
      headers: { [GEO_HEADERS.city]: "Fake" },
    });
    expect(readGeoHeaders(attachVisitorGeo(fn).headers).city).toBeNull();
  });
});

describe("Cloudflare location headers", () => {
  it("fills in from cf-ipcountry and friends when request.cf is missing", async () => {
    const { visitorGeo } = await import("./visitor-geo");
    const req = new Request("https://quickieqr.com/_serverFn/x", {
      headers: { "cf-ipcountry": "US", "cf-ipcity": "Jacksonville", "cf-region-code": "FL" },
    });
    expect(visitorGeo(req)).toEqual({ city: "Jacksonville", region: "FL", country: "US" });
    const torOnly = new Request("https://quickieqr.com/_serverFn/x", {
      headers: { "cf-ipcountry": "T1" },
    });
    expect(visitorGeo(torOnly)).toEqual({ city: null, region: null, country: null });
  });
});
