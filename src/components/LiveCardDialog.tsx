import {
  forwardRef,
  lazy,
  Suspense,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { CreditCard, ExternalLink, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { logSiteEvent } from "@/lib/site-events";

export const DEMO_CARD_PATH = "/c/tamzyn";
const DEMO_SLUG = DEMO_CARD_PATH.split("/").pop()!;

// The QR view pulls in the QR generator, so it loads only when opened.
const DemoQr = lazy(() => import("@/components/card/DemoQr"));

/** Opens the live demo card in a popup so visitors never leave the page.
 *  The iframe loads the real public card — everything on it works — and a
 *  second tab shows the card's QR code with her photo in the middle. */
export function LiveCardDialog({ from, children }: { from: string; children: ReactNode }) {
  const [view, setView] = useState<"card" | "qr">("card");
  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) logSiteEvent("demo_click", from);
        else setView("card");
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-[94vw] max-w-sm overflow-hidden rounded-3xl border-4 border-foreground/80 p-0">
        <DialogTitle className="sr-only">Live demo card</DialogTitle>
        <div
          role="tablist"
          aria-label="Demo view"
          className="grid grid-cols-2 gap-1 border-b bg-background p-1.5 pr-12"
        >
          {(
            [
              ["card", "Card", CreditCard],
              ["qr", "QR code", QrCode],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => {
                setView(key);
                if (key === "qr") logSiteEvent("demo_click", `${from}:qr`);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                view === key
                  ? "bg-brand-soft text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        {/* Kept mounted so switching back doesn't reload the card. */}
        <iframe
          src={DEMO_CARD_PATH}
          title="Tamzyn's live ContactKickstart card"
          className={`h-[70vh] max-h-[640px] w-full border-0 ${view === "card" ? "" : "hidden"}`}
        />
        {view === "qr" && (
          <div className="flex h-[70vh] max-h-[640px] items-center justify-center overflow-y-auto">
            <Suspense fallback={null}>
              <DemoQr slug={DEMO_SLUG} />
            </Suspense>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t bg-background px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            {view === "card" ? "This is a real card — tap anything." : "Scan it with your phone."}
          </span>
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
export const LiveCardButton = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button"> & { label?: string }
>(function LiveCardButton({ label = "See a live card", ...props }, ref) {
  // Radix's DialogTrigger asChild injects onClick/aria props and a ref;
  // spreading them is what makes the trigger actually open the dialog.
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className="inline-flex items-center gap-2.5 rounded-xl border-2 border-brand bg-brand-soft/60 px-4 py-2.5 text-sm font-bold text-foreground transition-transform hover:scale-[1.03] hover:bg-brand-soft"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
      </span>
      {label}
    </button>
  );
});
