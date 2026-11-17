import { appHead } from "@/lib/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Check, ExternalLink, Eye, ImagePlus, Lock, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { PhotoEditor } from "@/components/PhotoEditor";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppleWalletPanel } from "@/components/wallet/AppleWalletButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BrandPanel } from "@/components/card/BrandPanel";
import { ExchangePanel } from "@/components/card/ExchangePanel";
import { PracticePanel } from "@/components/card/PracticePanel";
import { lowProfileView, packCta, parsePractice } from "@/lib/practice";
import { CardView } from "@/components/card/CardView";
import { ICON_LABELS, LinkIcon } from "@/components/card/LinkIcon";
import { QrPanel } from "@/components/card/QrPanel";
import { ScanMyCard } from "@/components/card/ScanMyCard";
import { mergeScannedIntoCard } from "@/lib/own-card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { designUploads } from "@/lib/background-store";
import { getCard, listCards, rowToCard, saveLinks } from "@/lib/cards-api";
import { PremiumUpsell, usePlan } from "@/components/PremiumGate";
import { lockedCardIds, LOGO_SIZES, ACCENT_PRESETS, BACKGROUND_PRESETS, FONTS, guessIcon, SLUG_RE, TEMPLATES, type CardData, type LabeledValue } from "@/lib/card-model";
import { removeMedia, shrinkImage, signedUrls, uploadCardImage, uploadOgImage } from "@/lib/media";
import { renderOgImage } from "@/lib/og-image";
import { LINK_GROUPS, LINK_PLATFORMS } from "@/lib/link-catalog";
import { cn } from "@/lib/utils";
import { liveLinkProps } from "@/hooks/use-pwa-install";

export const Route = createFileRoute("/app/cards/$id")({ head: appHead('Edit card', 'Edit your digital business card and see changes live.'), component: EditorPage });

function EditorPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { plan } = usePlan();
  const { data, isLoading } = useQuery({ queryKey: ["card", id], queryFn: () => getCard(id) });
  const { data: cards } = useQuery({
    queryKey: ["cards"],
    queryFn: listCards,
    enabled: plan === "free",
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data?.card) return <p>Card not found. <Link to="/app" className="underline">Back to cards</Link></p>;
  if (plan === "free" && user && cards && lockedCardIds(cards, user.id, plan).has(id)) {
    return <LockedCard slug={data.card.slug} label={data.card.label} />;
  }
  return (
    <Editor
      key={id}
      cardId={id}
      initial={rowToCard(data.card, data.links)}
      qrCenter={data.card.qr_center}
    />
  );
}

