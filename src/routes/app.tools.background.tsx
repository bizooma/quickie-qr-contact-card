import { appHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpLeft,
  ArrowUpRight,
  Building2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  QrCode,
  RotateCcw,
  Trash2,
  Type,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { listCards, type CardRow } from "@/lib/cards-api";
import { signedUrls } from "@/lib/media";
import { publicCardUrl } from "@/components/card/QrPanel";
import {
  backdropPresets,
  BG_HEIGHT,
  BG_WIDTH,
  captionColors,
  clampPosition,
  defaultDesign,
  fillFromBackdrop,
  layerBox,
  layerSize,
  moveLayer,
  newImageLayer,
  newTextLayer,
  resizeLayer,
  shade,
  sizeRange,
  snapPosition,
  type Box,
  type Design,
  type Fill,
  type ImageShape,
  type Layer,
  type Placement,
} from "@/lib/background";
import { canvasBlob, loadImage, renderDesign, type DesignAssets } from "@/lib/background-render";

export const Route = createFileRoute("/app/tools/background")({
  head: appHead("Meeting background", "Make a video-call background with your card's QR code."),
  component: BackgroundPage,
});

const PLACEMENTS: { id: Placement; label: string; icon: typeof ArrowUpLeft }[] = [
  { id: "tl", label: "Top left", icon: ArrowUpLeft },
  { id: "tr", label: "Top right", icon: ArrowUpRight },
  { id: "center", label: "Center", icon: Crosshair },
  { id: "bl", label: "Bottom left", icon: ArrowDownLeft },
  { id: "br", label: "Bottom right", icon: ArrowDownRight },
];

const SHAPES: { id: ImageShape; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "circle", label: "Circle" },
];

async function loadStoredImage(path: string): Promise<HTMLImageElement> {
  const signed = (await signedUrls([path]))[path];
  if (!signed) throw new Error("Image unavailable");
  // Fetch as a blob so the canvas stays exportable (no cross-origin taint).
  const blob = await (await fetch(signed)).blob();
  return loadImage(URL.createObjectURL(blob));
}

function sameFill(a: Fill, b: Fill) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function layerName(l: Layer): string {
  if (l.kind === "qr") return "QR code";
  if (l.kind === "image") return l.name;
  return l.text.split("\n")[0]?.trim() || "Text";
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${value === o.id ? "bg-brand-soft text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="color"
        aria-label={label}
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-11 cursor-pointer rounded-lg border bg-transparent p-0.5"
      />
      <Input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value);
        }}
        className="h-9 w-28 font-mono text-xs uppercase"
        aria-label={`${label} hex`}
      />
      <span className="text-muted-foreground">{label}</span>
    </label>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{format ? format(value) : value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0] ?? value)}
        aria-label={label}
      />
    </div>
  );
}

function BackgroundPage() {
  const { data: cards } = useQuery({ queryKey: ["cards"], queryFn: listCards });
  const [cardId, setCardId] = useState<string | null>(null);
  const card = (cards ?? []).find((c) => c.id === (cardId ?? cards?.[0]?.id)) ?? null;
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
    <div className="mx-auto max-w-2xl lg:max-w-6xl">
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
        contact capture too. Drag anything on the preview to move it.
      </p>
      {card ? (
        <Studio key={card.id} card={card} cards={cards ?? []} onCardChange={setCardId} />
      ) : (
        <div className="aspect-video w-full animate-pulse rounded-xl bg-muted" />
      )}
    </div>
  );
}

