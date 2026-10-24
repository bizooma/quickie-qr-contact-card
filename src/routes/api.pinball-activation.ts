import { createFileRoute } from "@tanstack/react-router";

// Pinball "create your account" nudges: a webhook step in the buyer
// automation POSTs {email} here with the same bearer secret as the refund
// webhook (app_secrets 'pinball_refund'). 200 means the buyer has an account
// (the step's success branch ends the sequence); 404 means not yet (the
// failure branch sends the nudge email). Never says anything else about
// the person.

export const Route = createFileRoute("/api/pinball-activation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { bearerMatches, normalizeEmail } = await import("@/lib/pinball-order");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: setting } = await supabaseAdmin
          .from("app_secrets")
          .select("value")
          .eq("key", "pinball_refund")
          .maybeSingle();
        const secret = (setting?.value as { secret?: string } | null)?.secret ?? "";
        if (!secret) return Response.json({ error: "not configured" }, { status: 503 });
        if (!bearerMatches(request.headers.get("authorization"), secret)) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        let email = "";
        try {
          const body = (await request.json()) as { email?: unknown };
          email = normalizeEmail(typeof body.email === "string" ? body.email : null);
        } catch {
          return Response.json({ error: "invalid json" }, { status: 400 });
        }
        if (!email.includes("@"))
          return Response.json({ error: "email required" }, { status: 400 });

        // Activated = a purchase for this email has been applied to an account.
        const { data } = await supabaseAdmin
          .from("purchase_entitlements")
          .select("id")
          .eq("email", email)
          .not("applied_to", "is", null)
          .limit(1)
          .maybeSingle();
        if (data) return Response.json({ activated: true });
        return Response.json({ activated: false }, { status: 404 });
      },
    },
  },
});
