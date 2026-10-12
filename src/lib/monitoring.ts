// Client error monitoring (Sentry). A DSN is a publishable identifier, not
// a secret. Until one is set — create the project in Sentry, then paste its
// DSN here or expose VITE_SENTRY_DSN at build time — this is a no-op and
// the SDK chunk is never even downloaded.
const SENTRY_DSN: string =
  (import.meta.env["VITE_SENTRY_DSN"] as string | undefined) ??
  "https://efff02bffbb9bed9883ac71936da0690@o4511277693927424.ingest.us.sentry.io/4512241058971648";

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
