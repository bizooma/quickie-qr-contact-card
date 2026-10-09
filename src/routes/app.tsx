import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BarChart3, CreditCard, ScanLine, Settings, Users, Wrench } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Dashboard — SignatureSurge" },
      { name: "description", content: "Manage your cards, contacts and analytics." },
      { property: "og:title", content: "Dashboard — SignatureSurge" },
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

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);
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
        <Link to="/" className="mb-10 font-display text-lg font-bold">
          Signature<span className="text-brand">Surge</span>
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
            </Link>
          ))}
        </nav>
      </aside>
      <main className="mx-auto max-w-6xl px-5 pb-28 pt-6 md:px-10 md:pb-10 md:pt-10">
        <Outlet />
      </main>
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
            <n.icon className="h-5 w-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
