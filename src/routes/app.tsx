import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  BarChart3,
  Building2,
  CreditCard,
  ScanLine,
  Settings,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { InstallPrompt } from "@/components/InstallPrompt";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — ContactKickstart" },
      { name: "description", content: "Manage your cards, contacts and analytics." },
      { property: "og:title", content: "Dashboard — ContactKickstart" },
      { property: "og:description", content: "Manage your cards, contacts and analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppLayout,
});

const NAV = [
  { to: "/app", label: "Cards", icon: CreditCard, exact: true },
  { to: "/app/contacts", label: "Contacts", icon: Users },
  { to: "/app/scan", label: "Scan", icon: ScanLine },
  { to: "/app/tools", label: "Tools", icon: Wrench },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/settings", label: "Settings", icon: Settings },
] as const;

// Sidebar-only extras: the mobile bottom bar stays at six items, so Team (and
// Admin for platform admins) are reached from Settings on small screens.
const SIDEBAR_EXTRA = [{ to: "/app/org", label: "Team", icon: Building2 }] as const;

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  // People can share their details back at any time; surface the ones that
  // arrived since the contacts page was last opened.
  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("profiles").select("is_admin").eq("id", user!.id).maybeSingle()).data
        ?.is_admin ?? false,
  });

  const { data: newLeads = 0 } = useQuery({
    queryKey: ["new-leads"],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("contacts_seen_at")
        .eq("id", user!.id)
        .maybeSingle();
      if (!prof) return 0;
      const { count } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("source", "shareback")
        .gt("created_at", prof.contacts_seen_at);
      return count ?? 0;
    },
  });

  if (loading || !user)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );

  const active = (to: string, exact?: boolean) =>
    exact ? pathname === to || pathname.startsWith("/app/cards") : pathname.startsWith(to);

  return (
    <div className="min-h-screen md:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-sidebar p-5 md:flex">
        <Link to="/" className="mb-10">
          <img src="/brand/logo-wordmark.webp" alt="ContactKickstart" className="h-14 w-auto" />
        </Link>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                active(n.to, "exact" in n) && "bg-sidebar-accent text-foreground",
              )}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
              {n.to === "/app/contacts" && newLeads > 0 && (
                <span className="ml-auto rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
                  {newLeads > 99 ? "99+" : newLeads}
                </span>
              )}
            </Link>
          ))}
          {[
            ...SIDEBAR_EXTRA,
            ...(isAdmin ? [{ to: "/app/admin", label: "Admin", icon: ShieldCheck }] : []),
          ].map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                active(n.to) && "bg-sidebar-accent text-foreground",
              )}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="mx-auto max-w-6xl px-5 pb-28 pt-6 md:px-10 md:pb-10 md:pt-10">
        <Outlet />
      </main>
      <InstallPrompt />
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t bg-background/90 backdrop-blur md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={cn(
              "flex flex-col items-center gap-1 py-3 text-[10px] font-medium text-muted-foreground",
              active(n.to, "exact" in n) && "text-brand",
            )}
          >
            <span className="relative">
              <n.icon className="h-5 w-5" />
              {n.to === "/app/contacts" && newLeads > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                  {newLeads > 99 ? "99+" : newLeads}
                </span>
              )}
            </span>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
