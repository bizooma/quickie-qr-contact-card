import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, ExternalLink, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { publicCardUrl, useQr } from "@/components/card/QrPanel";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import {
  MY_QR_PIN_KEY,
  myQrIconHref,
  myQrSnapshot,
  readSnapshot,
  type QrSnapshot,
} from "@/lib/quick-qr";
import { appHead } from "@/lib/seo";

// The "My QR" home-screen app: one screen, the owner's code. It has its own
// manifest (scope /my-qr), so it installs as a second icon that opens
// straight here. It reads the main app's QR snapshot from shared storage and
// draws the code on the device, so it works with no signal. Its icon opens
// /my-qr?source=icon, which is how the page knows it is already installed.

export const Route = createFileRoute("/my-qr")({
  ssr: false,
  head: appHead("My QR", "Your card's QR code, one tap from your home screen."),
  validateSearch: (s: Record<string, unknown>): { card?: string; source?: string } => ({
    ...(typeof s["card"] === "string" ? { card: s["card"] } : {}),
    ...(typeof s["source"] === "string" ? { source: s["source"] } : {}),
  }),
  component: MyQr,
});

function readPinned(): QrSnapshot | null {
  try {
    const raw = localStorage.getItem(MY_QR_PIN_KEY);
    return raw ? (JSON.parse(raw) as QrSnapshot) : null;
  } catch {
    return null;
  }
}

function MyQr() {
  const { card, source } = Route.useSearch();
  const [view] = useState(() => {
    const next = myQrSnapshot(card, readPinned(), readSnapshot());
    try {
      if (next) localStorage.setItem(MY_QR_PIN_KEY, JSON.stringify(next));
    } catch {
      // Without storage the icon still opens on the main app's last code.
    }
    return next;
  });
  const { svg } = useQr(
    view?.slug ?? "",
    view?.accent ?? "#111111",
    view?.bg ?? "#FFFFFF",
    view?.center ?? null,
  );
  const { canPrompt, promptInstall, standalone, ios } = usePwaInstall();

  async function install() {
    const outcome = await promptInstall();
    if (outcome === "accepted") toast.success("My QR is on your home screen");
  }

  if (!view) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <p className="max-w-xs text-sm text-muted-foreground">
          Open your QR code in ContactKickstart once, then come back here.{" "}
          <a href="/app/qr" className="underline">
            Open ContactKickstart
          </a>
        </p>
      </main>
    );
  }

  const url = publicCardUrl(view.slug);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-float">
        {svg ? (
          <div
            className="mx-auto w-full [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="mx-auto aspect-square w-full animate-pulse rounded-2xl bg-stone-100" />
        )}
        {view.full_name && (
          <p className="mt-4 font-display text-xl font-bold text-stone-900">{view.full_name}</p>
        )}
        {view.label && (
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: view.accent }}
          >
            {view.label}
          </p>
        )}
        <p className="mt-1 break-all text-xs text-stone-400">{url.replace(/^https?:\/\//, "")}</p>
      </div>

      {/* Installed: the icon opens ?source=icon. iPhone keeps the page's own
          address instead, and it never opens this inside the main app. */}
      {standalone && (source === "icon" || ios) ? (
        <a href="/app" className="text-xs text-muted-foreground underline">
          Open ContactKickstart
        </a>
      ) : (
        <div className="surface w-full max-w-sm p-5 text-center">
          <p className="font-semibold">Put this code on your home screen</p>
          {canPrompt ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                You'll get a My QR icon that opens straight to this code, even with no signal.
              </p>
              <Button className="mt-4 w-full" onClick={() => void install()}>
                <Download className="h-4 w-4" />
                Install My QR
              </Button>
            </>
          ) : ios ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Tap <Share className="inline h-4 w-4 align-text-bottom" /> <strong>Share</strong>,
              then <SquarePlus className="inline h-4 w-4 align-text-bottom" />{" "}
              <strong>Add to Home Screen</strong>.
            </p>
          ) : (
            <AndroidSteps slug={view.slug} standalone={standalone} />
          )}
        </div>
      )}
    </main>
  );
}

/** Where Chrome offers no install button. Opened inside the ContactKickstart
 *  app (no browser menu there), or before an installed app has picked up its
 *  narrower Android scope, Chrome treats this page as part of that app; the
 *  app's own "My QR" shortcut then makes the icon instead. */
function AndroidSteps({ slug, standalone }: { slug: string; standalone: boolean }) {
  const chromeHref = standalone
    ? myQrIconHref({ platform: "android", standalone, slug, host: window.location.host })
    : null;
  return (
    <div className="mt-2 space-y-3 text-left text-sm text-muted-foreground">
      <p>
        <strong className="text-foreground">Quickest:</strong> on your home screen, touch and hold
        the ContactKickstart icon, then drag <strong>My QR code</strong> to an empty spot. That icon
        opens straight to your code.
      </p>
      {chromeHref ? (
        <>
          <p>Or open this page in Chrome and install it from there.</p>
          <Button asChild variant="outline" className="w-full">
            <a href={chromeHref}>
              <ExternalLink className="h-4 w-4" />
              Open in Chrome
            </a>
          </Button>
        </>
      ) : (
        <p>
          Or tap Chrome's <strong>⋮</strong> menu, then <strong>Install app</strong> (or{" "}
          <strong>Add to Home screen</strong>).
        </p>
      )}
    </div>
  );
}
