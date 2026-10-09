import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCardPicker } from "@/components/tools/CardPicker";
import { publicCardUrl } from "@/components/card/QrPanel";
import { contrastText } from "@/lib/card-model";
import { BG_HEIGHT, BG_WIDTH, CORNERS, coverFit, layoutBadge, QR_SIZES, type Corner, type QrSize } from "@/lib/background-layout";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/background")({ component: BackgroundPage });

type Paint = (ctx: CanvasRenderingContext2D, accent: string) => void;
const linear = (stops: string[], angle: "diag" | "vert" = "diag"): Paint => (ctx) => {
  const g = angle === "diag" ? ctx.createLinearGradient(0, 0, BG_WIDTH, BG_HEIGHT) : ctx.createLinearGradient(0, 0, 0, BG_HEIGHT);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, BG_WIDTH, BG_HEIGHT);
};
// Canvas colors are user/card data, not UI theme tokens.
const BACKDROPS: { id: string; name: string; paint: Paint }[] = [
  { id: "accent", name: "Accent glow", paint: (ctx, a) => { linear(["#0F1115", "#1A1D24"])(ctx, a); const g = ctx.createRadialGradient(BG_WIDTH * 0.8, BG_HEIGHT * 0.2, 0, BG_WIDTH * 0.8, BG_HEIGHT * 0.2, 1100); g.addColorStop(0, `${a}AA`); g.addColorStop(1, `${a}00`); ctx.fillStyle = g; ctx.fillRect(0, 0, BG_WIDTH, BG_HEIGHT); } },
  { id: "accent-solid", name: "Accent", paint: (ctx, a) => linear([a, `${a}CC`])(ctx, a) },
  { id: "accent-fade", name: "Soft accent", paint: (ctx, a) => { linear(["#F7F5F2", "#ECE8E2"])(ctx, a); const g = ctx.createLinearGradient(0, BG_HEIGHT, BG_WIDTH, 0); g.addColorStop(0, `${a}55`); g.addColorStop(0.6, `${a}00`); ctx.fillStyle = g; ctx.fillRect(0, 0, BG_WIDTH, BG_HEIGHT); } },
  { id: "graphite", name: "Graphite", paint: linear(["#2A2D33", "#15171B"], "vert") },
  { id: "linen", name: "Linen", paint: linear(["#F4F1EC", "#E4DED5"], "vert") },
  { id: "slate", name: "Slate blue", paint: linear(["#3B4A5E", "#1E2733"]) },
];

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function BackgroundPage() {
  const { card, picker, hasCards, isLoading } = useCardPicker();
  const [backdrop, setBackdrop] = useState("accent");
  const [corner, setCorner] = useState<Corner>("bottom-right");
  const [size, setSize] = useState<QrSize>("M");
  const [upload, setUpload] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !card) return;
    let cancelled = false;
    const accent = /^#[0-9a-f]{6}$/i.test(card.accent_color) ? card.accent_color : "#E8553D";
    (async () => {
      const l = layoutBadge(corner, size);
      // Dark modules on white keep the code scannable regardless of accent.
      const qr = document.createElement("canvas");
      await QRCode.toCanvas(qr, publicCardUrl(card.slug), {
        width: l.qr.w, margin: 0, errorCorrectionLevel: "M",
        color: { dark: contrastText(accent) === "#FFFFFF" ? accent : "#111111", light: "#FFFFFF" },
      });
      if (cancelled) return;
      ctx.clearRect(0, 0, BG_WIDTH, BG_HEIGHT);
      if (backdrop === "upload" && upload) {
        const r = coverFit(upload.naturalWidth, upload.naturalHeight);
        ctx.drawImage(upload, r.x, r.y, r.w, r.h);
      } else {
        (BACKDROPS.find((b) => b.id === backdrop) ?? BACKDROPS[0]!).paint(ctx, accent);
      }
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 12;
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      roundRect(ctx, l.badge.x, l.badge.y, l.badge.w, l.badge.h, 28);
      ctx.fill();
      ctx.restore();
      ctx.drawImage(qr, l.qr.x, l.qr.y, l.qr.w, l.qr.h);
      ctx.textAlign = l.text.align;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#111111";
      ctx.font = "700 44px Manrope, Arial, sans-serif";
      ctx.fillText(card.full_name || "Your name", l.text.x, l.text.nameY, l.text.maxWidth);
      ctx.fillStyle = accent === "#FFFFFF" ? "#555555" : contrastText(accent) === "#FFFFFF" ? accent : "#555555";
      ctx.font = "600 30px Manrope, Arial, sans-serif";
      ctx.fillText("Scan to connect", l.text.x, l.text.labelY, l.text.maxWidth);
    })().catch(() => toast.error("Could not render the background"));
    return () => { cancelled = true; };
  }, [card, backdrop, corner, size, upload]);

  function onUpload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => { setUpload(img); setBackdrop("upload"); URL.revokeObjectURL(src); };
    img.onerror = () => toast.error("Could not read that image");
    img.src = src;
  }

  function download() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob || !card) return;
      const a = document.createElement("a");
      const href = URL.createObjectURL(blob);
      a.href = href;
      a.download = `${card.slug}-background-1920x1080.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    }, "image/png");
  }

  const chip = (active: boolean) => cn("rounded-xl border px-3 py-2 text-sm font-medium transition", active ? "border-brand ring-2 ring-ring/30" : "hover:bg-muted");

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold">Meeting background</h1>
      <p className="mt-1 text-sm text-muted-foreground">People on your call can scan the code to save your contact.</p>
      {!isLoading && !hasCards ? <p className="mt-8 text-sm">Create a card first.</p> : (
        <div className="mt-8 space-y-6">
          {picker}
          <div className="surface overflow-hidden p-2">
            <canvas ref={canvasRef} width={BG_WIDTH} height={BG_HEIGHT} className="block h-auto w-full rounded-lg" aria-label="Background preview" />
          </div>
          <div className="space-y-2"><p className="text-sm font-semibold">Backdrop</p>
            <div className="flex flex-wrap gap-2">
              {BACKDROPS.map((b) => <button key={b.id} className={chip(backdrop === b.id)} onClick={() => setBackdrop(b.id)} aria-pressed={backdrop === b.id}>{b.name}</button>)}
              {upload && <button className={chip(backdrop === "upload")} onClick={() => setBackdrop("upload")} aria-pressed={backdrop === "upload"}>My image</button>}
              <label className={cn(chip(false), "inline-flex cursor-pointer items-center gap-2")}>
                <ImagePlus className="h-4 w-4" />Upload image
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => onUpload(e.target.files?.[0])} />
              </label>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2"><p className="text-sm font-semibold">Corner</p>
              <div className="grid grid-cols-2 gap-2">{CORNERS.map((c) => <button key={c} className={chip(corner === c)} onClick={() => setCorner(c)} aria-pressed={corner === c}>{c.replace("-", " ")}</button>)}</div>
            </div>
            <div className="space-y-2"><p className="text-sm font-semibold">QR size</p>
              <div className="grid grid-cols-3 gap-2">{(Object.keys(QR_SIZES) as QrSize[]).map((s) => <button key={s} className={chip(size === s)} onClick={() => setSize(s)} aria-pressed={size === s}>{s}</button>)}</div>
            </div>
          </div>
          <Button onClick={download} disabled={!card}><Download className="h-4 w-4" />Download background (1920×1080 PNG)</Button>
          <p className="text-xs text-muted-foreground">Zoom, Meet and Teams may mirror your own preview — others see it the right way round.</p>
        </div>
      )}
    </div>
  );
}
