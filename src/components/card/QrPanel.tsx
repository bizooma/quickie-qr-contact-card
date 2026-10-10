import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, Maximize2, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { contrastText } from "@/lib/card-model";
import { signedUrls } from "@/lib/media";
import { svgWithLogo } from "@/lib/qr-logo";

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

export function useQr(slug: string, accent: string, bg: string, logoDataUrl?: string | null) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    const url = publicCardUrl(slug);
    const color = qrColors(accent, bg);
    // A center logo hides some modules, so step error correction up to H.
    QRCode.toString(url, {
      type: "svg",
      margin: 1,
      color,
      errorCorrectionLevel: logoDataUrl ? "H" : "M",
    }).then((s) => setSvg(logoDataUrl ? svgWithLogo(s, logoDataUrl) : s));
  }, [slug, accent, bg, logoDataUrl]);
  return { svg };
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

export function QrPanel({ slug, accent, bg, name, logoPath }: { slug: string; accent: string; bg: string; name: string; logoPath?: string | null | undefined }) {
  const [withLogo, setWithLogo] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const url = publicCardUrl(slug);

  // Inline the logo as a data URL so it survives inside downloaded SVG/PNG files.
  useEffect(() => {
    if (!withLogo || !logoPath) {
      setLogoDataUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const signed = (await signedUrls([logoPath]))[logoPath];
        if (!signed) return;
        const blob = await (await fetch(signed)).blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
        if (!cancelled) setLogoDataUrl(dataUrl);
      } catch {
        if (!cancelled) {
          setWithLogo(false);
          toast.error("Couldn't load your logo for the QR code");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [withLogo, logoPath]);

  const { svg } = useQr(slug, accent, bg, withLogo ? logoDataUrl : null);

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
      {logoPath && (
        <div className="flex items-center justify-center gap-2">
          <Switch id="qr-logo" checked={withLogo} onCheckedChange={setWithLogo} />
          <Label htmlFor="qr-logo" className="text-sm text-muted-foreground">
            Logo in the middle
          </Label>
        </div>
      )}
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
