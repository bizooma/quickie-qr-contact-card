import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createCheckout, getBillingState } from "@/lib/billing.functions";
import {
  allowanceLine,
  creditEligible,
  formatResetDate,
  limitReachedMessage,
  PREMIUM_PRICE_LABEL,
  PRO_PRICE_LABEL,
  SCAN_UNIT_NOTE,
  topupLabel,
  type TopupPack,
  type PlanId,
  type UsageKind,
} from "@/lib/plans";

/** "37 of 100 scans left this month · resets Nov 1" under an AI action, a
 *  running-low warning from 80%, or the out-of-allowance message with a way
 *  to upgrade or top up. Display only: the server reserves usage and enforces
 *  the cap (usage.server.ts). */
export function AllowanceNote({ kind, className = "" }: { kind: UsageKind; className?: string }) {
  // Shares the ["billing"] cache with Settings and usePlan().
  const { data } = useQuery({ queryKey: ["billing"], queryFn: () => getBillingState() });
  const u = data?.usage[kind];
  if (!data || !u || u.limit === null) return null;
  const credits = creditEligible(kind) ? data.credits[kind] : 0;
  const left = Math.max(0, u.limit - u.used);
  const runningLow = left > 0 && left <= Math.ceil(u.limit * 0.2);
  const packs = creditEligible(kind) ? data.topupPacks : [];

  if (left === 0 && credits === 0) {
    return (
      <div
        role="status"
        className={`space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-foreground ${className}`}
      >
        <p className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          {limitReachedMessage(data.plan, kind)}
        </p>
        <UpgradeButtons plan={data.plan} packs={packs} />
      </div>
    );
  }
  return (
    <div className={className}>
      <p
        className={`text-xs ${runningLow ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
      >
        {left === 0
          ? `This month's allowance is used up — using your starter credits (${credits} left) · resets ${formatResetDate()}`
          : allowanceLine(kind, u.used, u.limit)}
        {left > 0 && credits > 0 && ` · +${credits} starter credits`}
        {kind === "scan" && ` · ${SCAN_UNIT_NOTE}`}
      </p>
      {runningLow && (
        <div className="mt-1.5">
          <UpgradeButtons plan={data.plan} packs={packs} />
        </div>
      )}
    </div>
  );
}

/** Straight to Stripe Checkout; Settings stays the fallback when billing isn't set up. */
function UpgradeButtons({ plan, packs }: { plan: PlanId; packs: TopupPack[] }) {
  const [busy, setBusy] = useState(false);
  const next = plan === "free" ? "pro" : "premium";
  const label =
    plan === "free" ? `Upgrade to Pro — ${PRO_PRICE_LABEL}` : `Go Premium — ${PREMIUM_PRICE_LABEL}`;
  async function go(target: "pro" | "premium" | "topup", pack?: TopupPack) {
    setBusy(true);
    try {
      const { url } = await createCheckout({
        data: { plan: target, interval: "month", ...(pack ? { pack } : {}) },
      });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
      setBusy(false);
    }
  }
  if (plan === "premium") return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy} onClick={() => void go(next)}>
        <Sparkles className="h-3.5 w-3.5" />
        {label}
      </Button>
      {packs.map((pack) => (
        <Button
          key={pack}
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => void go("topup", pack)}
        >
          Add {topupLabel(pack)}
        </Button>
      ))}
    </div>
  );
}
