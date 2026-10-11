import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { getBillingState } from "@/lib/billing.functions";
import { PREMIUM_PRICE_LABEL, type PlanId } from "@/lib/plans";

/** The caller's effective plan (shared react-query cache with Settings). */
export function usePlan(): { plan: PlanId | undefined; isPremium: boolean } {
  const { data } = useQuery({ queryKey: ["billing"], queryFn: () => getBillingState() });
  return { plan: data?.plan, isPremium: data?.plan === "premium" };
}

/** Upsell card shown in place of a Premium-only feature. */
export function PremiumUpsell({ feature, children }: { feature: string; children?: ReactNode }) {
  return (
    <div className="surface flex flex-col items-start gap-3 border-dashed p-5">
      <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-foreground">
        <Lock className="h-3.5 w-3.5" />
        Premium feature
      </span>
      <p className="text-sm text-muted-foreground">
        {feature} is part of Premium ({PREMIUM_PRICE_LABEL}), alongside unlimited cards and teams.
      </p>
      {children}
      <Link
        to="/app/settings"
        className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        <Sparkles className="h-4 w-4" />
        Upgrade to Premium
      </Link>
    </div>
  );
}

/** Renders children for Premium accounts and the upsell for everyone else.
 *  While the plan is still loading, renders nothing (no flash of either). */
export function PremiumGate({ feature, children }: { feature: string; children: ReactNode }) {
  const { plan, isPremium } = usePlan();
  if (!plan) return null;
  return isPremium ? <>{children}</> : <PremiumUpsell feature={feature} />;
}
