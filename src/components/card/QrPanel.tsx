import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Copy, Download, Lock, Maximize2, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/components/PremiumGate";
import { supabase } from "@/integrations/supabase/client";
import { contrastText } from "@/lib/card-model";
import { signedUrls } from "@/lib/media";
import {
  BRAND_QR_CENTER,
  parseQrCenter,
  qrCenterAllowed,
  qrCenterSource,
  svgWithLogo,
  type CenterShape,
  type QrCenterChoice,
  type QrCenterSource,
} from "@/lib/qr-logo";

export function publicCardUrl(slug: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/c/${slug}`;
}

function qrColors(accent: string, bg: string) {
  // Keep a light background behind dark modules so every phone camera can read it.
  // Light accents would be unreadable, so fall back to near-black.
  void bg;
  return { dark: contrastText(accent) === "#FFFFFF" ? accent : "#111111", light: "#FFFFFF" };
}

export type QrCenterImage = { href: string; shape: CenterShape };

export function useQr(slug: string, accent: string, bg: string, center?: QrCenterImage | null) {
  const [svg, setSvg] = useState("");
  const href = center?.href ?? null;
  const shape = center?.shape ?? "rounded";
  useEffect(() => {
    const url = publicCardUrl(slug);
    const color = qrColors(accent, bg);
    // A center image hides some modules, so step error correction up to H.
    QRCode.toString(url, {
      type: "svg",
      margin: 1,
      color,
      errorCorrectionLevel: href ? "H" : "M",
    }).then((s) => setSvg(href ? svgWithLogo(s, href, shape) : s));
  }, [slug, accent, bg, href, shape]);
  return { svg };
}

const CENTER_PX = 256;

/** Downscales a stored image to a small data URL. Inlining (rather than a
 *  signed URL) keeps it inside downloaded SVG/PNG files and the offline QR
 *  snapshot; photos are center-cropped square since the QR clips them to a
 *  circle anyway. */
export async function toCenterDataUrl(signedUrl: string, photo: boolean): Promise<string> {
  const blob = await (await fetch(signedUrl)).blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not load the image"));
      img.src = objectUrl;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx || !w || !h) throw new Error("Canvas unavailable");
    if (photo) {
      const side = Math.min(w, h);
      canvas.width = canvas.height = Math.min(CENTER_PX, side);
      ctx.drawImage(
        img,
        (w - side) / 2,
        (h - side) / 2,
        side,
        side,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      return canvas.toDataURL("image/jpeg", 0.85);
    }
    const scale = Math.min(1, CENTER_PX / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read the image"));
    r.readAsDataURL(blob);
  });
}

// The badge is a static, already-optimized asset: fetch it once per page.
let brandCenter: Promise<string> | null = null;
function loadBrandCenter(url: string): Promise<string> {
  brandCenter ??= fetch(url)
    .then((r) => r.blob())
    .then(blobToDataUrl)
    .catch((e: unknown) => {
      brandCenter = null;
      throw e;
    });
  return brandCenter;
}

/** Loads the QR center image as a small inline data URL. A stored photo or
 *  logo that fails to load falls back to the ContactKickstart badge. `ready`
 *  turns true once the current source has resolved, so callers can tell
 *  "still loading" from "no image". */
export function useCenterImage(source: QrCenterSource | null | undefined) {
  const kind = source?.kind;
  const ref = source ? (source.kind === "stored" ? source.path : source.url) : "";
  const wantShape = source?.shape ?? "rounded";
  const key = kind ? `${kind}:${ref}:${wantShape}` : "";
  const [loaded, setLoaded] = useState<{
    key: string;
    href: string | null;
    shape: CenterShape;
  } | null>(null);
  useEffect(() => {
    if (!kind) return;
    let cancelled = false;
    (async () => {
      let href: string | null = null;
      let shape = wantShape;
      if (kind === "stored") {
        try {
          const signed = (await signedUrls([ref]))[ref];
          if (signed) href = await toCenterDataUrl(signed, wantShape === "circle");
        } catch {
          href = null;
        }
      }
      if (!href) {
        shape = "rounded";
        try {
          href = await loadBrandCenter(BRAND_QR_CENTER);
        } catch {
          href = null;
        }
      }
      if (!cancelled) setLoaded({ key: `${kind}:${ref}:${wantShape}`, href, shape });
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, ref, wantShape]);
  const current = !!key && loaded?.key === key;
  return {
    image: current && loaded.href ? { href: loaded.href, shape: loaded.shape } : null,
    ready: !key || current,
  };
}

function download(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
}

/** Rasterizes the (possibly logo-bearing) QR SVG to a PNG data URL. */
async function svgToPng(svg: string, size: number): Promise<string> {
  const img = new Image();
  const blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not render the QR code"));
      img.src = blobUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

const CENTER_OPTIONS: { value: QrCenterChoice | null; label: string }[] = [
  { value: null, label: "ContactKickstart" },
  { value: "photo", label: "My photo" },
  { value: "logo", label: "Logo" },
];

export function QrPanel({
  cardId,
  slug,
  accent,
  bg,
  name,
  headshotPath,
  logoPath,
  qrCenter,
}: {
  cardId: string;
  slug: string;
  accent: string;
  bg: string;
  name: string;
  headshotPath?: string | null | undefined;
  logoPath?: string | null | undefined;
  qrCenter?: string | null | undefined;
}) {
  const qc = useQueryClient();
  const { plan } = usePlan();
  const allowed = qrCenterAllowed(plan);
  const [choice, setChoice] = useState<QrCenterChoice | null>(() => parseQrCenter(qrCenter));
  const [full, setFull] = useState(false);
  const url = publicCardUrl(slug);

  const { image } = useCenterImage(qrCenterSource(choice, { headshotPath, logoPath }, plan));
  const { svg } = useQr(slug, accent, bg, image);

  async function pickCenter(next: QrCenterChoice | null) {
    if (!allowed || next === choice) return;
    const prev = choice;
    setChoice(next);
    const { error } = await supabase.from("cards").update({ qr_center: next }).eq("id", cardId);
    if (error) {
      setChoice(prev);
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["cards"] });
    qc.invalidateQueries({ queryKey: ["card", cardId] });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} — digital business card`, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    copyLink();
  }

  async function downloadPng() {
    try {
      download(await svgToPng(svg, 1024), `${slug}-qr.png`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="mx-auto w-48 rounded-2xl bg-white p-3 shadow-soft"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-center text-xs text-muted-foreground break-all">{url}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="outline" onClick={copyLink}>
          <Copy className="h-4 w-4" />
          Copy link
        </Button>
        <Button size="sm" variant="outline" onClick={share}>
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="outline" disabled={!svg} onClick={downloadPng}>
          <Download className="h-4 w-4" />
          PNG
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!svg}
          onClick={() =>
            download(
              URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })),
              `${slug}-qr.svg`,
            )
          }
        >
          <Download className="h-4 w-4" />
          SVG
        </Button>
        <Button size="sm" onClick={() => setFull(true)}>
          <Maximize2 className="h-4 w-4" />
          Full screen
        </Button>
      </div>
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold text-muted-foreground">
          Center of your QR code
          {plan && !allowed && (
            <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-foreground">
              <Lock className="h-3 w-3" />
              Pro
            </span>
          )}
        </p>
        <div
          className="inline-flex rounded-xl border p-1"
          role="radiogroup"
          aria-label="Center of your QR code"
        >
          {CENTER_OPTIONS.map((o) => {
            const missing =
              (o.value === "photo" && !headshotPath) || (o.value === "logo" && !logoPath);
            const active = allowed ? choice === o.value : o.value === null;
            return (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!allowed || missing}
                title={
                  missing
                    ? `Add ${o.value === "photo" ? "a photo" : "a logo"} to this card first`
                    : undefined
                }
                onClick={() => pickCenter(o.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  active ? "bg-brand text-white" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        {plan && !allowed && (
          <p className="text-xs text-muted-foreground">
            Swap the ContactKickstart logo for your face or company logo with{" "}
            <Link to="/app/settings" className="font-semibold text-foreground underline">
              Pro or Premium
            </Link>
            .
          </p>
        )}
      </div>
      {full && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background p-6"
          role="dialog"
          aria-label="QR code"
        >
          <button
            className="absolute right-5 top-5 rounded-full bg-muted p-3"
            onClick={() => setFull(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <p className="font-display text-2xl font-bold">{name}</p>
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-5"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p className="text-sm text-muted-foreground">Point your camera here to get my details</p>
        </div>
      )}
    </div>
  );
}
