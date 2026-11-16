import { appHead } from "@/lib/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type DragEvent } from "react";
import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  Pencil,
  ScanLine,
  Smartphone,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AllowanceNote } from "@/components/AllowanceNote";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { scanCards } from "@/lib/ai.functions";
import { getBillingState } from "@/lib/billing.functions";
import { notifyNewContacts } from "@/lib/capture.functions";
import { SCAN_IMAGE_LIMIT, type ScannedContact } from "@/lib/ai-model";
import {
  cropHeadshot,
  prepareImage,
  type CroppedHeadshot,
  type PreparedImage,
} from "@/lib/image-prep";
import { uploadContactPhoto } from "@/lib/media";
import { PhotoEditor } from "@/components/PhotoEditor";
import { decodeQrFromImage } from "@/lib/qr-decode";
import { decodeQrText, mergeScannedContacts } from "@/lib/scan-decode";
import { contactsToVcf } from "@/lib/card-model";
import { downloadFile, VCF_MIME } from "@/lib/download";

export const Route = createFileRoute("/app/scan")({
  head: appHead("Scan a card", "Photograph a paper business card to save it as a contact."),
  validateSearch: (s: Record<string, unknown>) => (s["welcome"] ? { welcome: 1 as const } : {}),
  component: ScanPage,
});

type EditableContact = ScannedContact & { include: boolean; headshot: CroppedHeadshot | null };

function ScanPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { welcome } = Route.useSearch();
  const { data: billing } = useQuery({ queryKey: ["billing"], queryFn: () => getBillingState() });
  // Starter-pack buyers see what they bought the moment they land here.
  const unlocked =
    !!billing && billing.credits.scan > 0 && (welcome === 1 || billing.usage.scan.used === 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [metAt, setMetAt] = useState("");
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  // Index of the scanned card whose photo is open in the editor.
  const [editingPhoto, setEditingPhoto] = useState<number | null>(null);
  const [results, setResults] = useState<EditableContact[] | null>(null);
  const [savedBatch, setSavedBatch] = useState<EditableContact[] | null>(null);

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
      // AI card reading and local QR decoding run in parallel: QR codes
      // (vCards, MECARDs, LinkedIn profiles) are machine-exact and free.
      let aiError: unknown = null;
      const [ai, qrTexts] = await Promise.all([
        scanCards({
          data: { images: images.map(({ data, media_type }) => ({ data, media_type })) },
        }).catch((e: unknown) => {
          aiError = e;
          return { contacts: [] };
        }),
        Promise.all(images.map((img) => decodeQrFromImage(img).catch(() => null))),
      ]);
      const qrContacts = qrTexts.flatMap((text, i) => {
        if (!text) return [];
        const decoded = decodeQrText(text);
        if (decoded.type !== "contact" && decoded.type !== "linkedin") return [];
        return [{ ...decoded.contact, source_image_index: i }];
      });
      const contacts = mergeScannedContacts(ai.contacts, qrContacts);
      if (aiError && !contacts.length) throw aiError;
      if (aiError) {
        // Say why (e.g. the monthly allowance is used up), never fail silently.
        toast.warning("Couldn't read the card photos — showing only what the QR codes contained", {
          description: aiError instanceof Error ? aiError.message : undefined,
        });
      }
      if (!contacts.length) {
        toast.error("No business cards found in these photos");
        return;
      }
      // Crop printed headshots client-side from the same photos the AI looked at.
      const withHeadshots = await Promise.all(
        contacts.map(async (c) => {
          const img = images[c.source_image_index];
          return {
            ...c,
            include: true,
            headshot: img ? await cropHeadshot(img, c.headshot_box) : null,
          };
        }),
      );
      setResults(withHeadshots);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
      qc.invalidateQueries({ queryKey: ["billing"] }); // refresh "N of 100 left"
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
            website: c.website?.trim() || null,
            linkedin_url: c.linkedin_url?.trim() || null,
            address: c.address?.trim() || null,
            met_at: metAt.trim() || null,
            source: "scan",
          })),
        )
        .select("id");
      if (error) throw error;
      // Attach cropped headshots; a failed photo upload never blocks the contact save.
      let photoFailures = 0;
      await Promise.all(
        (rows ?? []).map(async (row, i) => {
          const shot = chosen[i]?.headshot;
          if (!shot) return;
          try {
            const path = await uploadContactPhoto(user.id, shot.blob);
            const { error: perr } = await supabase
              .from("contacts")
              .update({ photo_path: path })
              .eq("id", row.id);
            if (perr) throw perr;
          } catch {
            photoFailures += 1;
          }
        }),
      );
      if (photoFailures) {
        toast.warning(
          `${photoFailures} headshot${photoFailures > 1 ? "s" : ""} could not be uploaded — the contact${photoFailures > 1 ? "s were" : " was"} saved without ${photoFailures > 1 ? "them" : "it"}`,
        );
      }
      // Whatever else was printed (taglines, other handles) becomes a note.
      const extras = (rows ?? []).flatMap((row, i) => {
        const extra = chosen[i]?.extra?.trim();
        return extra ? [{ contact_id: row.id, user_id: user.id, body: extra }] : [];
      });
      if (extras.length) {
        const { error: nerr } = await supabase.from("contact_notes").insert(extras);
        if (nerr) throw nerr;
      }
      // Fan out to the user's webhook (if configured); never blocks the save.
      const ids = (rows ?? []).map((r) => r.id);
      if (ids.length) notifyNewContacts({ data: { contactIds: ids } }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(`Saved ${chosen.length} contact${chosen.length > 1 ? "s" : ""}`);
      setResults(null);
      setSavedBatch(chosen);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save contacts");
    } finally {
      setSaving(false);
    }
  }

  function addBatchToPhone() {
    if (!savedBatch) return;
    const vcf = contactsToVcf(
      savedBatch.map((c) => ({ ...c, note: metAt.trim() ? `Met at ${metAt.trim()}` : null })),
    );
    downloadFile(`contacts-${new Date().toISOString().slice(0, 10)}.vcf`, vcf, VCF_MIME);
    toast.success("Contact file downloaded — open it to add everyone to your phone");
  }

  const step = savedBatch ? 3 : results ? 2 : 1;
  const chosenCount = results?.filter((c) => c.include).length ?? 0;
  const [dragging, setDragging] = useState(false);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void addFiles(e.dataTransfer.files);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">
            Scan business cards
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Snap a stack of paper cards. We read them, you check them, they're contacts.
          </p>
        </div>
        <ol className="flex items-center gap-1.5 text-xs font-bold" aria-label="Progress">
          {["Snap", "Check", "Saved"].map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const on = step === n;
            return (
              <li key={label} className="flex items-center gap-1.5">
                {i > 0 && <span className="h-px w-4 bg-border" />}
                <span
                  aria-current={on ? "step" : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                    on
                      ? "bg-brand text-white"
                      : done
                        ? "bg-brand-soft text-brand"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" strokeWidth={3} /> : n}
                  <span>{label}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {unlocked && !results && !savedBatch && (
        <div className="mb-6 flex gap-3 rounded-2xl bg-pop-lime px-4 py-3.5 text-sm text-[#0E1230]">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-bold">
              Your {billing.credits.scan} card scans and {billing.credits.follow_up} follow-up
              drafts are unlocked.
            </p>
            <p className="mt-0.5 opacity-75">
              Photograph your first stack below — a few cards per photo is fine. Want your own
              digital card first?{" "}
              <Link to="/app/onboarding" className="font-semibold underline">
                Set it up here
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />

      {!results && !savedBatch && (
        <>
          {/* The viewfinder: drop zone, photo tray and camera button in one. */}
          <section
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`dark relative overflow-hidden rounded-[2rem] bg-[#0B0D1C] p-5 text-foreground transition-shadow sm:p-8 ${
              dragging ? "ring-4 ring-pop-lime" : ""
            }`}
          >
            <div className="qq-dots pointer-events-none absolute inset-0 opacity-[0.07]" />
            {[
              "left-4 top-4 border-l-4 border-t-4 rounded-tl-2xl",
              "right-4 top-4 border-r-4 border-t-4 rounded-tr-2xl",
              "bottom-4 left-4 border-b-4 border-l-4 rounded-bl-2xl",
              "bottom-4 right-4 border-b-4 border-r-4 rounded-br-2xl",
            ].map((c) => (
              <span
                key={c}
                aria-hidden
                className={`pointer-events-none absolute h-8 w-8 ${c} ${
                  images.length || dragging ? "border-pop-lime" : "border-white/30"
                }`}
              />
            ))}
            {images.length === 0 ? (
              <div className="relative flex flex-col items-center px-4 py-10 text-center sm:py-14">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pop-lime text-[#0E1230]">
                  <Camera className="h-8 w-8" />
                </span>
                <h2 className="mt-5 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Snap the stack.
                </h2>
                <p className="mt-2 max-w-sm text-sm text-white/60">
                  Lay a few cards on a table and take one photo, or add up to {SCAN_IMAGE_LIMIT}{" "}
                  photos. <span className="hidden md:inline">You can also drop images here.</span>
                </p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-pop-lime px-6 py-3 text-sm font-extrabold text-[#0E1230] transition-transform hover:-translate-y-0.5"
                >
                  <Camera className="h-4 w-4" />
                  Take or add photos
                </button>
              </div>
            ) : (
              <div className="relative p-4 sm:p-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-white/50">
                  {images.length} of {SCAN_IMAGE_LIMIT} photos
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {images.map((img, i) => (
                    <div
                      key={i}
                      className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10"
                    >
                      <img
                        src={img.previewUrl}
                        alt={`Card photo ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label="Remove photo"
                        className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white backdrop-blur hover:bg-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {images.length < SCAN_IMAGE_LIMIT && (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-white/20 text-xs font-semibold text-white/60 transition-colors hover:border-pop-lime hover:text-pop-lime"
                    >
                      <ImagePlus className="h-5 w-5" />
                      Add more
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          <div className="surface mt-5 space-y-4 rounded-3xl p-5">
            <div className="space-y-1.5">
              <Label htmlFor="met-at" className="font-semibold">
                Where did you meet these people?{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="met-at"
                placeholder="e.g. JAX Bar mixer, Web Summit 2026"
                value={metAt}
                onChange={(e) => setMetAt(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <AllowanceNote kind="scan" />
              <Button
                onClick={runScan}
                disabled={!images.length || scanning}
                className="h-12 w-full rounded-full bg-brand px-6 text-base font-bold text-white hover:bg-brand/90 sm:ml-auto sm:w-auto"
              >
                {scanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ScanLine className="h-4 w-4" />
                )}
                {scanning ? "Reading cards…" : "Read cards"}
              </Button>
            </div>
          </div>
        </>
      )}

      {results && (
        <>
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-semibold text-accent-foreground">
            <Sparkles className="h-4 w-4 shrink-0" />
            Found {results.length} card{results.length > 1 ? "s" : ""}. Check the details, then
            save.
          </div>
          <ul className="space-y-4">
            {results.map((c, i) => (
              <li
                key={i}
                className={`surface overflow-hidden rounded-3xl transition-opacity ${c.include ? "" : "opacity-50"}`}
              >
                <div className="flex items-center gap-3 border-b bg-muted/40 px-5 py-3.5">
                  <Checkbox
                    checked={c.include}
                    onCheckedChange={(v) => edit(i, { include: v === true })}
                    aria-label={`Include ${c.full_name || "this card"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-extrabold leading-tight">
                      {c.full_name || `Card ${i + 1}`}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.job_title, c.company].filter(Boolean).join(" · ") || `Card ${i + 1}`}
                    </p>
                  </div>
                  {c.headshot ? (
                    <div className="group relative">
                      <button
                        type="button"
                        onClick={() => setEditingPhoto(i)}
                        aria-label="Edit this photo"
                        title="Edit this photo"
                        className="block rounded-full"
                      >
                        <img
                          src={c.headshot.previewUrl}
                          alt={`Photo of ${c.full_name || "this contact"} from the card`}
                          className="h-12 w-12 rounded-full border-2 border-surface object-cover shadow-soft"
                        />
                        <span className="absolute -bottom-1 -left-1 rounded-full border bg-background p-0.5 text-muted-foreground">
                          <Pencil className="h-3 w-3" />
                        </span>
                      </button>
                      <button
                        onClick={() => edit(i, { headshot: null })}
                        aria-label="Don't save this photo"
                        title="Don't save this photo"
                        className="absolute -right-1 -top-1 rounded-full border bg-background p-0.5 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="rounded-full"
                      onClick={() => setEditingPhoto(i)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Add photo
                    </Button>
                  )}
                  <PhotoEditor
                    open={editingPhoto === i}
                    onOpenChange={(o) => !o && setEditingPhoto(null)}
                    title={c.headshot ? "Edit photo" : "Add a photo"}
                    sourceUrl={c.headshot?.previewUrl ?? null}
                    shape="circle"
                    onSave={async (blob) => {
                      edit(i, { headshot: { blob, previewUrl: URL.createObjectURL(blob) } });
                    }}
                    onRemove={c.headshot ? async () => edit(i, { headshot: null }) : undefined}
                  />
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  {(
                    [
                      ["full_name", "Name"],
                      ["job_title", "Title"],
                      ["company", "Company"],
                      ["email", "Email"],
                      ["phone", "Phone"],
                      ["website", "Website"],
                      ["linkedin_url", "LinkedIn"],
                      ["address", "Address"],
                    ] as const
                  ).map(([k, l]) => (
                    <div key={k} className="space-y-1">
                      <Label
                        htmlFor={`scan-${i}-${k}`}
                        className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                      >
                        {l}
                      </Label>
                      <Input
                        id={`scan-${i}-${k}`}
                        value={c[k] ?? ""}
                        onChange={(e) => edit(i, { [k]: e.target.value })}
                      />
                    </div>
                  ))}
                  {c.extra && (
                    <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
                      <span className="font-semibold text-foreground">Also on the card:</span>{" "}
                      {c.extra}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {/* Stays in reach while scrolling a long batch; sits above the phone tab bar. */}
          <div className="sticky bottom-24 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-full border bg-background/90 p-2 pl-5 shadow-float backdrop-blur md:bottom-6">
            <button
              type="button"
              onClick={() => setResults(null)}
              disabled={saving}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Back to photos
            </button>
            <Button
              onClick={saveAll}
              disabled={saving || !chosenCount}
              className="h-11 rounded-full bg-brand px-6 font-bold text-white hover:bg-brand/90"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save {chosenCount} contact{chosenCount === 1 ? "" : "s"}
            </Button>
          </div>
        </>
      )}

      {savedBatch && (
        <section className="dark relative overflow-hidden rounded-[2rem] bg-[#0B0D1C] p-8 text-center text-foreground sm:p-12">
          <div className="qq-dots pointer-events-none absolute inset-0 opacity-[0.07]" />
          <div className="relative">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pop-lime text-[#0E1230]">
              <Check className="h-8 w-8" strokeWidth={3} />
            </span>
            <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight">
              {savedBatch.length} contact{savedBatch.length > 1 ? "s" : ""} saved.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/60">
              Add them to your phone's contacts too — one tap downloads a contact file, and opening
              it imports the whole batch.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={addBatchToPhone}
                className="inline-flex items-center gap-2 rounded-full bg-pop-lime px-5 py-3 text-sm font-extrabold text-[#0E1230]"
              >
                <Smartphone className="h-4 w-4" />
                Add to phone contacts
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/app/contacts" })}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15"
              >
                <Users className="h-4 w-4" />
                View contacts
              </button>
              <button
                type="button"
                onClick={() => {
                  setSavedBatch(null);
                  setImages([]);
                }}
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white/70 hover:text-white"
              >
                <ScanLine className="h-4 w-4" />
                Scan more
              </button>
            </div>
            <p className="mt-6 text-xs text-white/45">
              iPhone: open the downloaded file and tap "Add all contacts". Android: open it and
              confirm the import.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
