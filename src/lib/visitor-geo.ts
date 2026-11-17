// Approximate visitor location for card analytics, from Cloudflare.
//
// Cloudflare puts the visitor's city, region and country on every request
// (request.cf). Only the worker entry (src/server.ts) can see that object, so
// it copies those three values into request headers for server functions,
// after deleting any a browser tried to send itself. The IP address is never
// stored; only the city-level place is.

export const GEO_HEADERS = {
  city: "x-qq-geo-city",
  region: "x-qq-geo-region",
  country: "x-qq-geo-country",
} as const;

export type Geo = { city: string | null; region: string | null; country: string | null };

type CfLike = { city?: unknown; regionCode?: unknown; region?: unknown; country?: unknown };

const clean = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/** The place in Cloudflare's request.cf. US regions use the short code ("FL"). */
export function geoFromCf(cf: CfLike | undefined | null): Geo {
  if (!cf) return { city: null, region: null, country: null };
  const country = clean(cf.country, 2)?.toUpperCase() ?? null;
  return {
    city: clean(cf.city, 80),
    region: clean(country === "US" ? cf.regionCode : cf.region, 80) ?? clean(cf.region, 80),
    country: country && /^[A-Z]{2}$/.test(country) && country !== "XX" ? country : null,
  };
}

/** Copies the place into headers, replacing anything the browser sent. Header
 *  values must be plain ASCII, so "São Paulo" travels URL-encoded. */
export function withGeoHeaders(headers: Headers, geo: Geo): Headers {
  const out = new Headers(headers);
  for (const name of Object.values(GEO_HEADERS)) out.delete(name);
  for (const [key, name] of Object.entries(GEO_HEADERS) as [keyof Geo, string][]) {
    const v = geo[key];
    if (v) out.set(name, encodeURIComponent(v));
  }
  return out;
}

/** The place, as the worker entry set it, inside a server function. */
export function readGeoHeaders(headers: Headers): Geo {
  const read = (name: string, max: number) => {
    const raw = headers.get(name);
    if (!raw) return null;
    try {
      return clean(decodeURIComponent(raw), max);
    } catch {
      return null;
    }
  };
  const country = read(GEO_HEADERS.country, 2)?.toUpperCase() ?? null;
  return {
    city: read(GEO_HEADERS.city, 80),
    region: read(GEO_HEADERS.region, 80),
    country: country && /^[A-Z]{2}$/.test(country) ? country : null,
  };
}

/** Rebuilds a server-function request with the visitor's place attached.
 *  Other requests pass through untouched. */
export function attachVisitorGeo(request: Request): Request {
  if (!new URL(request.url).pathname.startsWith("/_serverFn")) return request;
  const cf = (request as Request & { cf?: CfLike }).cf;
  return new Request(request, { headers: withGeoHeaders(request.headers, geoFromCf(cf)) });
}