function Studio({
  card,
  cards,
  onCardChange,
}: {
  card: CardRow;
  cards: CardRow[];
  onCardChange: (id: string) => void;
}) {
  const accent = card.accent_color || "#E8553D";
  const presets = useMemo(() => backdropPresets(accent).map(fillFromBackdrop), [accent]);
  const [design, setDesign] = useState<Design>(() => defaultDesign(accent));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  const [qr, setQr] = useState<HTMLImageElement | null>(null);
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [adding, setAdding] = useState<"logo" | "photo" | null>(null);
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const drag = useRef<{
    id: string;
    pointer: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    scale: number;
  } | null>(null);

  const assets: DesignAssets = useMemo(
    () => ({ photo, qr, images, name: card.full_name }),
    [photo, qr, images, card.full_name],
  );
  const selected = design.layers.find((l) => l.id === selectedId) ?? null;

  // QR code for this card, rendered once at the largest size the editor allows.
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(publicCardUrl(card.slug), {
      margin: 2,
      width: 1040,
      color: { dark: "#111111", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then(loadImage)
      .then((img) => !cancelled && setQr(img))
      .catch(() => toast.error("Could not draw the QR code"));
    return () => {
      cancelled = true;
    };
  }, [card.slug]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const frame = requestAnimationFrame(() => setBoxes(renderDesign(ctx, design, assets)));
    return () => cancelAnimationFrame(frame);
  }, [design, assets]);

  function updateLayer(id: string, patch: Partial<Layer>) {
    setDesign((d) => ({
      ...d,
      layers: d.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)),
    }));
  }

  function addLayer(layer: Layer, img?: HTMLImageElement) {
    if (img) setImages((m) => ({ ...m, [layer.id]: img }));
    setDesign((d) => ({ ...d, layers: [...d.layers, layer] }));
    setSelectedId(layer.id);
  }

  async function addStored(role: "logo" | "photo") {
    const existing = design.layers.find((l) => l.kind === "image" && l.role === role);
    if (existing) {
      updateLayer(existing.id, { visible: true });
      setSelectedId(existing.id);
      return;
    }
    const path = role === "logo" ? card.logo_path : card.headshot_path;
    if (!path) return;
    setAdding(role);
    try {
      const img = await loadStoredImage(path);
      addLayer(
        newImageLayer(
          role,
          role === "logo" ? "Company logo" : "My photo",
          img.naturalWidth / img.naturalHeight,
        ),
        img,
      );
    } catch {
      toast.error(`Could not load your ${role === "logo" ? "logo" : "photo"}`);
    } finally {
      setAdding(null);
    }
  }

  async function onImageFile(files: FileList | null, as: "backdrop" | "layer") {
    const file = files?.[0];
    if (photoInput.current) photoInput.current.value = "";
    if (imageInput.current) imageInput.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    try {
      const img = await loadImage(URL.createObjectURL(file));
      if (as === "backdrop") {
        setPhoto(img);
        setDesign((d) => ({ ...d, fill: { type: "photo", dim: 0.2, blur: 0 } }));
      } else {
        const name = file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Picture";
        addLayer(newImageLayer("upload", name, img.naturalWidth / img.naturalHeight), img);
      }
    } catch {
      toast.error("Could not read that image");
    }
  }

  function addText() {
    const base =
      design.fill.type === "solid"
        ? design.fill.color
        : design.fill.type === "gradient"
          ? design.fill.from
          : "#000000";
    addLayer(newTextLayer(card.job_title || card.company || "Your text", captionColors(base).name));
  }

  function setFillType(type: Fill["type"]) {
    const f = design.fill;
    if (type === f.type) return;
    if (type === "photo") {
      if (photo) setDesign((d) => ({ ...d, fill: { type: "photo", dim: 0.2, blur: 0 } }));
      else photoInput.current?.click();
      return;
    }
    const base = f.type === "solid" ? f.color : f.type === "gradient" ? f.from : accent;
    setDesign((d) => ({
      ...d,
      fill:
        type === "solid"
          ? { type: "solid", color: base }
          : { type: "gradient", from: base, to: shade(base, 0.35), angle: 135 },
    }));
  }

  function setFill(fill: Fill) {
    setDesign((d) => ({ ...d, fill }));
  }

  function removeLayer(id: string) {
    setDesign((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id) }));
    setSelectedId(null);
  }

  function boxFor(l: Layer): Box {
    return boxes[l.id] ?? layerBox(l);
  }

  function place(l: Layer, where: Placement) {
    const b = boxFor(l);
    updateLayer(l.id, snapPosition(where, b.w, b.h));
  }

  function onPointerDown(e: React.PointerEvent, l: Layer) {
    const stage = stageRef.current;
    if (!stage) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(l.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      id: l.id,
      pointer: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: l.x,
      origY: l.y,
      scale: BG_WIDTH / stage.clientWidth,
    };
  }

  function onPointerMove(e: React.PointerEvent, l: Layer) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId || d.id !== l.id) return;
    const b = boxFor(l);
    updateLayer(
      l.id,
      clampPosition({
        x: d.origX + (e.clientX - d.startX) * d.scale,
        y: d.origY + (e.clientY - d.startY) * d.scale,
        w: b.w,
        h: b.h,
      }),
    );
  }

  function endDrag(e: React.PointerEvent) {
    if (drag.current?.pointer === e.pointerId) drag.current = null;
  }

  async function exportPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setExporting("png");
    try {
      downloadBlob(await canvasBlob(canvas, "image/png"), `${card.slug}-background.png`);
    } catch {
      toast.error("Could not export the image");
    } finally {
      setExporting(null);
    }
  }

  async function exportPdf() {
    setExporting("pdf");
    try {
      const { designToPdf } = await import("@/lib/background-pdf");
      downloadBlob(await designToPdf(design, assets), `${card.slug}-background-canva.pdf`);
      toast.success("Downloaded — import the PDF into Canva to edit it there");
    } catch {
      toast.error("Could not build the PDF");
    } finally {
      setExporting(null);
    }
  }

  const fill = design.fill;
  const hasLogo = !!card.logo_path;
  const hasPhoto = !!card.headshot_path;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void onImageFile(e.target.files, "backdrop")}
      />
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void onImageFile(e.target.files, "layer")}
      />

      {/* Preview: sticky so it stays in view while editing on a phone. */}
      <div className="sticky top-0 z-20 -mx-1 bg-background px-1 pb-3 pt-2 lg:top-6 lg:pt-0">
        <div
          ref={stageRef}
          className="relative w-full select-none overflow-hidden rounded-xl border shadow-sm"
          onPointerDown={() => setSelectedId(null)}
        >
          <canvas
            ref={canvasRef}
            width={BG_WIDTH}
            height={BG_HEIGHT}
            className="block aspect-video w-full"
            aria-label="Background preview"
          />
          {design.layers.map((l) => {
            if (!l.visible) return null;
            const b = boxFor(l);
            const active = l.id === selectedId;
            return (
              <button
                key={l.id}
                type="button"
                aria-label={`Move ${layerName(l)}`}
                className={`absolute cursor-move touch-none rounded-sm ${active ? "outline outline-2 outline-offset-2 outline-brand" : "hover:outline hover:outline-1 hover:outline-white/70"}`}
                style={{
                  left: `${(b.x / BG_WIDTH) * 100}%`,
                  top: `${(b.y / BG_HEIGHT) * 100}%`,
                  width: `${(b.w / BG_WIDTH) * 100}%`,
                  height: `${(b.h / BG_HEIGHT) * 100}%`,
                }}
                onPointerDown={(e) => onPointerDown(e, l)}
                onPointerMove={(e) => onPointerMove(e, l)}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-4 space-y-6 lg:mt-0">
        <div className="space-y-1">
          <Label htmlFor="bg-card">Card</Label>
          <select
            id="bg-card"
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={card.id}
            onChange={(e) => onCardChange(e.target.value)}
          >
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} — {c.full_name}
              </option>
            ))}
          </select>
        </div>

        <section className="space-y-3">
          <h2 className="font-semibold">Background</h2>
          <div className="flex flex-wrap gap-2">
            {presets.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setFill(p)}
                className={`h-10 w-14 rounded-lg border-2 ${sameFill(fill, p) ? "border-brand" : "border-transparent"}`}
                style={{
                  background:
                    p.type === "solid"
                      ? p.color
                      : p.type === "gradient"
                        ? `linear-gradient(${p.angle}deg, ${p.from}, ${p.to})`
                        : undefined,
                }}
                aria-label={`Preset ${i + 1}`}
              />
            ))}
          </div>
          <Segmented
            value={fill.type}
            onChange={setFillType}
            options={[
              { id: "solid", label: "Color" },
              { id: "gradient", label: "Gradient" },
              { id: "photo", label: "Photo" },
            ]}
          />
          {fill.type === "solid" && (
            <div className="space-y-2">
              <ColorField
                label="Color"
                value={fill.color}
                onChange={(c) => setFill({ ...fill, color: c })}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFill({ ...fill, color: accent })}
              >
                <span className="h-3 w-3 rounded-full" style={{ background: accent }} />
                Use my card color
              </Button>
            </div>
          )}
          {fill.type === "gradient" && (
            <div className="space-y-3">
              <ColorField
                label="From"
                value={fill.from}
                onChange={(c) => setFill({ ...fill, from: c })}
              />
              <ColorField
                label="To"
                value={fill.to}
                onChange={(c) => setFill({ ...fill, to: c })}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFill({ ...fill, from: fill.to, to: fill.from })}
                >
                  Swap colors
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFill({ ...fill, from: shade(accent, -0.55), to: shade(accent, -0.15) })
                  }
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: accent }} />
                  Card colors
                </Button>
              </div>
              <SliderField
                label="Angle"
                value={fill.angle}
                min={0}
                max={360}
                format={(v) => `${v}°`}
                onChange={(v) => setFill({ ...fill, angle: v })}
              />
            </div>
          )}
          {fill.type === "photo" && (
            <div className="space-y-3">
              <Button variant="outline" size="sm" onClick={() => photoInput.current?.click()}>
                <Upload className="h-4 w-4" />
                Change photo
              </Button>
              <SliderField
                label="Darken"
                value={Math.round(fill.dim * 100)}
                min={0}
                max={80}
                format={(v) => `${v}%`}
                onChange={(v) => setFill({ ...fill, dim: v / 100 })}
              />
              <SliderField
                label="Blur"
                value={fill.blur}
                min={0}
                max={20}
                onChange={(v) => setFill({ ...fill, blur: v })}
              />
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Add to background</h2>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => void addStored("logo")}
              disabled={!hasLogo || adding === "logo"}
            >
              {adding === "logo" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
              Company logo
            </Button>
            <Button
              variant="outline"
              onClick={() => void addStored("photo")}
              disabled={!hasPhoto || adding === "photo"}
            >
              {adding === "photo" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserRound className="h-4 w-4" />
              )}
              My photo
            </Button>
            <Button variant="outline" onClick={addText}>
              <Type className="h-4 w-4" />
              Text
            </Button>
            <Button variant="outline" onClick={() => imageInput.current?.click()}>
              <ImagePlus className="h-4 w-4" />
              Picture
            </Button>
          </div>
          {(!hasLogo || !hasPhoto) && (
            <p className="text-xs text-muted-foreground">
              {!hasLogo && !hasPhoto
                ? "Add a logo and photo to this card"
                : !hasLogo
                  ? "Add a company logo to this card"
                  : "Add a photo to this card"}{" "}
              to place {!hasLogo && !hasPhoto ? "them" : "it"} with one tap —{" "}
              <Link to="/app/cards/$id" params={{ id: card.id }} className="underline">
                edit card
              </Link>
              .
            </p>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Layers</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDesign(defaultDesign(accent));
                setSelectedId(null);
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
          <ul className="divide-y rounded-xl border">
            {[...design.layers].reverse().map((l) => (
              <li key={l.id}>
                <div
                  className={`flex items-center gap-2 px-3 py-2 ${l.id === selectedId ? "bg-brand-soft" : ""}`}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                    onClick={() => setSelectedId(l.id === selectedId ? null : l.id)}
                  >
                    {l.kind === "qr" ? (
                      <QrCode className="h-4 w-4 shrink-0" />
                    ) : l.kind === "text" ? (
                      <Type className="h-4 w-4 shrink-0" />
                    ) : l.role === "logo" ? (
                      <Building2 className="h-4 w-4 shrink-0" />
                    ) : l.role === "photo" ? (
                      <UserRound className="h-4 w-4 shrink-0" />
                    ) : (
                      <ImagePlus className="h-4 w-4 shrink-0" />
                    )}
                    <span
                      className={`truncate ${l.visible ? "" : "text-muted-foreground line-through"}`}
                    >
                      {layerName(l)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    onClick={() => updateLayer(l.id, { visible: !l.visible })}
                    aria-label={l.visible ? `Hide ${layerName(l)}` : `Show ${layerName(l)}`}
                  >
                    {l.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                </div>
                {l.id === selectedId && selected && (
                  <LayerEditor
                    layer={selected}
                    box={boxFor(selected)}
                    accent={accent}
                    onChange={(patch) => updateLayer(selected.id, patch)}
                    onReplace={(next) => updateLayer(selected.id, next)}
                    onPlace={(where) => place(selected, where)}
                    onMove={(dir) =>
                      setDesign((d) => ({ ...d, layers: moveLayer(d.layers, selected.id, dir) }))
                    }
                    onRemove={selected.kind === "qr" ? undefined : () => removeLayer(selected.id)}
                  />
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Tap a layer to edit it, or drag it on the preview.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Download</h2>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Button onClick={() => void exportPng()} disabled={!!exporting || !qr}>
              {exporting === "png" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download PNG (1920×1080)
            </Button>
            <Button
              variant="outline"
              onClick={() => void exportPdf()}
              disabled={!!exporting || !qr}
            >
              {exporting === "pdf" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download for Canva (PDF)
            </Button>
          </div>
          <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Edit it in Canva</p>
            Download for Canva, then in Canva choose <strong>
              Create a design → Import file
            </strong>{" "}
            and pick the PDF. Your text stays editable, and the logo, photos, QR code and backdrop
            come in as separate pieces you can move, resize or swap.{" "}
            <a
              href="https://www.canva.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              Open Canva <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

function LayerEditor({
  layer,
  box,
  accent,
  onChange,
  onReplace,
  onPlace,
  onMove,
  onRemove,
}: {
  layer: Layer;
  box: Box;
  accent: string;
  onChange: (patch: Partial<Layer>) => void;
  onReplace: (next: Layer) => void;
  onPlace: (where: Placement) => void;
  onMove: (dir: 1 | -1) => void;
  onRemove?: (() => void) | undefined;
}) {
  const range = sizeRange(layer);
  return (
    <div className="space-y-4 border-t bg-muted/30 px-3 py-4">
      {layer.kind === "text" && (
        <div className="space-y-3">
          <Textarea
            value={layer.text}
            rows={2}
            onChange={(e) => onChange({ text: e.target.value })}
            aria-label="Text"
          />
          <ColorField
            label="Text color"
            value={layer.color}
            onChange={(c) => onChange({ color: c })}
          />
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <Switch checked={layer.bold} onCheckedChange={(v) => onChange({ bold: v })} />
              Bold
            </label>
            <label className="flex items-center gap-2">
              <Switch checked={layer.shadow} onCheckedChange={(v) => onChange({ shadow: v })} />
              Shadow
            </label>
          </div>
        </div>
      )}
      {layer.kind === "image" && (
        <div className="space-y-3">
          <Segmented
            value={layer.shape}
            options={SHAPES}
            onChange={(shape) => onReplace(resizeLayer({ ...layer, shape }, layer.w, box))}
          />
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={layer.plate} onCheckedChange={(v) => onChange({ plate: v })} />
            White backing
          </label>
        </div>
      )}
      {layer.kind === "qr" && (
        <div className="space-y-3">
          <ColorField
            label="Frame color"
            value={layer.panel}
            onChange={(c) => onChange({ panel: c })}
          />
          <div className="flex gap-2">
            {[
              { name: "White", c: "#FFFFFF" },
              { name: "Black", c: "#111111" },
              { name: "Card color", c: accent },
            ].map(({ name, c }) => (
              <Button key={name} variant="outline" size="sm" onClick={() => onChange({ panel: c })}>
                <span className="h-3 w-3 rounded-full border" style={{ background: c }} />
                {name}
              </Button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={layer.caption}
              onCheckedChange={(v) => {
                const next = { ...layer, caption: v };
                const b = layerBox(next);
                onReplace({ ...next, ...clampPosition(b) });
              }}
            />
            Show my name under the code
          </label>
        </div>
      )}
      <SliderField
        label="Size"
        value={layerSize(layer)}
        min={range.min}
        max={range.max}
        onChange={(v) => onReplace(resizeLayer(layer, v, box))}
      />
      <SliderField
        label="Opacity"
        value={Math.round(layer.opacity * 100)}
        min={10}
        max={100}
        format={(v) => `${v}%`}
        onChange={(v) => onChange({ opacity: v / 100 })}
      />
      <div className="flex flex-wrap items-center gap-1">
        {PLACEMENTS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant="outline"
            size="icon"
            onClick={() => onPlace(id)}
            aria-label={label}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
        <span className="mx-1 h-6 w-px bg-border" />
        <Button
          variant="outline"
          size="icon"
          onClick={() => onMove(1)}
          aria-label="Bring forward"
          title="Bring forward"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onMove(-1)}
          aria-label="Send back"
          title="Send back"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        {onRemove && (
          <Button
            variant="outline"
            size="icon"
            onClick={onRemove}
            aria-label="Delete layer"
            title="Delete layer"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
