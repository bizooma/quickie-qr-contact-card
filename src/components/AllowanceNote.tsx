import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { getBillingState } from "@/lib/billing.functions";
import {
  allowanceLine,
  creditEligible,
  formatResetDate,
  limitReachedMessage,
  SCAN_UNIT_NOTE,
  type UsageKind,
} from "@/lib/plans";

/** "37 of 100 scans left this month · resets Nov 1" under an AI action, or
 *  the out-of-allowance message once it's used up. Display only: the server
 *  counts usage and enforces the cap (usage.server.ts). */
export function AllowanceNote({ kind, className = "" }: { kind: UsageKind; className?: string }) {
  // Shares the ["billing"] cache with Settings and usePlan().
  const { data } = useQuery({ queryKey: ["billing"], queryFn: () => getBillingState() });
  const u = data?.usage[kind];
  if (!data || !u || u.limit === null) return null;
  const credits = creditEligible(kind) ? data.credits[kind] : 0;
  const left = Math.max(0, u.limit - u.used);

  if (left === 0 && credits === 0) {
    return (
      <p
        role="status"
        className={`flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-foreground ${className}`}
      >
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
        {limitReachedMessage(data.plan, kind)}
      </p>
    );
  }
  return (
    <p className={`text-xs text-muted-foreground ${className}`}>
      {left === 0
        ? `This month's allowance is used up — using your starter credits (${credits} left) · resets ${formatResetDate()}`
        : allowanceLine(kind, u.used, u.limit)}
      {left > 0 && credits > 0 && ` · +${credits} starter credits`}
      {kind === "scan" && ` · ${SCAN_UNIT_NOTE}`}
    </p>
  );
}
