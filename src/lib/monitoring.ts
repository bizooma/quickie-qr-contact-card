// Client error monitoring (Sentry). The DSN lives in sentry-dsn.ts; without
// one this is a no-op and the SDK chunk is never even downloaded. The Worker
// side is wired in server.ts.
import { SENTRY_DSN } from "./sentry-dsn";

export function initMonitoring() {
  if (!SENTRY_DSN || !import.meta.env.PROD || typeof window === "undefined") return;
  void import("@sentry/browser")
    .then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: "production",
        // Errors only — no tracing/replay, to keep cost and payloads small.
        sampleRate: 1,
        tracesSampleRate: 0,
      });
    })
    .catch(() => {
      // Monitoring is best-effort; never let it break the app.
    });
}