/** A free account's extra card (see lockedCardIds): still live, not editable. */
function LockedCard({ slug, label }: { slug: string; label: string }) {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link
        to="/app"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Cards
      </Link>
      <div className="surface space-y-3 p-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-foreground">
          <Lock className="h-3.5 w-3.5" />
          Locked on the free plan
        </span>
        <h1 className="text-2xl font-bold">{label}</h1>
        <p className="text-sm text-muted-foreground">
          This card is still live and its QR code still works. The free plan can edit one card, so
          editing this one needs Pro (up to 3 cards) or Premium (unlimited).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/app/settings">
              <Sparkles className="h-4 w-4" />
              Upgrade to edit
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href={`/c/${slug}`} {...liveLinkProps()}>
              <ExternalLink className="h-4 w-4" />
              View live card
            </a>
          </Button>
        </div>
      </div>
    </div>
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

  useEffect(() => { signedUrls([card.headshot_path, card.logo_path, card.banner_path]).then((u) => setUrls((p) => ({ ...p, ...u }))); }, [card.headshot_path, card.logo_path, card.banner_path]);
  const { isPremium, isPro } = usePlan();
  // The verified badge is granted by an admin; the owner can only see it.
  const { data: verified } = useQuery({
    queryKey: ["verified", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("verified_at")
        .eq("id", user!.id)
        .maybeSingle();
      return !!data?.verified_at;
    },
  });

  // Teams can remove our branding; the server decides (get_public_card), so
  // the preview and the share image ask it rather than guess from the plan.
  const { data: unbranded } = useQuery({
    queryKey: ["card-unbranded", initial.slug],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_card", { _slug: initial.slug });
      return (data as { hide_branding?: boolean } | null)?.hide_branding === true;
    },
  });
  // A ref, so the answer arriving doesn't look like an edit and trigger a save.
  const unbrandedRef = useRef(false);
  unbrandedRef.current = unbranded === true;

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
          const blob = await renderOgImage(c, headshotUrl, { unbranded: unbrandedRef.current });
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
        const { links, slug: _s, theme, exchange, practice, ...fields } = c;
        const { error } = await supabase
          .from("cards")
          .update({
            ...fields,
            theme: theme ?? null,
            exchange: exchange ?? null,
            practice: parsePractice(practice),
          })
          .eq("id", cardId);
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
    toast.success("Card address updated — your old link and printed QR codes now forward here");
  }

  async function upload(kind: "headshot_path" | "logo_path", file?: File) {
    if (!file || !user) return;
    try {
      // Photos and logos used to go up full size (a 2 MB phone photo for a
      // 112px circle), which made cards load slowly right after a scan.
      const small =
        kind === "headshot_path"
          ? await shrinkImage(file, 800)
          : await shrinkImage(file, 1000, { keepTransparency: true });
      set(kind, await uploadCardImage(user.id, small));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  // Premium: the banner photo shows on the Banner layout, so picking one
  // switches the card to it.
  async function uploadBanner(file?: File) {
    if (!file || !user) return;
    try {
      const path = await uploadCardImage(user.id, await shrinkImage(file));
      setCard((c) => ({ ...c, banner_path: path, template: "banner" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function deleteCard() {
    const bgFiles = user ? await designUploads(user.id, cardId) : [];
    const { error } = await supabase.from("cards").delete().eq("id", cardId);
    if (error) { toast.error(error.message); return; }
    void removeMedia(bgFiles).catch(() => {});
    await qc.invalidateQueries({ queryKey: ["cards"] });
    navigate({ to: "/app" });
  }

  // The preview shows the card as visitors will see it: the cleaned pack, and
  // the organization instead of the person on a low-profile card.
  const shown = lowProfileView({ ...card, practice: parsePractice(card.practice) });
  const cta = packCta(shown.practice);
  const preview = (
    <div className="phone-frame mx-auto"><div className="h-full overflow-y-auto rounded-[38px]">
      <CardView card={shown} headshotUrl={shown.headshot_path ? urls[shown.headshot_path] : null} logoUrl={card.logo_path ? urls[card.logo_path] : null} bannerUrl={card.banner_path ? urls[card.banner_path] : null} verified={verified === true} unbranded={unbranded === true}
        actions={
          <div className="space-y-2">
            {cta && <div className="h-12 rounded-full text-center text-sm font-semibold leading-[3rem]" style={{ background: card.accent_color, color: "#fff" }}>{cta.label}</div>}
            <div className={`h-12 rounded-full text-center text-sm font-semibold leading-[3rem] ${cta ? "border" : ""}`} style={cta ? { borderColor: card.accent_color } : { background: card.accent_color, color: "#fff" }}>Save contact</div>
          </div>
        } />
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
            <a href={`/c/${card.slug}`} {...liveLinkProps()} aria-label="Open live card">
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
          <TabsList className="mb-6 grid w-full grid-cols-5 [&>button]:px-1 [&>button]:text-xs sm:[&>button]:text-sm">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="profession">Profession</TabsTrigger>
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
                onEdit={(b) => upload("headshot_path", new File([b], "headshot.jpg", { type: b.type }))}
              />
              <ImagePick
                label="Company logo"
                url={card.logo_path ? urls[card.logo_path] : null}
                onPick={(f) => upload("logo_path", f)}
                onClear={() => set("logo_path", null)}
                onEdit={(b) => upload("logo_path", new File([b], "logo.png", { type: b.type }))}
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
                    aria-label="Card address"
                    className="h-9 flex-1 bg-transparent pr-3 text-foreground outline-none"
                    value={slugDraft}
                    onChange={(e) => setSlugDraft(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={saveSlug} disabled={slugDraft === card.slug}>
                  Update
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Changing it is safe: your old link and printed QR codes keep forwarding here.
              </p>
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

          <TabsContent value="profession">
            <PracticePanel
              practice={card.practice}
              location={card.location}
              company={card.company}
              onChange={(p) => set("practice", p)}
            />
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
                      {LINK_GROUPS.map((group) => (
                        <SelectGroup key={group}>
                          <SelectLabel>{group}</SelectLabel>
                          {LINK_PLATFORMS.filter((pl) => pl.group === group).map((pl) => (
                            <SelectItem key={pl.id} value={pl.id}>
                              <span className="flex items-center gap-2">
                                <LinkIcon icon={pl.id} className="h-4 w-4" />
                                {pl.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label="Link label"
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
                  aria-label="Link URL"
                  placeholder={
                    l.icon === "email"
                      ? "name@example.com"
                      : l.icon === "phone"
                        ? "+1 555 0100"
                        : "https://"
                  }
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            {card.template === "glass" && (
              <BrandPanel card={card} isPremium={isPremium} onChange={(t) => set("theme", t)} />
            )}
            <div>
              <Label className="mb-3 block">Company logo size</Label>
              <div
                className="inline-flex rounded-xl border p-1"
                role="radiogroup"
                aria-label="Company logo size"
              >
                {LOGO_SIZES.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={card.logo_size === o.id}
                    onClick={() => set("logo_size", o.id)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                      card.logo_size === o.id
                        ? "bg-brand text-white"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
              {!card.logo_path && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Add your logo on the Details tab to see it on your card.
                </p>
              )}
            </div>
            <div>
              <Label className="mb-3 block">Banner photo</Label>
              {isPremium ? (
                <div className="space-y-2">
                  <label className="flex aspect-[3/1] w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted">
                    {card.banner_path && urls[card.banner_path] ? (
                      <img
                        src={urls[card.banner_path]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ImagePlus className="h-4 w-4" />
                        Choose a photo for the top of your card
                      </span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      aria-label="Choose banner photo"
                      onChange={(e) => void uploadBanner(e.target.files?.[0])}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Shows across the top of the Banner layout. Wide photos work best.
                  </p>
                  {card.banner_path && (
                    <Button size="sm" variant="ghost" onClick={() => set("banner_path", null)}>
                      Remove banner photo
                    </Button>
                  )}
                </div>
              ) : (
                <PremiumUpsell feature="A custom banner photo" />
              )}
            </div>
            <ColorRow
              label="Accent color"
              value={card.accent_color}
              presets={ACCENT_PRESETS}
              onChange={(v) => set("accent_color", v)}
            />
            {/* Liquid Glass paints its own background from the theme. */}
            {card.template !== "glass" && (
              <ColorRow
                label="Background"
                value={card.background_color}
                presets={BACKGROUND_PRESETS}
                onChange={(v) => set("background_color", v)}
              />
            )}
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

          <TabsContent value="share" className="space-y-10">
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
            <AppleWalletPanel
              card={{
                id: cardId,
                logo_path: card.logo_path,
                headshot_path: card.headshot_path,
                accent_color: card.accent_color,
                practice: card.practice,
              }}
            />
            <ExchangePanel
              card={card}
              canEditForm={isPro}
              onChange={(x) => set("exchange", x)}
            />
          </TabsContent>
        </Tabs>

        <div className="hidden lg:block">
          <div className="sticky top-20">{preview}</div>
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
  // The label points at the single control inside, so screen readers name it.
  const id = useId();
  const control =
    isValidElement<{ id?: string }>(children) && (children.type === Input || children.type === Textarea)
      ? cloneElement(children, { id: children.props.id ?? id })
      : children;
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{control}</div>;
}

function MultiValue({ title, items, onChange, type, defaultLabel }: { title: string; items: LabeledValue[]; onChange: (v: LabeledValue[]) => void; type: string; defaultLabel: string }) {
  return (
    <div className="space-y-2"><Label>{title}</Label>
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <Input className="w-28" aria-label={`${title} label`} value={it.label} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <Input type={type} aria-label={title} value={it.value} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
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

function ImagePick({ label, url, round, onPick, onClear, onEdit }: { label: string; url: string | null | undefined; round?: boolean; onPick: (f?: File) => void; onClear: () => void; onEdit: (b: Blob) => void | Promise<void> }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="space-y-1.5"><Label>{label}</Label>
      <div className="flex items-center gap-3">
        <label className={cn("flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden border border-dashed bg-muted", round ? "rounded-full" : "rounded-xl")}>
          {url ? <img src={url} alt="" className={cn("h-full w-full", round ? "object-cover" : "object-contain p-1")} /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
          <input type="file" accept="image/*" className="sr-only" aria-label={`Choose ${label.toLowerCase()}`} onChange={(e) => onPick(e.target.files?.[0])} />
        </label>
        {url && (
          <div className="flex flex-col gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
            <Button size="sm" variant="ghost" onClick={onClear}>Remove</Button>
          </div>
        )}
      </div>
      <PhotoEditor
        open={editing}
        onOpenChange={setEditing}
        title={`Edit ${label.toLowerCase()}`}
        sourceUrl={url ?? null}
        shape={round ? "circle" : "square"}
        output={round ? "image/jpeg" : "image/png"}
        onSave={async (b) => { await onEdit(b); }}
      />
    </div>
  );
}
