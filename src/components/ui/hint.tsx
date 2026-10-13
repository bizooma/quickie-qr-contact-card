import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** A short hover/focus label for a control. The child must accept a ref
 *  (buttons and links do). Touch screens don't show hovers, so keep the
 *  essential explanation in visible text or the screen's tip. */
export function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-64 text-center">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
