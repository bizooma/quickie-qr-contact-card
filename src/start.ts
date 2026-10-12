import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware({ type: "request" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Clickjacking protection. 'self' keeps the landing page's live-card popup
// (same-origin iframe of /c/…) working. No instanceof check — the runtime's
// Response class can differ from the bundle's — and immutable headers get a
// mutable clone instead of a silent skip.
const SECURITY_HEADERS: Array<[string, string]> = [
  ["Content-Security-Policy", "frame-ancestors 'self'"],
  ["X-Frame-Options", "SAMEORIGIN"],
];

const securityHeadersMiddleware = createMiddleware({ type: "request" }).server(async ({ next }) => {
  // next() resolves to { request, pathname, context, response }, not a bare
  // Response. Mutate the response's headers; if they're immutable, return a
  // mutable clone instead (the middleware may return a Response directly).
  const result = await next();
  const res = result.response;
  if (!res || typeof res.headers?.set !== "function") return result;
  try {
    for (const [k, v] of SECURITY_HEADERS) if (!res.headers.has(k)) res.headers.set(k, v);
    return result;
  } catch {
    const copy = new Response(res.body, res);
    for (const [k, v] of SECURITY_HEADERS) if (!copy.headers.has(k)) copy.headers.set(k, v);
    return copy;
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware, securityHeadersMiddleware],
}));
