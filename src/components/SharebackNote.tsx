import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { getBillingState } from "@/lib/billing.functions";
import { FREE_SHAREBACK_LIMIT, sharebackAllowanceLine } from "@/lib/plans";

/** Free accounts: how many of their share-backs are left, and the way to
 *  unlimited. Display only; submit_shareback enforces the cap (0032). */
export function SharebackNote({ className = "" }: { className?: string }) {
  // Shares the ["billing"] cache with Settings and usePlan().
  const { data } = useQuery({ queryKey: ["billing"], queryFn: () => getBillingState() });
  const used = data?.sharebacksUsed;
  if (used === null || used === undefined) return null;
  const closed = used >= FREE_SHAREBACK_LIMIT;
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
        closed
          ? "border-amber-500/40 bg-amber-500/10 text-foreground"
          : "border-border text-muted-foreground"
      } ${className}`}
    >
      <span>{sharebackAllowanceLine(used)}</span>
      <Link
        to="/app/settings"
        className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Upgrade
      </Link>
    </div>
  );
}
