import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { upgradeToPremium, type BillingState } from "@/lib/billing.functions";
import {
  annualFreeMonths,
  PLAN_LIMITS,
  PREMIUM_ANNUAL_PRICE_LABEL,
  PREMIUM_PRICE_LABEL,
  premiumAnnualFreeMonths,
  PRO_ANNUAL_PRICE_LABEL,
  PRO_PRICE_LABEL,
} from "@/lib/plans";

const { pro, premium } = PLAN_LIMITS;

const NEXT = {
  pro: {
    name: "Pro",
    price: PRO_PRICE_LABEL,
    annual: PRO_ANNUAL_PRICE_LABEL,
    freeMonths: annualFreeMonths(),
    perks: [
      `${pro.scan} card scans + ${pro.follow_up} follow-up drafts a month`,
      `${pro.enrich} contact enrichments a month, plus note summaries`,
      "Unlimited share-backs, with an instant alert for each",
      `Up to ${pro.cards} cards, event mode and the Zapier webhook`,
    ],
  },
  premium: {
    name: "Premium",
    price: PREMIUM_PRICE_LABEL,
    annual: PREMIUM_ANNUAL_PRICE_LABEL,
    freeMonths: premiumAnnualFreeMonths(),
    perks: [
      `${premium.scan} card scans + ${premium.follow_up} follow-up drafts a month`,
      "Unlimited personal cards",
      "Email signatures and follow-up reminders",
      "Advanced analytics: visitors, devices, referrers and top links",
    ],
  },
} as const;

/** The one-step upgrade to the plan above the current one (free → Pro,
 *  Pro → Premium), with what it adds. A Pro subscriber switches in place;
 *  everyone else goes to Stripe Checkout. */
export function NextTierCard({
  billing,
  busy,
  onCheckout,
}: {
  billing: BillingState;
  busy: boolean;
  onCheckout: (plan: "pro" | "premium", interval: "month" | "year") => void;
}) {
  if (billing.plan === "premium") return null;
  const target = billing.plan === "free" ? "pro" : "premium";
  const t = NEXT[target];
  const monthlyReady = target === "pro" ? billing.stripeConfigured : billing.premiumConfigured;
  const annualReady = target === "pro" ? billing.annualConfigured : billing.premiumAnnualConfigured;
  const switchInPlace = billing.plan === "pro" && billing.hasSubscription;
  return (
    <div className="space-y-3 rounded-2xl border-2 border-brand/40 bg-brand-soft/30 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-bold">Upgrade to {t.name}</p>
        <p className="text-sm font-semibold">
          {t.price} <span className="font-normal text-muted-foreground">or {t.annual}</span>
        </p>
      </div>
      <ul className="space-y-1.5 text-sm">
        {t.perks.map((p) => (
          <li key={p} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            {p}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {switchInPlace ? (
          <SwitchToPremiumButton disabled={busy || !monthlyReady} />
        ) : (
          <>
            <Button disabled={busy || !monthlyReady} onClick={() => onCheckout(target, "month")}>
              <Sparkles className="h-4 w-4" />
              Upgrade to {t.name} — {t.price}
            </Button>
            {annualReady && (
              <Button
                variant="outline"
                className="border-brand"
                disabled={busy}
                onClick={() => onCheckout(target, "year")}
              >
                {t.annual} — {t.freeMonths} months free
              </Button>
            )}
          </>
        )}
      </div>
      {billing.plan === "free" && billing.premiumConfigured && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onCheckout("premium", "month")}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Or go straight to Premium — {PREMIUM_PRICE_LABEL}
        </button>
      )}
    </div>
  );
}

/** Pro subscriber → Premium on the same subscription, after a confirm. */
function SwitchToPremiumButton({ disabled }: { disabled: boolean }) {
  const qc = useQueryClient();
  const [working, setWorking] = useState(false);
  async function go() {
    setWorking(true);
    try {
      await upgradeToPremium();
      await qc.invalidateQueries({ queryKey: ["billing"] });
      toast.success("You're on Premium — enjoy!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upgrade");
    } finally {
      setWorking(false);
    }
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={disabled || working}>
          <Sparkles className="h-4 w-4" />
          {working ? "Upgrading…" : `Upgrade to Premium — ${PREMIUM_PRICE_LABEL}`}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Upgrade to Premium now?</AlertDialogTitle>
          <AlertDialogDescription>
            You'll pay the difference for the rest of this billing period today, and your renewals
            move to Premium ({PREMIUM_PRICE_LABEL}, or {PREMIUM_ANNUAL_PRICE_LABEL} if you pay
            yearly). Your card on file is used; nothing else changes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction onClick={() => void go()}>Upgrade</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
