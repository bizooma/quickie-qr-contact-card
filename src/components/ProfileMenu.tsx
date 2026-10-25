import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { CreditCard, LogOut, PlusCircle, Settings, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listCards } from "@/lib/cards-api";
import { initials } from "@/lib/card-model";
import { signedUrls } from "@/lib/media";
import { PLAN_NAMES } from "@/lib/plans";
import { usePlan } from "@/components/PremiumGate";
import { cn } from "@/lib/utils";

/** The signed-in person's name and photo. The photo is the headshot on their
 *  oldest card (private bucket, so a signed URL); otherwise their initials. */
export function useProfileIdentity() {
  const { user } = useAuth();
  // Same key and shape as Settings, so both share one cache entry.
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });
  const { data: cards } = useQuery({ queryKey: ["cards"], queryFn: listCards, enabled: !!user });
  const own = cards?.filter((c) => c.user_id === user?.id) ?? [];
  const path = own.find((c) => c.headshot_path)?.headshot_path ?? null;
  const { data: urls } = useQuery({
    queryKey: ["profile-avatar", path],
    enabled: !!path,
    staleTime: 30 * 60 * 1000, // signed URLs last longer than this
    queryFn: () => signedUrls([path]),
  });
  const name = profile?.display_name?.trim() || own[0]?.full_name?.trim() || user?.email || "";
  return {
    name,
    email: user?.email ?? "",
    photoUrl: path ? (urls?.[path] ?? null) : null,
    initials: initials(name || "?"),
  };
}

export function ProfileAvatar({ className }: { className?: string }) {
  const { name, photoUrl, initials: letters } = useProfileIdentity();
  return (
    <Avatar className={cn("h-9 w-9 ring-1 ring-border", className)}>
      {photoUrl && <AvatarImage src={photoUrl} alt={name} className="object-cover" />}
      <AvatarFallback className="bg-brand-soft text-xs font-semibold text-accent-foreground">
        {letters}
      </AvatarFallback>
    </Avatar>
  );
}

/** Profile avatar that opens the account menu: Cards, Settings, Upgrade and
 *  Top-ups. `trigger` replaces the plain avatar (the mobile tab bar uses a
 *  labelled "Profile" tab). */
export function ProfileMenu({
  trigger,
  side = "bottom",
  align = "end",
}: {
  trigger?: ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "end";
}) {
  const navigate = useNavigate();
  const { plan } = usePlan();
  const { name, email } = useProfileIdentity();
  const paidTop = plan === "premium";

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/" });
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label="Open profile menu"
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {trigger ?? <ProfileAvatar />}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        align={align}
        sideOffset={8}
        className="w-64 rounded-xl p-1.5"
      >
        <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
          <ProfileAvatar className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            {email && email !== name && (
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            )}
          </div>
          {plan && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                plan === "free" ? "bg-muted text-muted-foreground" : "bg-brand text-white",
              )}
            >
              {PLAN_NAMES[plan]}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <MenuLink to="/app" icon={<CreditCard />} label="Cards" />
        <MenuLink to="/app/settings" icon={<Settings />} label="Settings" />
        <MenuLink
          to="/app/settings"
          hash="plan"
          icon={<Sparkles className="text-brand" />}
          label={paidTop ? "Plan & billing" : "Upgrade"}
        />
        <MenuLink to="/app/settings" hash="top-ups" icon={<PlusCircle />} label="Top-ups" />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()} className="gap-3 rounded-lg px-2 py-2">
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuLink({
  to,
  hash,
  icon,
  label,
}: {
  to: "/app" | "/app/settings";
  hash?: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <DropdownMenuItem asChild className="gap-3 rounded-lg px-2 py-2">
      <Link to={to} {...(hash ? { hash } : {})}>
        {icon}
        {label}
      </Link>
    </DropdownMenuItem>
  );
}
