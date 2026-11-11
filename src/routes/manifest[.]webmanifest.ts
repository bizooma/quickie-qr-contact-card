import { createFileRoute } from "@tanstack/react-router";
import { appManifest } from "@/lib/web-manifest";

// The main app's manifest; its scope depends on the phone (see web-manifest.ts).
export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: ({ request }) =>
        new Response(JSON.stringify(appManifest(request.headers.get("user-agent"))), {
          headers: {
            "content-type": "application/manifest+json; charset=utf-8",
            "cache-control": "no-cache",
            vary: "User-Agent",
          },
        }),
    },
  },
});
