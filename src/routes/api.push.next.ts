import { createFileRoute } from "@tanstack/react-router";

// The service worker calls this when a push arrives, with its own
// subscription endpoint (an unguessable capability URL), to get the text for
// that notification. Pushes are payload-less, so this is where reminder text
// comes from; no queued message means "show the default new-contact text".

export const Route = createFileRoute("/api/push/next")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let endpoint = "";
        try {
          const body = (await request.json()) as { endpoint?: unknown };
          endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
        } catch {
          // Treated as "no message".
        }
        if (!endpoint.startsWith("https://") || endpoint.length > 1000) {
          return new Response(null, { status: 204 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: sub } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id")
          .eq("endpoint", endpoint)
          .maybeSingle();
        if (!sub) return new Response(null, { status: 204 });
        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const { data: msg } = await supabaseAdmin
          .from("push_messages")
          .select("id, title, body, url")
          .eq("subscription_id", sub.id)
          .gte("created_at", since)
          .order("created_at")
          .limit(1)
          .maybeSingle();
        if (!msg) return new Response(null, { status: 204 });
        await supabaseAdmin.from("push_messages").delete().eq("id", msg.id);
        return Response.json({ title: msg.title, body: msg.body, url: msg.url });
      },
    },
  },
});
