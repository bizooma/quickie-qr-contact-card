import { appHead } from "@/lib/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Loader2,
  Mic,
  Square,
  Mail,
  Phone,
  Plus,
  Smartphone,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { removeMedia, signedUrls } from "@/lib/media";
import { SUGGESTED_TAGS } from "@/lib/contacts-api";
import { buildContactVCard, companyDomain, companyLogoUrl, initials } from "@/lib/card-model";
import { downloadFile, VCF_MIME } from "@/lib/download";
import { draftFollowUp, enrichContact, summarizeNote } from "@/lib/ai.functions";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import {
  canSummarize,
  formatSummaryNote,
  mergeTranscript,
  VOICE_NOTE_PREFIX,
} from "@/lib/voice-notes";
import { buildSuggestions, canEnrich, ENRICH_LABELS, type Suggestion } from "@/lib/enrichment";
import type { FollowUpDraft } from "@/lib/ai-model";

export const Route = createFileRoute("/app/contacts/$id")({ head: appHead('Contact', 'Contact details, notes and follow-ups.'), component: ContactDetail });

const DETAIL_FIELDS = [
  "full_name",
  "email",
  "phone",
  "company",
  "job_title",
  "met_at",
  "website",
  "linkedin_url",
  "address",
] as const;

async function loadContact(id: string) {
  const [c, n, t] = await Promise.all([
    supabase.from("contacts").select("*, cards(label)").eq("id", id).maybeSingle(),
    supabase
      .from("contact_notes")
      .select("*")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("contact_tags").select("*").eq("contact_id", id).order("created_at"),
  ]);
  if (c.error) throw c.error;
  return { contact: c.data, notes: n.data ?? [], tags: t.data ?? [] };
}

function ContactDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const {
    data,
    refetch,
    isError: loadFailed,
  } = useQuery({ queryKey: ["contact", id], queryFn: () => loadContact(id) });
  const photoPath = data?.contact?.photo_path ?? null;
  const { data: photoUrl } = useQuery({
    queryKey: ["contact-photo", photoPath],
    enabled: !!photoPath,
    queryFn: async () => (photoPath ? ((await signedUrls([photoPath]))[photoPath] ?? null) : null),
  });
  const [form, setForm] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [fromVoice, setFromVoice] = useState(false);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const dictationBase = useRef("");
  const speech = useSpeechRecognition(
    (t) => setNote(mergeTranscript(dictationBase.current, t)),
    (msg) => toast.error(msg),
  );
  const [tag, setTag] = useState("");
  const [followUp, setFollowUp] = useState<FollowUpDraft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [enrichSummary, setEnrichSummary] = useState("");

  useEffect(() => {
    const c = data?.contact;
    if (c)
      setForm({
        full_name: c.full_name,
        email: c.email ?? "",
        phone: c.phone ?? "",
        company: c.company ?? "",
        job_title: c.job_title ?? "",
        met_at: c.met_at ?? "",
        website: c.website ?? "",
        linkedin_url: c.linkedin_url ?? "",
        address: c.address ?? "",
      });
  }, [data?.contact]);

  // Warn before closing the tab while detail edits haven't been saved.
  useEffect(() => {
    const c = data?.contact;
    if (!c) return;
    const dirty = DETAIL_FIELDS.some(
      (k) => (form[k] ?? "") !== (((c as Record<string, unknown>)[k] as string | null) ?? ""),
    );
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [form, data?.contact]);

  if (loadFailed && !data)
    return (
      <p className="text-sm text-muted-foreground">
        Couldn’t load this contact.{" "}
        <button type="button" onClick={() => refetch()} className="underline">
          Try again
        </button>
      </p>
    );
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const c = data.contact;
  if (!c)
    return (
      <p>
        Contact not found.{" "}
        <Link to="/app/contacts" className="underline">
          Back
        </Link>
      </p>
    );

  const refresh = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["contacts"] });
  };

  // Edits used to vanish unless you scrolled down to "Save details" — surface a
  // sticky save bar whenever any detail field differs from what's stored.
  const dirty = DETAIL_FIELDS.some(
    (k) => (form[k] ?? "") !== (((c as Record<string, unknown>)[k] as string | null) ?? ""),
  );
  const discardEdits = () =>
    setForm(
      Object.fromEntries(
        DETAIL_FIELDS.map((k) => [k, ((c as Record<string, unknown>)[k] as string | null) ?? ""]),
      ),
    );

  async function saveFields() {
    if (!form["full_name"]?.trim()) {
      toast.error("Name is required");
      return;
    }
    const row = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
    const { error } = await supabase
      .from("contacts")
      .update({ ...row, full_name: (form["full_name"] ?? "").trim() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Saved");
      refresh();
    }
  }
  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim() || !user) return;
    speech.stop();
    const { error } = await supabase.from("contact_notes").insert({
      contact_id: id,
      user_id: user.id,
      body: (fromVoice ? VOICE_NOTE_PREFIX : "") + note.trim(),
    });
    if (error) toast.error(error.message);
    else {
      setNote("");
      setFromVoice(false);
      refresh();
    }
  }
  async function addTag(t: string) {
    const v = t.trim();
    if (!v || !user || data!.tags.some((x) => x.tag.toLowerCase() === v.toLowerCase())) return;
    const { error } = await supabase
      .from("contact_tags")
      .insert({ contact_id: id, user_id: user.id, tag: v.slice(0, 40) });
    if (error) toast.error(error.message);
    else {
      setTag("");
      refresh();
    }
  }
  async function del(table: "contact_tags" | "contact_notes", rowId: string) {
    const { error } = await supabase.from(table).delete().eq("id", rowId);
    if (error) toast.error(error.message);
    else refresh();
  }
  function saveToPhone() {
    const vcf = buildContactVCard({
      full_name: c!.full_name,
      job_title: c!.job_title,
      company: c!.company,
      email: c!.email,
      phone: c!.phone,
      address: c!.address,
      note: c!.met_at ? `Met at ${c!.met_at}` : null,
    });
    downloadFile(`${c!.full_name.replace(/[^\w-]+/g, "-")}.vcf`, vcf, VCF_MIME);
    toast.success("Contact file downloaded — open it to add them to your phone");
  }

  async function generateFollowUp() {
    setDrafting(true);
    try {
      setFollowUp(await draftFollowUp({ data: { contactId: id } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not draft a follow-up");
    } finally {
      setDrafting(false);
    }
  }
  async function copyFollowUp() {
    if (!followUp) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${followUp.subject}\n\n${followUp.body}`);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy — select the text manually");
    }
  }
  async function saveFollowUpAsNote() {
    if (!followUp || !user) return;
    const { error } = await supabase.from("contact_notes").insert({
      contact_id: id,
      user_id: user.id,
      body: `Follow-up draft — ${followUp.subject}\n\n${followUp.body}`,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Saved as note");
      refresh();
    }
  }
  async function runEnrichment() {
    setEnriching(true);
    try {
      const result = await enrichContact({ data: { contactId: id } });
      setSuggestions(buildSuggestions(c!, result));
      setEnrichSummary(result.summary);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not enrich this contact");
    } finally {
      setEnriching(false);
    }
  }
  // Only explicitly accepted values are written; each accept updates just its own field(s).
  async function acceptSuggestions(list: Suggestion[]) {
    if (!list.length) return;
    const patch: Partial<Record<Suggestion["field"], string>> = {};
    for (const s of list) patch[s.field] = s.value;
    const { error } = await supabase.from("contacts").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    const done = new Set(list.map((s) => s.field));
    setSuggestions((prev) => (prev ?? []).filter((s) => !done.has(s.field)));
    toast.success(list.length > 1 ? "Suggestions saved" : `${ENRICH_LABELS[list[0]!.field]} saved`);
    refresh();
  }
  function dismissSuggestion(field: Suggestion["field"]) {
    setSuggestions((prev) => (prev ?? []).filter((s) => s.field !== field));
  }

  function toggleDictation() {
    if (speech.listening) return speech.stop();
    dictationBase.current = note;
    setFromVoice(true);
    speech.start();
  }
  // Saves the summary as a NEW note; the original note is never modified.
  async function summarize(noteId: string) {
    if (!user) return;
    setSummarizingId(noteId);
    try {
      const summary = await summarizeNote({ data: { noteId } });
      const { error } = await supabase
        .from("contact_notes")
        .insert({ contact_id: id, user_id: user.id, body: formatSummaryNote(summary, new Date()) });
      if (error) throw error;
      toast.success("Summary saved as a note");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not summarize this note");
    } finally {
      setSummarizingId(null);
    }
  }

  async function deleteContact() {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void removeMedia([photoPath]).catch(() => {});
    qc.invalidateQueries({ queryKey: ["contacts"] });
    navigate({ to: "/app/contacts" });
  }

  const cardLabel = (c as { cards?: { label: string } | null }).cards?.label;
  // Their company's logo, derived from the scanned card's website or work
  // email — no upload needed, it becomes the banner. Contacts without a
  // company domain (manual entries, share-backs from personal emails) get
  // the ContactKickstart badge until an edit or enrichment adds one.
  const logoDomain = companyDomain({ website: c.website, email: c.email });
  const hasCompanyLogo = !!logoDomain && !logoError;
  const bannerLogo = hasCompanyLogo ? companyLogoUrl(logoDomain, 256) : "/brand/logo-badge.webp";
  const bannerAlt = hasCompanyLogo ? `${c.company || logoDomain} logo` : "ContactKickstart logo";

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/app/contacts"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Contacts
      </Link>
      <div className="mb-8 overflow-hidden rounded-3xl border bg-card">
        <div className="relative h-24 overflow-hidden bg-brand md:h-28">
          <img
            src={bannerLogo}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-150 object-cover opacity-25 blur-2xl"
            loading="lazy"
          />
          <span className="absolute right-4 top-1/2 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-2xl bg-white/95 shadow-md">
            <img
              key={bannerLogo}
              src={bannerLogo}
              alt={bannerAlt}
              className="h-11 w-11 rounded object-contain"
              loading="lazy"
              onError={() => setLogoError(true)}
            />
          </span>
        </div>
        <div className="relative z-10 -mt-12 flex flex-col items-center gap-3 px-6 pb-6 text-center md:-mt-14">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`Photo of ${c.full_name}`}
              className="h-24 w-24 rounded-full border-4 border-card object-cover shadow md:h-28 md:w-28"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-card bg-card bg-[image:linear-gradient(var(--brand-soft),var(--brand-soft))] text-2xl font-semibold text-accent-foreground shadow md:h-28 md:w-28">
              {initials(c.full_name)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{c.full_name}</h1>
            {(c.job_title || c.company) && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {c.job_title}
                {c.job_title && c.company ? " · " : ""}
                {c.company && <span className="font-semibold text-foreground">{c.company}</span>}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Captured {format(new Date(c.created_at), "MMM d, yyyy 'at' h:mm a")}
              {cardLabel
                ? ` via ${cardLabel} card`
                : c.source === "manual"
                  ? " · added manually"
                  : ""}
            </p>
          </div>
        </div>
      </div>
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {c.email && (
          <Button variant="outline" size="sm" asChild>
            <a href={`mailto:${c.email}`}>
              <Mail className="h-4 w-4" />
              Email
            </a>
          </Button>
        )}
        {c.phone && (
          <Button variant="outline" size="sm" asChild>
            <a href={`tel:${c.phone}`}>
              <Phone className="h-4 w-4" />
              Call
            </a>
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={saveToPhone}>
          <Smartphone className="h-4 w-4" />
          Save to phone
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={runEnrichment}
          disabled={enriching || !canEnrich(c)}
          title={canEnrich(c) ? undefined : "Add a company or email first"}
        >
          {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {enriching ? "Researching…" : "Enrich with AI"}
        </Button>
      </div>

      {suggestions && (
        <section className="surface mb-8 space-y-3 p-4" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Sparkles className="h-4 w-4 text-brand" />
                AI suggestions
              </h2>
              {enrichSummary && (
                <p className="mt-1 text-xs text-muted-foreground">{enrichSummary}</p>
              )}
            </div>
            <button
              onClick={() => setSuggestions(null)}
              aria-label="Close suggestions"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {suggestions.length === 0 ? (
            <p className="text-sm">Couldn't find anything reliable — nothing was changed.</p>
          ) : (
            <>
              <ul className="divide-y">
                {suggestions.map((s) => (
                  <li key={s.field} className="flex flex-wrap items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {ENRICH_LABELS[s.field]}
                      </p>
                      <p className="break-words">
                        {s.current ? (
                          <>
                            Replace{" "}
                            <span className="text-muted-foreground line-through">{s.current}</span>{" "}
                            with <span className="font-semibold">{s.value}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-muted-foreground">Empty</span> →{" "}
                            <span className="font-semibold">{s.value}</span>
                          </>
                        )}
                      </p>
                      {s.source && (
                        <p className="mt-0.5 break-all text-xs text-muted-foreground">
                          Source: {s.source}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => acceptSuggestions([s])}>
                        Accept
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => dismissSuggestion(s.field)}>
                        Dismiss
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              {suggestions.length > 1 && (
                <Button size="sm" variant="outline" onClick={() => acceptSuggestions(suggestions)}>
                  Accept all
                </Button>
              )}
            </>
          )}
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold">Follow up</h2>
        {!followUp && (
          <Button variant="outline" size="sm" onClick={generateFollowUp} disabled={drafting}>
            {drafting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {drafting ? "Drafting…" : "Draft follow-up email with AI"}
          </Button>
        )}
        {followUp && (
          <div className="surface space-y-3 p-4">
            <p className="text-sm font-semibold">{followUp.subject}</p>
            <p className="whitespace-pre-wrap text-sm">{followUp.body}</p>
            <div className="flex flex-wrap gap-2">
              {c.email && (
                <Button size="sm" asChild>
                  <a
                    href={`mailto:${c.email}?subject=${encodeURIComponent(followUp.subject)}&body=${encodeURIComponent(followUp.body)}`}
                  >
                    <Mail className="h-4 w-4" />
                    Open in email
                  </a>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={copyFollowUp}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={saveFollowUpAsNote}>
                Save as note
              </Button>
              <Button variant="ghost" size="sm" onClick={generateFollowUp} disabled={drafting}>
                {drafting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Redraft
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold">Tags</h2>
        <div className="flex flex-wrap gap-2">
          {data.tags.map((t) => (
            <Badge key={t.id} className="gap-1 pr-1">
              {t.tag}
              <button
                onClick={() => del("contact_tags", t.id)}
                aria-label={`Remove ${t.tag}`}
                className="rounded-full p-0.5 hover:bg-background/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_TAGS.filter((s) => !data.tags.some((t) => t.tag === s)).map((s) => (
            <button
              key={s}
              onClick={() => addTag(s)}
              className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            >
              + {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addTag(tag);
          }}
          className="mt-3 flex gap-2"
        >
          <Input
            placeholder="Custom tag, e.g. Met at Web Summit"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <Button type="submit" variant="outline">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold">Notes</h2>
        {c.note && (
          <div className="mb-3 rounded-xl bg-muted p-3 text-sm">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Their message</p>
            {c.note}
          </div>
        )}
        <form onSubmit={addNote} className="space-y-2">
          <Textarea
            placeholder="What did you talk about?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={!note.trim()}>
              Add note
            </Button>
            {speech.supported && (
              <Button
                type="button"
                size="sm"
                variant={speech.listening ? "destructive" : "outline"}
                onClick={toggleDictation}
                aria-pressed={speech.listening}
              >
                {speech.listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {speech.listening ? "Stop" : "Voice note"}
              </Button>
            )}
            {speech.listening && (
              <span
                className="flex items-center gap-2 text-xs text-muted-foreground"
                aria-live="polite"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                Listening…
              </span>
            )}
          </div>
          {!speech.supported && (
            <p className="text-xs text-muted-foreground">
              Tip: use your keyboard's dictation mic in the note field to speak a note.
            </p>
          )}
        </form>
        <ul className="mt-4 space-y-2">
          {data.notes.map((n) => (
            <li key={n.id} className="surface flex gap-3 p-3 text-sm">
              <div className="flex-1">
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {format(new Date(n.created_at), "MMM d, yyyy · h:mm a")}
                </p>
                {canSummarize(n.body) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 -ml-2"
                    onClick={() => summarize(n.id)}
                    disabled={summarizingId !== null}
                  >
                    {summarizingId === n.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {summarizingId === n.id ? "Summarizing…" : "Summarize with AI"}
                  </Button>
                )}
              </div>
              <button
                onClick={() => del("contact_notes", n.id)}
                aria-label="Delete note"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8 space-y-3">
        <h2 className="text-lg font-bold">Details</h2>
        {(
          [
            ["full_name", "Name"],
            ["email", "Email"],
            ["phone", "Phone"],
            ["company", "Company"],
            ["job_title", "Title"],
            ["met_at", "Where you met"],
            ["website", "Website"],
            ["linkedin_url", "LinkedIn"],
            ["address", "Address"],
          ] as const
        ).map(([k, l]) => (
          <div key={k} className="space-y-1">
            <Label>{l}</Label>
            <Input
              value={form[k] ?? ""}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </div>
        ))}
        <Button onClick={saveFields}>Save details</Button>
      </section>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" className="text-destructive">
            <Trash2 className="h-4 w-4" />
            Delete contact
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {c.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their notes and tags are deleted too. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteContact}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {dirty && (
        <div
          className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border bg-background/95 p-3 pl-4 shadow-lg backdrop-blur md:bottom-6"
          role="status"
        >
          <span className="text-sm font-medium">Unsaved changes</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={discardEdits}>
              Discard
            </Button>
            <Button size="sm" onClick={saveFields}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
