// The Sentry DSN is a publishable identifier, not a secret. Shared by the
// browser (monitoring.ts) and the Worker (server.ts) so both report to the
// same project. VITE_SENTRY_DSN at build time overrides it.
export const SENTRY_DSN: string =
  (import.meta.env["VITE_SENTRY_DSN"] as string | undefined) ??
  "https://efff02bffbb9bed9883ac71936da0690@o4511277693927424.ingest.us.sentry.io/4512241058971648";
