import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getAdminOverview, setUserPlan } from "@/lib/admin.functions";

export const Route = createFileRoute("/app/admin")({ component: AdminPage });

// The page is gated twice: this client check hides it, and every server
// function re-verifies profiles.is_admin with the service role.
function AdminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    enabled: !!me?.is_admin,
    queryFn: () => getAdminOverview(),
  });

  if (!me) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!me.is_admin) return <p className="text-sm text-muted-foreground">Not available.</p>;
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  async function changePlan(userId: string, plan: "free" | "pro") {
    try {
      await setUserPlan({ data: { userId, plan } });
      toast.success("Plan updated");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the plan");
    }
  }

  const tiles = [
    { label: "Users", value: data.users },
    { label: "Pro users", value: data.plans["pro"] ?? 0 },
    { label: "Cards", value: data.cards },
    { label: "Contacts", value: data.contacts },
    { label: "Teams", value: data.orgs },
    { label: "Views (30d)", value: data.events30["view"] ?? 0 },
    { label: "Share-backs (30d)", value: data.events30["shareback"] ?? 0 },
    {
      label: "AI calls (month)",
      value: Object.values(data.ai_month).reduce((a, b) => a + b, 0),
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      <h1 className="text-3xl font-bold">Platform admin</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="surface p-4">
            <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{t.value}</p>
          </div>
        ))}
      </div>
      <section>
        <h2 className="mb-3 text-lg font-bold">Latest users</h2>
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Joined</th>
                <th className="px-4 py-2 text-right font-medium">Cards</th>
                <th className="px-4 py-2 text-right font-medium">Contacts</th>
                <th className="px-4 py-2 text-right font-medium">AI (mo)</th>
                <th className="px-4 py-2 font-medium">Plan</th>
              </tr>
            </thead>
            <tbody>
              {data.user_rows.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="max-w-56 px-4 py-2">
                    <p className="truncate font-medium">{u.display_name || "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                    {format(new Date(u.created_at), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{u.cards}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{u.contacts}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{u.ai_month}</td>
                  <td className="px-4 py-2">
                    <Select
                      value={u.plan === "pro" ? "pro" : "free"}
                      onValueChange={(v) => changePlan(u.id, v as "free" | "pro")}
                    >
                      <SelectTrigger className="h-8 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
