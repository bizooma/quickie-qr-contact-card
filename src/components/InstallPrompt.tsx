import { useState } from "react";
import { Share, SquarePlus, X, Download, MonitorDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/use-pwa-install";

const DISMISS_KEY = "ck-install-dismissed-at";
const REMIND_AFTER_DAYS = 14;

function wasDismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < REMIND_AFTER_DAYS * 864e5;
  } catch {
    return false;
  }
}

/** Dismissible banner inside /app nudging people to install the PWA. */
export function InstallPrompt() {
  const { canPrompt, promptInstall, standalone, ios } = usePwaInstall();
  const [hidden, setHidden] = useState(wasDismissedRecently);

  if (standalone || hidden) return null;
  // Nothing actionable to show: not iOS and the browser hasn't offered install.
  if (!ios && !canPrompt) return null;

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Banner simply reappears next visit.
    }
  }

  async function install() {
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      toast.success("ContactKickstart installed — find it on your home screen");
      setHidden(true);
    } else if (outcome === "dismissed") {
      dismiss();
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 px-4 md:bottom-6 md:left-auto md:right-6 md:w-96 md:px-0">
      <div className="surface relative flex items-start gap-3 border p-4 shadow-soft">
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        <img src="/brand/icon-192.png" alt="" className="mt-0.5 h-10 w-10 rounded-xl" />
        <div className="min-w-0 flex-1 pr-5">
          <p className="text-sm font-semibold">Put ContactKickstart on your home screen</p>
          {ios && !canPrompt ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Tap <Share className="inline h-3.5 w-3.5 align-text-bottom" /> <strong>Share</strong>,
              then <SquarePlus className="inline h-3.5 w-3.5 align-text-bottom" />{" "}
              <strong>Add to Home Screen</strong>. You'll get one-tap access and new-lead
              notifications.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                One-tap access, works offline, and enables new-lead notifications.
              </p>
              <Button size="sm" className="mt-2" onClick={install}>
                <Download className="h-4 w-4" />
                Install app
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Always-available install guidance for the Settings page. */
export function InstallInstructions() {
  const { canPrompt, promptInstall, standalone, ios } = usePwaInstall();

  if (standalone) {
    return (
      <p className="text-sm text-muted-foreground">
        You're using the installed app — nothing to do here. 🎉
      </p>
    );
  }
  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      {canPrompt && (
        <Button
          size="sm"
          onClick={async () => {
            const outcome = await promptInstall();
            if (outcome === "accepted") toast.success("Installed — check your home screen or dock");
          }}
        >
          <MonitorDown className="h-4 w-4" />
          Install ContactKickstart
        </Button>
      )}
      <div className="space-y-2">
        <p>
          <strong className="text-foreground">iPhone / iPad (Safari):</strong> tap{" "}
          <Share className="inline h-3.5 w-3.5 align-text-bottom" /> Share, then{" "}
          <SquarePlus className="inline h-3.5 w-3.5 align-text-bottom" /> "Add to Home Screen".
        </p>
        <p>
          <strong className="text-foreground">Android (Chrome):</strong> tap the ⋮ menu, then "Add
          to Home screen" (or "Install app").
        </p>
        <p>
          <strong className="text-foreground">Desktop (Chrome / Edge):</strong> click the install
          icon at the right end of the address bar, or use the button above.
        </p>
        <p className="text-xs">
          Installing gives you one-tap access, offline support, and push notifications when someone
          shares their details with you.
        </p>
      </div>
    </div>
  );
}
