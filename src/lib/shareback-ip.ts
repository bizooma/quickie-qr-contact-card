/** Read visitor identity at the incoming request, never from the DB connection. */
export function sharebackVisitorIp(headers: Headers): string | null {
  const cloudflareIp = headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}