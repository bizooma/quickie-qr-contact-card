import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function publicCardUrl(slug: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/c/${slug}`;
}

function qrColors(accent: string, bg: string) {
  // Keep a light background behind dark modules so every phone camera can read it.
  const dark = bg.toUpperCase() === "#FFFFFF" || bg.toUpperCase() === "#FAF7F2" ? accent : accent;
  return { dark, light: "#FFFFFF" };
}

export function useQr(slug: string, accent: string, bg: string) {
  const [svg, setSvg] = useState("");
  const [png, setPng] = useState("");
  useEffect(() => {
    const url = publicCardUrl(slug);
    const color = qrColors(accent, bg);
    QRCode.toString(url, { type: "svg", margin: 1, color, errorCorrectionLevel: "M" }).then(setSvg);
    QRCode.toDataURL(url, { margin: 2, width: 1024, color, errorCorrectionLevel: "M" }).then(setPng);
  }, [slug, accent, bg]);
  return { svg, png };
}

function download(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
}

export function QrPanel({ slug, accent, bg, name }: { slug: string; accent: string; bg: string; name: string }) {
  const { svg, png } = useQr(slug, accent, bg);
  const [full, setFull] = useState(false);
  return (
    <div className="space-y-4">
      <div className="mx-auto w-48 rounded-2xl bg-white p-3 shadow-soft" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="text-center text-xs text-muted-foreground break-all">{publicCardUrl(slug)}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="outline" disabled={!png} onClick={() => download(png, `${slug}-qr.png`)}><Download className="h-4 w-4" />PNG</Button>
        <Button size="sm" variant="outline" disabled={!svg}
          onClick={() => download(URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })), `${slug}-qr.svg`)}><Download className="h-4 w-4" />SVG</Button>
        <Button size="sm" onClick={() => setFull(true)}><Maximize2 className="h-4 w-4" />Full screen</Button>
      </div>
      {full && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background p-6" role="dialog" aria-label="QR code">
          <button className="absolute right-5 top-5 rounded-full bg-muted p-3" onClick={() => setFull(false)} aria-label="Close"><X className="h-5 w-5" /></button>
          <p className="font-display text-2xl font-bold">{name}</p>
          <div className="w-full max-w-sm rounded-3xl bg-white p-5" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="text-sm text-muted-foreground">Point your camera here to get my details</p>
        </div>
      )}
    </div>
  );
}
