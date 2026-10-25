import { createFileRoute } from "@tanstack/react-router";

// Called every 15 minutes by the database's pg_cron job (see migration
// 0022) with a bearer secret kept in app_secrets. Sends one push per user
// for their due follow-up reminders, then marks them notified.

const MAX_PER_RUN = 500;
const MAX_USERS_PER_RUN = 100;

async function secretMatches(provided: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(provided)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

export const Route = createFileRoute("/api/cron/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const token = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        const { data: secret } = await supabaseAdmin
          .from("app_secrets")
          .select("value")
          .eq("key", "cron_reminders")
          .maybeSingle();
        const expected = typeof secret?.value === "string" ? secret.value : "";
        if (!token || !expected || !(await secretMatches(token, expected))) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        // Keep private abuse records for one day, even when no reminders are due,
        // and prune the tables that otherwise grow forever (views, site events,
        // delivered push texts, handled Stripe events).
        const { error: cleanupError } = await supabaseAdmin.rpc("cleanup_rpc_rate_limits");
        if (cleanupError) return Response.json({ error: "cleanup failed" }, { status: 500 });
        const { error: staleError } = await supabaseAdmin.rpc("cleanup_stale_data");
        if (staleError) console.error(`cleanup_stale_data failed: ${staleError.message}`);

        const { data: due, error } = await supabaseAdmin
          .from("contact_reminders")
          .select("id, user_id, contact_id, note, contacts(full_name)")
          .is("done_at", null)
          .is("notified_at", null)
          .lte("remind_at", new Date().toISOString())
          .order("remind_at")
          .limit(MAX_PER_RUN);
        if (error) return Response.json({ error: "query failed" }, { status: 500 });
        if (!due?.length) return Response.json({ sent: 0 });

        const { reminderMessage } = await import("@/lib/followups");
        const { sendPushToUser } = await import("@/lib/notify.server");
        const byUser = new Map<string, typeof due>();
        for (const r of due) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);

        // A Worker may make a limited number of outbound requests per
        // invocation, and each user costs a few; the rest wait 15 minutes.
        let sent = 0;
        let users = 0;
        for (const [userId, list] of byUser) {
          if (++users > MAX_USERS_PER_RUN) break;
          // Reminders are Premium; a lapsed plan just stops the pings.
          const { data: plan } = await supabaseAdmin.rpc("effective_plan", { _user: userId });
          if (plan === "premium") {
            const names = list.map((r) => r.contacts?.full_name ?? "");
            const msg = reminderMessage(names, list.length === 1 ? list[0]!.note : null);
            const url =
              list.length === 1 ? `/app/contacts/${list[0]!.contact_id}` : "/app/contacts";
            try {
              await sendPushToUser(userId, { ...msg, url });
              sent += 1;
            } catch {
              // Push is best-effort; the reminder still shows in the app.
            }
          }
          await supabaseAdmin
            .from("contact_reminders")
            .update({ notified_at: new Date().toISOString() })
            .in(
              "id",
              list.map((r) => r.id),
            );
        }
        return Response.json({ sent, reminders: due.length });
      },
    },
  },
});
