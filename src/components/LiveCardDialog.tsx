import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { logSiteEvent } from "@/lib/site-events";

export const DEMO_CARD_PATH = "/c/tamzyn";

/** Opens the live demo card in a popup so visitors never leave the page.
 *  The iframe loads the real public card — everything on it works. */
export function LiveCardDialog({ from, children }: { from: string; children: ReactNode }) {
  return (
    <Dialog onOpenChange={(open) => open && logSiteEvent("demo_click", from)}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-[94vw] max-w-sm overflow-hidden rounded-3xl border-4 border-foreground/80 p-0">
        <DialogTitle className="sr-only">Live demo card</DialogTitle>
        <iframe
          src={DEMO_CARD_PATH}
          title="Tamzyn's live ContactKickstart card"
          className="h-[70vh] max-h-[640px] w-full border-0"
        />
        <div className="flex items-center justify-between gap-3 border-t bg-background px-4 py-2.5 text-xs text-muted-foreground">
          <span>This is a real card — tap anything.</span>
          <a
            href={DEMO_CARD_PATH}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline"
          >
            Full screen <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The flashy trigger: a live-dot button that begs to be tapped. */
export function LiveCardButton({ label = "See a live card" }: { label?: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2.5 rounded-xl border-2 border-brand bg-brand-soft/60 px-4 py-2.5 text-sm font-bold text-foreground transition-transform hover:scale-[1.03] hover:bg-brand-soft"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
      </span>
      {label}
    </button>
  );
}
