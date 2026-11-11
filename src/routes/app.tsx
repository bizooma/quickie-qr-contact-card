import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  BarChart3,
  Building2,
  CircleHelp,
  CreditCard,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { readAttribution } from "@/lib/attribution";
import { recordSignupAttribution } from "@/lib/attribution.functions";
import { trackMeta } from "@/lib/meta-pixel";
import { InstallPrompt } from "@/components/InstallPrompt";
import { FeatureTips } from "@/components/FeatureTip";
import { QrFab } from "@/components/QrFab";
import { isStandalone } from "@/hooks/use-pwa-install";
import { consumeLaunch, getOpenOnQr, shouldOpenOnQr } from "@/lib/quick-qr";
import { trackActivity } from "@/lib/activity.functions";
import { cn } from "@/lib/utils";
import { ProfileAvatar, ProfileMenu } from "@/components/ProfileMenu";
import { usePlan } from "@/components/PremiumGate";

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

type NavItem = { to: string; label: string; icon: LucideIcon; exact?: boolean };

// The mobile tab bar: these five plus the Profile tab (avatar menu).
const TABS: NavItem[] = [
  { to: "/app", label: "Cards", icon: CreditCard, exact: true },
  { to: "/app/contacts", label: "Contacts", icon: Users },
  { to: "/app/scan", label: "Scan", icon: ScanLine },
  { to: "/app/tools", label: "Tools", icon: Wrench },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
];

// Desktop sidebar groups. Settings lives in the avatar menu on every screen
// size; Team and Admin are reached from Settings on phones, and My QR has its
// own floating button there.
const WORKSPACE: NavItem[] = [
  TABS[0]!,
  TABS[1]!,
  TABS[2]!,
  { to: "/app/qr", label: "My QR", icon: QrCode },
];
const GROW: NavItem[] = [TABS[3]!, TABS[4]!, { to: "/app/org", label: "Team", icon: Building2 }];

