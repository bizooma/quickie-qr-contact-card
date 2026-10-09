import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Camera, Loader2, ScanLine, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { scanCards } from "@/lib/ai.functions";
import { SCAN_IMAGE_LIMIT, type ScannedContact } from "@/lib/ai-model";
import { prepareImage, type PreparedImage } from "@/lib/image-prep";

export const Route = createFileRoute("/app/scan")({ component: ScanPage });

type EditableContact = ScannedContact & { include: boolean };

function ScanPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [metAt, setMetAt] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<EditableContact[] | null>(null);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    try {
      const prepared = await Promise.all(Array.from(files).map(prepareImage));
      setImages((prev) => [...prev, ...prepared].slice(0, SCAN_IMAGE_LIMIT));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read those images");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function runScan() {
    setScanning(true);
    setResults(null);
    try {
      const { contacts } = await scanCards({
        data: { images: images.map(({ data, media_type }) => ({ data, media_type })) },
      });
      if (!contacts.length) {
        toast.error("No business cards found in these photos");
        return;
      }
      setResults(contacts.map((c) => ({ ...c, include: true })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  function edit(i: number, patch: Partial<EditableContact>) {
    setResults((prev) => prev?.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) ?? prev);
  }

  async function saveAll() {
    if (!user || !results) return;
    const chosen = results.filter((c) => c.include && c.full_name.trim());
    if (!chosen.length) {
      toast.error("Nothing selected to save");
      return;
    }
    setSaving(true);
    try {
      const { data: rows, error } = await supabase
        .from("contacts")
        .insert(
          chosen.map((c) => ({
            user_id: user.id,
            full_name: c.full_name.trim(),
            job_title: c.job_title?.trim() || null,
            company: c.company?.trim() || null,
            email: c.email?.trim() || null,
            phone: c.phone?.trim() || null,
            met_at: metAt.trim() || null,
            source: "scan",
          })),
        )
        .select("id");
      if (error) throw error;
      const extras = (rows ?? []).flatMap((row, i) => {
        const c = chosen[i];
        const parts = [c?.website && `Website: ${c.website}`, c?.extra].filter(Boolean);
        return parts.length
          ? [{ contact_id: row.id, user_id: user.id, body: (parts as string[]).join("\n") }]
          : [];
      });
      if (extras.length) {
        const { error: nerr } = await supabase.from("contact_notes").insert(extras);
        if (nerr) throw nerr;
      }
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(`Saved ${chosen.length} contact${chosen.length > 1 ? "s" : ""}`);
      navigate({ to: "/app/contacts" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save contacts");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Scan business cards</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Snap or upload photos of paper cards — AI turns them into contacts you can follow up with.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />

      {!results && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((img, i) => (
              <div
                key={i}
                className="group relative aspect-[4/3] overflow-hidden rounded-xl border"
              >
                <img
                  src={img.previewUrl}
                  alt={`Card photo ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {images.length < SCAN_IMAGE_LIMIT && (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-xs text-muted-foreground hover:bg-muted"
              >
                <Camera className="h-5 w-5" />
                Add photos
              </button>
            )}
          </div>

          <div className="mb-6 space-y-1">
            <Label htmlFor="met-at">Where did you meet these people? (optional)</Label>
            <Input
              id="met-at"
              placeholder="e.g. Web Summit 2026"
              value={metAt}
              onChange={(e) => setMetAt(e.target.value)}
            />
          </div>

          <Button
            onClick={runScan}
            disabled={!images.length || scanning}
            className="w-full sm:w-auto"
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanLine className="h-4 w-4" />
            )}
            {scanning
              ? "Reading cards…"
              : `Scan ${images.length || ""} photo${images.length === 1 ? "" : "s"} with AI`}
          </Button>
        </>
      )}

      {results && (
        <>
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-brand" />
            Found {results.length} card{results.length > 1 ? "s" : ""}. Check the details, then
            save.
          </div>
          <ul className="space-y-4">
            {results.map((c, i) => (
              <li key={i} className={`surface space-y-3 p-4 ${c.include ? "" : "opacity-50"}`}>
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={c.include}
                    onCheckedChange={(v) => edit(i, { include: v === true })}
                    aria-label={`Include ${c.full_name || "this card"}`}
                  />
                  <span className="text-sm font-semibold">Card {i + 1}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["full_name", "Name"],
                      ["job_title", "Title"],
                      ["company", "Company"],
                      ["email", "Email"],
                      ["phone", "Phone"],
                      ["website", "Website"],
                    ] as const
                  ).map(([k, l]) => (
                    <div key={k} className="space-y-1">
                      <Label className="text-xs">{l}</Label>
                      <Input
                        value={c[k] ?? ""}
                        onChange={(e) => edit(i, { [k]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                {c.extra && (
                  <p className="text-xs text-muted-foreground">Also on the card: {c.extra}</p>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={saveAll} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save {results.filter((c) => c.include).length} contact
              {results.filter((c) => c.include).length === 1 ? "" : "s"}
            </Button>
            <Button variant="outline" onClick={() => setResults(null)} disabled={saving}>
              Back to photos
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
