import { appHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { listCards } from "@/lib/cards-api";
import { publicCardUrl } from "@/components/card/QrPanel";
import {
  backdropPresets,
  BG_HEIGHT,
  BG_WIDTH,
  CORNERS,
  coverFit,
  panelLayout,
  QR_SIZES,
  type CornerId,
  type QrSizeId,
} from "@/lib/background";

export const Route = createFileRoute("/app/tools/background")({ head: appHead('Meeting background', "Make a video-call background with your card's QR code."), component: BackgroundPage });

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function BackgroundPage() {
  const { data: cards } = useQuery({ queryKey: ["cards"], queryFn: listCards });
  const [cardId, setCardId] = useState<string | null>(null);
  const [corner, setCorner] = useState<CornerId>("br");
  const [sizeId, setSizeId] = useState<QrSizeId>("m");
  const [backdropId, setBackdropId] = useState("accent");
  const [custom, setCustom] = useState<HTMLImageElement | null>(null);
  const [preview, setPreview] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const card = (cards ?? []).find((c) => c.id === (cardId ?? cards?.[0]?.id)) ?? null;
  const presets = backdropPresets(card?.accent_color ?? "#E8553D");

  useEffect(() => {
    if (!card) return;
    let cancelled = false;
    (async () => {
      const canvas = (canvasRef.current ??= document.createElement("canvas"));
      canvas.width = BG_WIDTH;
      canvas.height = BG_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Backdrop
      if (backdropId === "custom" && custom) {
        const { sx, sy, sw, sh } = coverFit(custom.naturalWidth, custom.naturalHeight);
        ctx.drawImage(custom, sx, sy, sw, sh, 0, 0, BG_WIDTH, BG_HEIGHT);
      } else {
        const preset = presets.find((p) => p.id === backdropId) ?? presets[0]!;
        if (preset.type === "solid") {
          ctx.fillStyle = preset.color;
        } else {
          const g = ctx.createLinearGradient(0, 0, BG_WIDTH, BG_HEIGHT);
          g.addColorStop(0, preset.from);
          g.addColorStop(1, preset.to);
          ctx.fillStyle = g;
        }
        ctx.fillRect(0, 0, BG_WIDTH, BG_HEIGHT);
      }

      // QR panel
      const layout = panelLayout(corner, sizeId);
      const qrPng = await QRCode.toDataURL(publicCardUrl(card.slug), {
        margin: 1,
        width: layout.qr.size * 2,
        color: { dark: "#111111", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
      const qrImg = await loadImage(qrPng);
      if (cancelled) return;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = "#ffffff";
      roundedRect(
        ctx,
        layout.panel.x,
        layout.panel.y,
        layout.panel.w,
        layout.panel.h,
        layout.panel.radius,
      );
      ctx.fill();
      ctx.restore();

      ctx.drawImage(qrImg, layout.qr.x, layout.qr.y, layout.qr.size, layout.qr.size);
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#111827";
      ctx.font = "bold 26px ui-sans-serif, system-ui, Arial";
      ctx.fillText(card.full_name, layout.label.x, layout.label.y, layout.label.w);
      ctx.fillStyle = "#6b7280";
      ctx.font = "17px ui-sans-serif, system-ui, Arial";
      ctx.fillText("Scan to connect", layout.label.x, layout.label.y + 32, layout.label.w);

      if (!cancelled) setPreview(canvas.toDataURL("image/png"));
    })().catch(() => toast.error("Could not render the background"));
    return () => {
      cancelled = true;
    };
    // presets derives from card, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, corner, sizeId, backdropId, custom]);

  async function onUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    try {
      const img = await loadImage(URL.createObjectURL(file));
      setCustom(img);
      setBackdropId("custom");
    } catch {
      toast.error("Could not read that image");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function download() {
    if (!preview || !card) return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = `${card.slug}-background.png`;
    a.click();
  }

  if (cards && !cards.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Create a card first — the background carries its QR code.{" "}
        <Link to="/app" className="underline">
          Go to cards
        </Link>
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/app/tools"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Tools
      </Link>
      <h1 className="mb-1 text-2xl font-bold">Virtual background</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        A 1920×1080 backdrop for Zoom, Meet, or Teams with your card's QR code — meetings become
        contact capture too.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => onUpload(e.target.files)}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="bg-card">Card</Label>
          <select
            id="bg-card"
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={card?.id ?? ""}
            onChange={(e) => setCardId(e.target.value)}
          >
            {(cards ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} — {c.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>QR position &amp; size</Label>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Corner"
              className="rounded-xl border bg-background px-3 py-2 text-sm"
              value={corner}
              onChange={(e) => setCorner(e.target.value as CornerId)}
            >
              {CORNERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              {QR_SIZES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSizeId(s.id)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium ${sizeId === s.id ? "border-brand bg-brand-soft" : "hover:bg-muted"}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 space-y-1">
        <Label>Backdrop</Label>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => setBackdropId(p.id)}
              className={`h-10 w-16 rounded-lg border-2 ${backdropId === p.id ? "border-brand" : "border-transparent"}`}
              style={{
                background:
                  p.type === "solid" ? p.color : `linear-gradient(135deg, ${p.from}, ${p.to})`,
              }}
              title={p.name}
              aria-label={p.name}
            />
          ))}
          <button
            onClick={() => (custom ? setBackdropId("custom") : fileRef.current?.click())}
            className={`flex h-10 items-center gap-2 rounded-lg border-2 px-3 text-sm ${backdropId === "custom" ? "border-brand" : "border-dashed"}`}
          >
            <Upload className="h-4 w-4" />
            {custom ? "Your image" : "Upload"}
          </button>
          {custom && backdropId === "custom" && (
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              Change image
            </Button>
          )}
        </div>
      </div>

      {preview ? (
        <img
          src={preview}
          alt="Background preview"
          className="mb-4 w-full rounded-xl border shadow-sm"
        />
      ) : (
        <div className="mb-4 aspect-video w-full animate-pulse rounded-xl bg-muted" />
      )}

      <Button onClick={download} disabled={!preview}>
        <Download className="h-4 w-4" />
        Download background (1920×1080 PNG)
      </Button>
    </div>
  );
}
