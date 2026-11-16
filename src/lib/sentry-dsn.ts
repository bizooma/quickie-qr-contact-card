// The Sentry DSN is a publishable identifier, not a secret. Shared by the
// browser (monitoring.ts) and the Worker (server.ts) so both report to the
// same project. Empty = error monitoring off: the browser never loads the
// SDK and the Worker's client sends nothing. Paste your own project's DSN
// here (or set VITE_SENTRY_DSN at build time) to turn it on.
export const SENTRY_DSN: string = (import.meta.env["VITE_SENTRY_DSN"] as string | undefined) ?? "";
