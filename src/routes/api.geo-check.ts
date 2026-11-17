import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY: shows which visitor-location signals reach the app on this
// hosting (header names and the country only; no IP, no city). Used once to
// fix card-analytics location, then deleted.

export const Route = createFileRoute("/api/geo-check")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { geoSignals } = await import("@/lib/visitor-geo");
        return Response.json(geoSignals(request), { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
