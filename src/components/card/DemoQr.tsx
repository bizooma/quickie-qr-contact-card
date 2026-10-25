import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { signPublicCardMedia } from "@/lib/capture.functions";
import { toCenterDataUrl, useQr, type QrCenterImage } from "@/components/card/QrPanel";

type DemoCard = {
  full_name: string;
  accent_color: string;
  background_color: string;
  headshot_path: string | null;
};

/** The demo card's QR code with the owner's photo in the middle, as a Pro
 *  card shows it. Read-only: built from the public card data and its signed
 *  headshot, the same way the public card page loads them. */
export default function DemoQr({ slug }: { slug: string }) {
  const { data, isError } = useQuery({
    queryKey: ["demo-qr", slug],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data: raw, error } = await supabase.rpc("get_public_card", { _slug: slug });
      if (error || !raw) throw error ?? new Error("Card not found");
      const card = raw as unknown as DemoCard;
      let center: QrCenterImage | null = null;
      if (card.headshot_path) {
        try {
          const urls = await signPublicCardMedia({ data: { slug } });
          const signed = urls[card.headshot_path];
          if (signed) center = { href: await toCenterDataUrl(signed, true), shape: "circle" };
        } catch {
          center = null; // a plain QR still shows the feature's shape
        }
      }
      return { card, center };
    },
  });
  if (isError)
    return (
      <p className="p-10 text-center text-sm text-muted-foreground">Couldn't load the QR code.</p>
    );
  if (!data)
    return (
      <div className="flex flex-col items-center gap-4 p-8" aria-busy="true">
        <div className="aspect-square w-full max-w-[260px] animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  return <DemoQrCode slug={slug} card={data.card} center={data.center} />;
}

function DemoQrCode({
  slug,
  card,
  center,
}: {
  slug: string;
  card: DemoCard;
  center: QrCenterImage | null;
}) {
  const { svg } = useQr(slug, card.accent_color, card.background_color, center);
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
      <p className="font-display text-xl font-bold">{card.full_name}</p>
      <div
        className="aspect-square w-full max-w-[260px] rounded-3xl bg-white p-4 shadow-soft"
        // The SVG comes from the qrcode library plus our own center overlay.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-sm text-muted-foreground">Point your camera here — it opens this card.</p>
      <p className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-accent-foreground">
        Your photo or logo in the middle comes with Pro
      </p>
    </div>
  );
}