// Top-bar title for screens outside the nav.
const TITLES: [string, string][] = [
  ["/app/settings", "Settings"],
  ["/app/roadmap", "Roadmap & requests"],
  ["/app/admin", "Admin"],
  ["/app/onboarding", "Welcome"],
  ["/app/join", "Join team"],
];

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  // First load after signup: store the attribution captured on the way in,
  // credit a referring card owner, and fire Meta's CompleteRegistration once.
  // The server skips accounts that are old or already recorded.
  useEffect(() => {
    if (!user) return;
    const flag = `ck-attrib-done:${user.id}`;
    let attrib: Record<string, string> = {};
    try {
      if (localStorage.getItem(flag)) return;
      attrib = readAttribution(localStorage);
    } catch {
      return;
    }
    recordSignupAttribution({ data: { attrib } })
      .then((r) => {
        if (r.stored) trackMeta("CompleteRegistration");
        try {
          localStorage.setItem(flag, "1");
        } catch {
          // fine — the server dedupes anyway
        }
      })
      .catch(() => {});
  }, [user]);

  // Opt-in (on the QR screen): launching the installed app opens My QR.
  useEffect(() => {
    const firstLoad = consumeLaunch();
    if (
      shouldOpenOnQr({
        enabled: getOpenOnQr(),
        standalone: isStandalone(),
        pathname: window.location.pathname,
        firstLoad,
      })
    ) {
      navigate({ to: "/app/qr", replace: true });
    }
    // Once per launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: access } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("is_admin, suspended")
          .eq("id", user!.id)
          .maybeSingle()
      ).data ?? null,
  });
  const isAdmin = access?.is_admin ?? false;

  // Presence breadcrumb for the admin dashboard (last seen + screens opened).
  // Fire-and-forget; throttled to one ping per screen per visit.
  useEffect(() => {
    if (!user) return;
    void trackActivity({ data: { path: pathname } }).catch(() => {});
  }, [user, pathname]);

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

  // Suspended accounts can sign in but nothing else: the server functions
  // and database writes are blocked independently of this screen.
  if (access?.suspended)
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="surface max-w-md space-y-4 p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="text-xl font-bold">Account suspended</h1>
          <p className="text-sm text-muted-foreground">
            Your account has been suspended and app features are unavailable. If you believe this is
            a mistake, email{" "}
            <a href="mailto:support@myaisummit.dev" className="font-semibold underline">
              support@myaisummit.dev
            </a>{" "}
            and we&apos;ll take a look.
          </p>
          <button
            type="button"
            onClick={() => void supabase.auth.signOut()}
            className="text-sm font-medium text-muted-foreground underline hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    );

  const active = (to: string, exact?: boolean) =>
    exact ? pathname === to || pathname.startsWith("/app/cards") : pathname.startsWith(to);
  const title =
    [...WORKSPACE, ...GROW].find((n) => active(n.to, n.exact))?.label ??
    TITLES.find(([to]) => pathname.startsWith(to))?.[1] ??
    "";
  const grow = isAdmin ? [...GROW, { to: "/app/admin", label: "Admin", icon: ShieldCheck }] : GROW;
  const badge = (to: string) =>
    to === "/app/contacts" && newLeads > 0 ? (newLeads > 99 ? "99+" : String(newLeads)) : null;

  return (
    <div
      // Holding the logo or a photo on a phone opened the browser's "save
      // image" menu, which feels broken inside an installed app.
      className="min-h-screen md:pl-64 [&_img]:[-webkit-touch-callout:none]"
      onContextMenu={(e) => {
        if (e.target instanceof HTMLImageElement && matchMedia("(pointer: coarse)").matches) {
          e.preventDefault();
        }
      }}
    >
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 md:flex">
        <Link to="/app" className="mb-8 px-2">
          <img src="/brand/logo-wordmark.webp" alt="ContactKickstart" className="h-10 w-auto" />
        </Link>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-7">
          <NavGroup label="Workspace" items={WORKSPACE} active={active} badge={badge} />
          <NavGroup label="Grow" items={grow} active={active} badge={badge} />
        </nav>
        <Link
          to="/help"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <CircleHelp className="h-4 w-4" />
          Help
        </Link>
      </aside>
      <TopBar title={title} />
      <main className="mx-auto max-w-5xl px-5 pb-28 pt-6 md:px-10 md:pb-14 md:pt-8">
        <FeatureTips />
        <Outlet />
      </main>
      {/* Not over the code people are scanning; its tip covers installing. */}
      {pathname !== "/app/qr" && <InstallPrompt />}
      {/* One-tap "scan me" from anywhere in the app on a phone; drag to move. */}
      {pathname !== "/app/qr" && <QrFab />}
      <nav
        aria-label="Main"
        data-tabbar
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t bg-background/90 backdrop-blur md:hidden"
      >
        {TABS.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground",
              active(n.to, n.exact) && "text-brand",
            )}
          >
            <span className="relative flex h-6 items-center">
              <n.icon className="h-5 w-5" />
              {badge(n.to) && (
                <span className="absolute -right-2.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                  {badge(n.to)}
                </span>
              )}
            </span>
            {n.label}
          </Link>
        ))}
        <div className="flex justify-center">
          <ProfileMenu
            side="top"
            trigger={
              <span
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground",
                  pathname.startsWith("/app/settings") && "text-brand",
                )}
              >
                <span className="flex h-6 items-center">
                  <ProfileAvatar className="h-6 w-6 ring-0" />
                </span>
                Profile
              </span>
            }
          />
        </div>
      </nav>
    </div>
  );
}

/** Sticky top bar: section title (logo on phones), an upgrade nudge on the
 *  free plan, and the profile avatar menu in the top-right on every screen. */
function TopBar({ title }: { title: string }) {
  const { plan } = usePlan();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-5 md:px-10">
        <Link to="/app" className="md:hidden">
          <img src="/brand/logo-wordmark.webp" alt="ContactKickstart" className="h-8 w-auto" />
        </Link>
        <p className="hidden truncate text-sm font-medium text-muted-foreground md:block">
          {title}
        </p>
        <div className="flex items-center gap-3">
          {plan === "free" && (
            <Link
              to="/app/settings"
              hash="plan"
              className="hidden items-center gap-1.5 rounded-full border border-brand/30 px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-colors hover:bg-brand-soft sm:inline-flex"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Upgrade
            </Link>
          )}
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}

function NavGroup({
  label,
  items,
  active,
  badge,
}: {
  label: string;
  items: NavItem[];
  active: (to: string, exact?: boolean) => boolean;
  badge: (to: string) => string | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      {items.map((n) => {
        const on = active(n.to, n.exact);
        return (
          <Link
            key={n.to}
            to={n.to}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
              on &&
                "bg-brand-soft text-accent-foreground hover:bg-brand-soft hover:text-accent-foreground",
            )}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
            {badge(n.to) && (
              <span className="ml-auto rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
                {badge(n.to)}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
