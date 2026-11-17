import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { signedUrls } from "@/lib/media";
import { parsePractice } from "@/lib/practice";
import { passShowsPhoto } from "@/lib/wallet/apple-pass";
import { createAppleWalletPass, getWalletState } from "@/lib/wallet.functions";

type WalletCard = {
  id: string;
  logo_path: string | null;
  headshot_path: string | null;
  accent_color: string;
  practice: unknown;
};

/** iPhone, iPad and Mac: the devices with Apple Wallet. */
function onAppleDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod|macintosh/i.test(navigator.userAgent);
}

function useAppleWallet(card: WalletCard | null | undefined) {
  const { data: state } = useQuery({
    queryKey: ["wallet-state"],
    queryFn: () => getWalletState(),
    staleTime: 5 * 60_000,
  });
  const [busy, setBusy] = useState(false);
  const show = !!card && !!state?.apple && onAppleDevice();

  async function add() {
    if (!card || busy) return;
    setBusy(true);
    try {
      const practice = parsePractice(card.practice);
      const withPhoto = passShowsPhoto({ headshot_path: card.headshot_path, practice });
      const urls = await signedUrls([card.logo_path, withPhoto ? card.headshot_path : null]);
      const { passImages } = await import("@/lib/wallet/pass-images");
      const images = await passImages({
        logoUrl: card.logo_path ? urls[card.logo_path] : null,
        photoUrl: withPhoto && card.headshot_path ? urls[card.headshot_path] : null,
        background: card.accent_color,
      });
      const { url } = await createAppleWalletPass({ data: { cardId: card.id, images } });
      // A real navigation to the .pkpass is what makes Safari offer "Add".
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't make your Wallet pass");
    } finally {
      setBusy(false);
    }
  }

  return { show, paid: !!state?.paid, busy, add };
}

const SUB = "Your code a double-press away, right from the lock screen.";

/** A row for the QR screen's "Get here in one tap" list. */
export function AppleWalletRow({
  card,
  rowClass,
  chipClass,
}: {
  card: WalletCard | null | undefined;
  rowClass: string;
  chipClass: string;
}) {
  const { show, paid, busy, add } = useAppleWallet(card);
  if (!show) return null;
  const body = (
    <>
      <span className={chipClass}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Add to Apple Wallet</span>
        <span className="block text-xs text-muted-foreground">
          {paid ? SUB : "Comes with Pro. " + SUB}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </>
  );
  return paid ? (
    <button type="button" className={rowClass} onClick={() => void add()} disabled={busy}>
      {body}
    </button>
  ) : (
    <Link to="/app/settings" hash="plan" className={rowClass}>
      {body}
    </Link>
  );
}

/** The card editor's Share tab: a short section with the button. */
export function AppleWalletPanel({ card }: { card: WalletCard }) {
  const { show, paid, busy, add } = useAppleWallet(card);
  if (!show) return null;
  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-display text-lg font-extrabold">Apple Wallet</h3>
        <p className="text-sm text-muted-foreground">
          {SUB} If you change this card, add it again to update the pass.
        </p>
      </div>
      {paid ? (
        <button
          type="button"
          onClick={() => void add()}
          disabled={busy}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-black px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          Add to Apple Wallet
        </button>
      ) : (
        <p className="text-sm">
          Comes with Pro.{" "}
          <Link to="/app/settings" hash="plan" className="font-semibold text-brand underline">
            See plans
          </Link>
        </p>
      )}
    </section>
  );
}
