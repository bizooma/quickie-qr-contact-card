import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_EDIT,
  MAX_TILT,
  MAX_ZOOM,
  MIN_ZOOM,
  clampPan,
  clampZoom,
  drawTransform,
  splitRotation,
  type PhotoEdit,
} from "@/lib/photo-edit";

// Enlarge, drag, rotate and straighten a photo inside a square frame, then
// hand back the cropped result. Used for contact photos and company logos
// (contact page, scan review) and the user's own card images.

const FRAME = 280;
const OUTPUT = 512;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Current image to start from; null opens straight on the file picker. */
  sourceUrl: string | null;
  shape: "circle" | "square";
  /** Logos keep transparency; photos are JPEG. */
  output?: "image/jpeg" | "image/png";
  onSave: (blob: Blob) => Promise<void>;
  onRemove?: (() => Promise<void>) | undefined;
};

async function loadBitmap(src: Blob | string): Promise<ImageBitmap> {
  const blob = typeof src === "string" ? await (await fetch(src)).blob() : src;
  if (!blob.type.startsWith("image/")) throw new Error("not an image");
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

export function PhotoEditor({
  open,
  onOpenChange,
  title,
  sourceUrl,
  shape,
  output = "image/jpeg",
  onSave,
  onRemove,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [edit, setEdit] = useState<PhotoEdit>(DEFAULT_EDIT);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);

  // Load the current image each time the editor opens; close releases it.
  useEffect(() => {
    if (!open) return;
    setEdit(DEFAULT_EDIT);
    setBitmap(null);
    if (!sourceUrl) return;
    let cancelled = false;
    setLoading(true);
    loadBitmap(sourceUrl)
      .then((b) => {
        if (cancelled) b.close();
        else setBitmap(b);
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't open this image to edit — choose a photo instead.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sourceUrl]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      if (!bitmap) return;
      ctx.clearRect(0, 0, size, size);
      if (output === "image/jpeg") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size, size);
      }
      const t = drawTransform(bitmap.width, bitmap.height, edit, FRAME, size);
      ctx.save();
      ctx.translate(t.tx, t.ty);
      ctx.rotate((t.rotation * Math.PI) / 180);
      ctx.scale(t.scale, t.scale);
      ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
      ctx.restore();
    },
    [bitmap, edit, output],
  );

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) draw(ctx, FRAME);
  }, [draw]);

  function update(patch: Partial<PhotoEdit>) {
    setEdit((e) => {
      const next = { ...e, ...patch, zoom: clampZoom(patch.zoom ?? e.zoom) };
      return bitmap ? { ...next, ...clampPan(bitmap.width, bitmap.height, next, FRAME) } : next;
    });
  }

  async function pickFile(file?: File) {
    if (!file) return;
    try {
      const b = await loadBitmap(file);
      bitmap?.close();
      setBitmap(b);
      setEdit(DEFAULT_EDIT);
    } catch {
      toast.error("Please choose an image file");
    }
  }

  async function save() {
    if (!bitmap) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not process the image in this browser");
      draw(ctx, OUTPUT);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, output, 0.9));
      if (!blob) throw new Error("Could not export the image");
      await onSave(blob);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the image");
    } finally {
      setBusy(false);
    }
  }

  const { quarters, tilt } = splitRotation(edit.rotation);
  const onPointerDown = (e: React.PointerEvent) => {
    if (!bitmap) return;
    drag.current = { x: e.clientX, y: e.clientY, dx: edit.dx, dy: edit.dy };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    update({ dx: d.dx + (e.clientX - d.x), dy: d.dy + (e.clientY - d.y) });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative overflow-hidden bg-muted"
            style={{ width: FRAME, height: FRAME, borderRadius: shape === "circle" ? "50%" : 16 }}
          >
            {bitmap ? (
              <canvas
                ref={canvasRef}
                width={FRAME}
                height={FRAME}
                className="touch-none cursor-grab active:cursor-grabbing"
                aria-label="Drag to reposition"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground"
              >
                <ImagePlus className="h-6 w-6" />
                {loading ? "Loading…" : "Choose a photo"}
              </button>
            )}
          </div>
          {bitmap && (
            <p className="text-xs text-muted-foreground">Drag the picture to reposition it.</p>
          )}
          <div className="w-full space-y-3">
            <label className="block space-y-1.5 text-sm">
              <span className="flex justify-between">
                <span>Enlarge</span>
                <span className="text-muted-foreground">{edit.zoom.toFixed(1)}×</span>
              </span>
              <Slider
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.05}
                value={[edit.zoom]}
                disabled={!bitmap}
                onValueChange={([z]) => update({ zoom: z ?? edit.zoom })}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="flex justify-between">
                <span>Straighten</span>
                <span className="text-muted-foreground">{Math.round(tilt)}°</span>
              </span>
              <Slider
                min={-MAX_TILT}
                max={MAX_TILT}
                step={1}
                value={[Math.round(tilt)]}
                disabled={!bitmap}
                onValueChange={([t]) => update({ rotation: quarters * 90 + (t ?? 0) })}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!bitmap}
                onClick={() => update({ rotation: edit.rotation - 90 })}
              >
                <RotateCcw className="h-4 w-4" />
                Rotate left
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!bitmap}
                onClick={() => update({ rotation: edit.rotation + 90 })}
              >
                <RotateCw className="h-4 w-4" />
                Rotate right
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!bitmap}
                onClick={() => setEdit(DEFAULT_EDIT)}
              >
                <Undo2 className="h-4 w-4" />
                Reset
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" />
                {bitmap ? "Change photo" : "Choose photo"}
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Choose a photo"
              onChange={(e) => {
                void pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          <div className="flex w-full items-center justify-between gap-2">
            {onRemove && sourceUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onRemove();
                    onOpenChange(false);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not remove the image");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Remove
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" onClick={save} disabled={!bitmap || busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
