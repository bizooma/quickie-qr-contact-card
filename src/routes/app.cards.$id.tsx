import { appHead } from "@/lib/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Check, ExternalLink, Eye, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CardView } from "@/components/card/CardView";
import { ICON_LABELS, LinkIcon } from "@/components/card/LinkIcon";
import { QrPanel } from "@/components/card/QrPanel";
import { ScanMyCard } from "@/components/card/ScanMyCard";
import { mergeScannedIntoCard } from "@/lib/own-card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { designUploads } from "@/lib/background-store";
import { getCard, rowToCard, saveLinks } from "@/lib/cards-api";
import { ACCENT_PRESETS, BACKGROUND_PRESETS, FONTS, guessIcon, LINK_ICONS, SLUG_RE, TEMPLATES, type CardData, type LabeledValue } from "@/lib/card-model";
import { removeMedia, signedUrls, uploadCardImage, uploadOgImage } from "@/lib/media";
import { renderOgImage } from "@/lib/og-image";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/cards/$id")({ head: appHead('Edit card', 'Edit your digital business card and see changes live.'), component: EditorPage });

function EditorPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({ queryKey: ["card", id], queryFn: () => getCard(id) });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data?.card) return <p>Card not found. <Link to="/app" className="underline">Back to cards</Link></p>;
  return (
    <Editor
      key={id}
      cardId={id}
      initial={rowToCard(data.card, data.links)}
      qrCenter={data.card.qr_center}
    />
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

function Editor({
  cardId,
  initial,
  qrCenter,
}: {
  cardId: string;
  initial: CardData;
  qrCenter: string | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [card, setCard] = useState<CardData>(initial);
  const [slugDraft, setSlugDraft] = useState(initial.slug);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [save, setSave] = useState<SaveState>("idle");
  const [showPreview, setShowPreview] = useState(false);
  const first = useRef(true);
  const lastLinks = useRef(JSON.stringify(initial.links));

  useEffect(() => { signedUrls([card.headshot_path, card.logo_path]).then((u) => setUrls((p) => ({ ...p, ...u }))); }, [card.headshot_path, card.logo_path]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ogTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refresh the link-preview (og:image) a moment after edits settle. Purely a
  // nice-to-have: failures are silent and the public page falls back to the
  // default preview image.
  const regenerateOg = useCallback(
    (c: CardData) => {
      if (!user) return;
      if (ogTimer.current) clearTimeout(ogTimer.current);
      ogTimer.current = setTimeout(async () => {
        try {
          const headshotUrl = c.headshot_path
            ? ((await signedUrls([c.headshot_path]))[c.headshot_path] ?? null)
            : null;
          const blob = await renderOgImage(c, headshotUrl);
          if (!blob) return;
          const path = await uploadOgImage(user.id, cardId, blob);
          await supabase.from("cards").update({ og_path: path }).eq("id", cardId);
        } catch {
          // Ignore: the preview image is progressive enhancement.
        }
      }, 2500);
    },
    [user, cardId],
  );

  const persist = useCallback(
    async (c: CardData) => {
      if (!user) return;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      try {
        const { links, slug: _s, ...fields } = c;
        const { error } = await supabase.from("cards").update(fields).eq("id", cardId);
        if (error) throw error;
        const lj = JSON.stringify(links);
        if (lj !== lastLinks.current) {
          await saveLinks(user.id, cardId, links);
          lastLinks.current = lj;
        }
        setSave("saved");
        qc.invalidateQueries({ queryKey: ["cards"] });
        regenerateOg(c);
      } catch (err) {
        setSave("error");
        toast.error(err instanceof Error ? err.message : "Could not save");
      }
    },
    [cardId, user, qc, regenerateOg],
  );

  // Debounced autosave: every edit is published to the live card. The header's
  // Save button flushes the pending write immediately via persist().
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!user) return;
    setSave("saving");
    timer.current = setTimeout(() => persist(card), 700);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [card, user, persist]);

  // A pending write is lost if the tab closes before the debounce fires.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (save === "saving" || save === "error") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  // In-app navigation (e.g. tapping Back right after picking a photo) unmounts
  // the editor WITHOUT firing beforeunload, and the autosave effect's cleanup
  // cancels the pending timer — which silently discarded the edit. Flush the
  // pending (or failed) write on unmount instead; the request outlives the
  // component.
  const cardRef = useRef(card);
  cardRef.current = card;
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(
    () => () => {
      if (saveRef.current === "saving" || saveRef.current === "error") {
        void persist(cardRef.current);
      }
    },
    [persist],
  );

  // On phones, switching apps or closing the installed PWA suspends the page
  // without beforeunload or an unmount: the debounce timer never fires and the
  // edit is lost. Flush as soon as the page goes to the background — browsers
  // grant a grace window for requests started from these events.
  useEffect(() => {
    const flushIfPending = () => {
      if (saveRef.current === "saving" || saveRef.current === "error") {
        void persist(cardRef.current);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushIfPending();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushIfPending);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushIfPending);
    };
  }, [persist]);

  const set = <K extends keyof CardData>(k: K, v: CardData[K]) => setCard((c) => ({ ...c, [k]: v }));

  async function saveSlug() {
    const s = slugDraft.trim().toLowerCase();
    if (s === card.slug) return;
    if (!SLUG_RE.test(s)) { toast.error("Use 3–49 lowercase letters, numbers or dashes"); return; }
    const { error } = await supabase.from("cards").update({ slug: s }).eq("id", cardId);
    if (error) { toast.error(error.code === "23505" ? "That address is taken" : error.message); return; }
    setCard((c) => ({ ...c, slug: s }));
    toast.success("Card address updated — old QR codes will stop working");
  }

  async function upload(kind: "headshot_path" | "logo_path", file?: File) {
    if (!file || !user) return;
    try { set(kind, await uploadCardImage(user.id, file)); } catch (err) { toast.error(err instanceof Error ? err.message : "Upload failed"); }
  }

  async function deleteCard() {
    const bgFiles = user ? await designUploads(user.id, cardId) : [];
    const { error } = await supabase.from("cards").delete().eq("id", cardId);
    if (error) { toast.error(error.message); return; }
    void removeMedia(bgFiles).catch(() => {});
    await qc.invalidateQueries({ queryKey: ["cards"] });
    navigate({ to: "/app" });
  }

  const preview = (
    <div className="phone-frame mx-auto"><div className="h-full overflow-y-auto rounded-[38px]">
      <CardView card={card} headshotUrl={card.headshot_path ? urls[card.headshot_path] : null} logoUrl={card.logo_path ? urls[card.logo_path] : null}
        actions={<div className="h-12 rounded-full text-center text-sm font-semibold leading-[3rem]" style={{ background: card.accent_color, color: "#fff" }}>Save contact</div>} />
    </div></div>
  );

  return (
    <div>
      <div className="mb-6 space-y-2">
        {/* Row 1: back · centered card title · open-live-card. The two edge
            controls keep the title visually centered on phones. */}
        <div className="flex items-center gap-2">
          <Link to="/app" className="shrink-0 rounded-full p-2 hover:bg-muted" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-center text-2xl font-bold">{card.label}</h1>
          <Button size="sm" variant="ghost" asChild className="shrink-0">
            <a
              href={`/c/${card.slug}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Open live card"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
        {/* Row 2: save status + actions, wrapping as one centered line. */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <p className="text-xs text-muted-foreground">
            {save === "saving" ? (
              "Unsaved changes"
            ) : save === "saved" ? (
              <span className="inline-flex items-center gap-1">
                <Check className="h-3 w-3" />
                Saved — your card is live
              </span>
            ) : save === "error" ? (
              <span className="font-medium text-destructive">Not saved — try again</span>
            ) : (
              "Changes save automatically"
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setSave("saving");
                persist(card);
              }}
              disabled={save === "saved" || save === "idle"}
            >
              {save === "saving" ? (
                "Save now"
              ) : save === "error" ? (
                "Retry save"
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Saved
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="lg:hidden"
              onClick={() => setShowPreview(true)}
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <Tabs defaultValue="details">
          <TabsList className="mb-6 grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="style">Style</TabsTrigger>
            <TabsTrigger value="share">Share</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            <div className="surface flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Have a paper card? Fill everything in from a photo of it.
              </p>
              <ScanMyCard
                variant="outline"
                label="Fill from my business card"
                onScanned={(fields) => {
                  setCard((c) => mergeScannedIntoCard(c, fields));
                  toast.success("Filled in from your card — review the details");
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ImagePick
                label="Headshot"
                url={card.headshot_path ? urls[card.headshot_path] : null}
                round
                onPick={(f) => upload("headshot_path", f)}
                onClear={() => set("headshot_path", null)}
              />
              <ImagePick
                label="Company logo"
                url={card.logo_path ? urls[card.logo_path] : null}
                onPick={(f) => upload("logo_path", f)}
                onClear={() => set("logo_path", null)}
              />
            </div>
            <Field label="Card name">
              <Input
                value={card.label}
                maxLength={40}
                onChange={(e) => set("label", e.target.value)}
              />
            </Field>
            <Field label="Full name">
              <Input value={card.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Job title">
                <Input
                  value={card.job_title ?? ""}
                  onChange={(e) => set("job_title", e.target.value || null)}
                />
              </Field>
              <Field label="Company">
                <Input
                  value={card.company ?? ""}
                  onChange={(e) => set("company", e.target.value || null)}
                />
              </Field>
            </div>
            <MultiValue
              title="Phone numbers"
              type="tel"
              items={card.phones}
              onChange={(v) => set("phones", v)}
              defaultLabel="Mobile"
            />
            <MultiValue
              title="Emails"
              type="email"
              items={card.emails}
              onChange={(v) => set("emails", v)}
              defaultLabel="Work"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Website">
                <Input
                  value={card.website ?? ""}
                  placeholder="yoursite.com"
                  onChange={(e) => set("website", e.target.value || null)}
                />
              </Field>
              <Field label="Location">
                <Input
                  value={card.location ?? ""}
                  placeholder="Chicago, IL"
                  onChange={(e) => set("location", e.target.value || null)}
                />
              </Field>
            </div>
            <Field label="Short bio">
              <Textarea
                value={card.bio ?? ""}
                maxLength={280}
                onChange={(e) => set("bio", e.target.value || null)}
              />
            </Field>
            <Field label="Card address">
              <div className="flex gap-2">
                <div className="flex flex-1 items-center rounded-md border bg-background pl-3 text-sm text-muted-foreground">
                  /c/
                  <input
                    className="h-9 flex-1 bg-transparent pr-3 text-foreground outline-none"
                    value={slugDraft}
                    onChange={(e) => setSlugDraft(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={saveSlug} disabled={slugDraft === card.slug}>
                  Update
                </Button>
              </div>
            </Field>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Delete this card
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{card.label}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The public page and QR code stop working and its analytics are removed. Contacts
                    it captured are kept.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteCard}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          <TabsContent value="links" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Social profiles, booking pages, payment links — add as many as you like.
            </p>
            {card.links.map((l, i) => (
              <div key={l.id ?? i} className="surface space-y-2 p-3">
                <div className="flex gap-2">
                  <Select
                    value={l.icon}
                    onValueChange={(v) =>
                      set(
                        "links",
                        card.links.map((x, j) => (j === i ? { ...x, icon: v } : x)),
                      )
                    }
                  >
                    <SelectTrigger className="w-16">
                      <SelectValue>
                        <LinkIcon icon={l.icon} className="h-4 w-4" />
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {LINK_ICONS.map((ic) => (
                        <SelectItem key={ic} value={ic}>
                          <span className="flex items-center gap-2">
                            <LinkIcon icon={ic} className="h-4 w-4" />
                            {ICON_LABELS[ic]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Label"
                    value={l.label}
                    onChange={(e) =>
                      set(
                        "links",
                        card.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                      )
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={i === 0}
                    onClick={() => {
                      set("links", swap(card.links, i, i - 1));
                    }}
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={i === card.links.length - 1}
                    onClick={() => {
                      set("links", swap(card.links, i, i + 1));
                    }}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      set(
                        "links",
                        card.links.filter((_, j) => j !== i),
                      )
                    }
                    aria-label="Remove"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  placeholder="https://"
                  value={l.url}
                  onChange={(e) => {
                    const url = e.target.value;
                    set(
                      "links",
                      card.links.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              url,
                              icon: x.icon === "link" ? guessIcon(url) : x.icon,
                              label:
                                x.label ||
                                (guessIcon(url) !== "link"
                                  ? (ICON_LABELS[guessIcon(url)] ?? "")
                                  : ""),
                            }
                          : x,
                      ),
                    );
                  }}
                />
              </div>
            ))}
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                set("links", [
                  ...card.links,
                  { id: crypto.randomUUID(), label: "", url: "", icon: "link" },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Add link
            </Button>
          </TabsContent>

          <TabsContent value="style" className="space-y-8">
            <div>
              <Label className="mb-3 block">Layout</Label>
              <div className="grid grid-cols-3 gap-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => set("template", t.id)}
                    className={cn(
                      "rounded-xl border p-3 text-left text-sm transition",
                      card.template === t.id
                        ? "border-brand ring-2 ring-ring/30"
                        : "hover:bg-muted",
                    )}
                  >
                    <span className="block font-semibold">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <ColorRow
              label="Accent color"
              value={card.accent_color}
              presets={ACCENT_PRESETS}
              onChange={(v) => set("accent_color", v)}
            />
            <ColorRow
              label="Background"
              value={card.background_color}
              presets={BACKGROUND_PRESETS}
              onChange={(v) => set("background_color", v)}
            />
            <div>
              <Label className="mb-3 block">Font</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => set("font", f.id)}
                    style={{ fontFamily: f.css }}
                    className={cn(
                      "rounded-xl border p-3 text-lg",
                      card.font === f.id ? "border-brand ring-2 ring-ring/30" : "hover:bg-muted",
                    )}
                  >
                    Aa{" "}
                    <span className="block font-sans text-xs text-muted-foreground">{f.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="share">
            <QrPanel
              cardId={cardId}
              slug={card.slug}
              accent={card.accent_color}
              bg={card.background_color}
              name={card.full_name}
              headshotPath={card.headshot_path}
              logoPath={card.logo_path}
              qrCenter={qrCenter}
            />
          </TabsContent>
        </Tabs>

        <div className="hidden lg:block">
          <div className="sticky top-10">{preview}</div>
        </div>
      </div>

      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 lg:hidden"
          onClick={() => setShowPreview(false)}
        >
          <div className="scale-[0.9]" onClick={(e) => e.stopPropagation()}>
            {preview}
          </div>
          <button
            className="absolute right-4 top-4 rounded-full bg-muted p-3"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const out = [...arr];
  const x = out[a] as T;
  out[a] = out[b] as T;
  out[b] = x;
  return out;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function MultiValue({ title, items, onChange, type, defaultLabel }: { title: string; items: LabeledValue[]; onChange: (v: LabeledValue[]) => void; type: string; defaultLabel: string }) {
  return (
    <div className="space-y-2"><Label>{title}</Label>
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <Input className="w-28" value={it.label} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <Input type={type} value={it.value} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
          <Button size="icon" variant="ghost" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove"><X className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => onChange([...items, { label: defaultLabel, value: "" }])}><Plus className="h-4 w-4" />Add</Button>
    </div>
  );
}

function ColorRow({ label, value, presets, onChange }: { label: string; value: string; presets: string[]; onChange: (v: string) => void }) {
  return (
    <div><Label className="mb-3 block">{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((c) => <button key={c} aria-label={c} onClick={() => onChange(c)} className={cn("h-9 w-9 rounded-full border", value.toUpperCase() === c && "ring-2 ring-ring ring-offset-2 ring-offset-background")} style={{ background: c }} />)}
        <label className="relative h-9 w-9 cursor-pointer overflow-hidden rounded-full border" title="Custom color">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground"><Plus className="h-4 w-4" /></span>
        </label>
      </div>
    </div>
  );
}

function ImagePick({ label, url, round, onPick, onClear }: { label: string; url: string | null | undefined; round?: boolean; onPick: (f?: File) => void; onClear: () => void }) {
  return (
    <div className="space-y-1.5"><Label>{label}</Label>
      <div className="flex items-center gap-3">
        <label className={cn("flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden border border-dashed bg-muted", round ? "rounded-full" : "rounded-xl")}>
          {url ? <img src={url} alt="" className={cn("h-full w-full", round ? "object-cover" : "object-contain p-1")} /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPick(e.target.files?.[0])} />
        </label>
        {url && <Button size="sm" variant="ghost" onClick={onClear}>Remove</Button>}
      </div>
    </div>
  );
}
