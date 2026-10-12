import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { scanMyCard } from "@/lib/ai.functions";
import { SELF_SCAN_IMAGE_LIMIT } from "@/lib/ai-model";
import { cropCardImage, prepareImage, type PreparedImage } from "@/lib/image-prep";
import { uploadCardImage } from "@/lib/media";
import { ownCardToFields, type ScannedCardFields } from "@/lib/own-card";

async function uploadCrop(
  userId: string,
  images: PreparedImage[],
  box: { image_index: number; x: number; y: number; w: number; h: number } | null,
  kind: "logo" | "headshot",
): Promise<string | null> {
  const img = box ? images[box.image_index] : undefined;
  if (!box || !img) return null;
  try {
    const blob = await cropCardImage(img, box, kind);
    if (!blob) return null;
    return await uploadCardImage(userId, new File([blob], `${kind}.jpg`, { type: "image/jpeg" }));
  } catch {
    // A missing logo or photo never fails the scan; the user can add one later.
    return null;
  }
}

/** Photograph your own paper business card (front, optionally back) and get
 *  back digital-card fields: details, brand colors, logo and photo. */
export function ScanMyCard({
  onScanned,
  label = "Scan my business card",
  variant = "default",
  className,
}: {
  onScanned: (fields: ScannedCardFields) => void | Promise<void>;
  label?: string;
  variant?: "default" | "outline";
  className?: string;
}) {
  const { user } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(files: FileList | null) {
    if (!user || !files?.length) return;
    setBusy(true);
    try {
      const images = await Promise.all(
        Array.from(files).slice(0, SELF_SCAN_IMAGE_LIMIT).map(prepareImage),
      );
      const scan = await scanMyCard({
        data: { images: images.map(({ data, media_type }) => ({ data, media_type })) },
      });
      const [headshotPath, logoPath] = await Promise.all([
        uploadCrop(user.id, images, scan.headshot, "headshot"),
        uploadCrop(user.id, images, scan.logo, "logo"),
      ]);
      await onScanned(ownCardToFields(scan, { headshotPath, logoPath }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read your card");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handle(e.target.files)}
      />
      <Button
        type="button"
        variant={variant}
        className={className}
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {busy ? "Reading your card…" : label}
      </Button>
    </>
  );
}
