import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Phone, Plus, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SUGGESTED_TAGS } from "@/lib/contacts-api";
import { initials } from "@/lib/card-model";

export const Route = createFileRoute("/app/contacts/$id")({ component: ContactDetail });

async function loadContact(id: string) {
  const [c, n, t] = await Promise.all([
    supabase.from("contacts").select("*, cards(label)").eq("id", id).maybeSingle(),
    supabase.from("contact_notes").select("*").eq("contact_id", id).order("created_at", { ascending: false }),
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
  const { data, refetch } = useQuery({ queryKey: ["contact", id], queryFn: () => loadContact(id) });
  const [form, setForm] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [tag, setTag] = useState("");

  useEffect(() => {
    const c = data?.contact;
    if (c) setForm({ full_name: c.full_name, email: c.email ?? "", phone: c.phone ?? "", company: c.company ?? "", job_title: c.job_title ?? "", met_at: c.met_at ?? "" });
  }, [data?.contact]);

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const c = data.contact;
  if (!c) return <p>Contact not found. <Link to="/app/contacts" className="underline">Back</Link></p>;

  const refresh = () => { refetch(); qc.invalidateQueries({ queryKey: ["contacts"] }); };

  async function saveFields() {
    if (!form["full_name"]?.trim()) { toast.error("Name is required"); return; }
    const row = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
    const { error } = await supabase.from("contacts").update({ ...row, full_name: (form["full_name"] ?? "").trim() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Saved"); refresh(); }
  }
  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim() || !user) return;
    const { error } = await supabase.from("contact_notes").insert({ contact_id: id, user_id: user.id, body: note.trim() });
    if (error) toast.error(error.message); else { setNote(""); refresh(); }
  }
  async function addTag(t: string) {
    const v = t.trim();
    if (!v || !user || data!.tags.some((x) => x.tag.toLowerCase() === v.toLowerCase())) return;
    const { error } = await supabase.from("contact_tags").insert({ contact_id: id, user_id: user.id, tag: v.slice(0, 40) });
    if (error) toast.error(error.message); else { setTag(""); refresh(); }
  }
  async function del(table: "contact_tags" | "contact_notes", rowId: string) {
    const { error } = await supabase.from(table).delete().eq("id", rowId);
    if (error) toast.error(error.message); else refresh();
  }
  async function deleteContact() {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["contacts"] });
    navigate({ to: "/app/contacts" });
  }

  const cardLabel = (c as { cards?: { label: string } | null }).cards?.label;

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/app/contacts" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Contacts</Link>
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-xl font-semibold text-accent-foreground">{initials(c.full_name)}</div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{c.full_name}</h1>
          <p className="text-sm text-muted-foreground">Captured {format(new Date(c.created_at), "MMM d, yyyy 'at' h:mm a")}{cardLabel ? ` via ${cardLabel} card` : c.source === "manual" ? " · added manually" : ""}</p>
        </div>
      </div>
      <div className="mb-8 flex gap-2">
        {c.email && <Button variant="outline" size="sm" asChild><a href={`mailto:${c.email}`}><Mail className="h-4 w-4" />Email</a></Button>}
        {c.phone && <Button variant="outline" size="sm" asChild><a href={`tel:${c.phone}`}><Phone className="h-4 w-4" />Call</a></Button>}
      </div>

      <section className="mb-8"><h2 className="mb-3 text-lg font-bold">Tags</h2>
        <div className="flex flex-wrap gap-2">
          {data.tags.map((t) => <Badge key={t.id} className="gap-1 pr-1">{t.tag}<button onClick={() => del("contact_tags", t.id)} aria-label={`Remove ${t.tag}`} className="rounded-full p-0.5 hover:bg-background/20"><X className="h-3 w-3" /></button></Badge>)}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_TAGS.filter((s) => !data.tags.some((t) => t.tag === s)).map((s) => <button key={s} onClick={() => addTag(s)} className="rounded-full border px-3 py-1 text-xs hover:bg-muted">+ {s}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); addTag(tag); }} className="mt-3 flex gap-2"><Input placeholder="Custom tag, e.g. Met at Web Summit" value={tag} onChange={(e) => setTag(e.target.value)} /><Button type="submit" variant="outline"><Plus className="h-4 w-4" /></Button></form>
      </section>

      <section className="mb-8"><h2 className="mb-3 text-lg font-bold">Notes</h2>
        {c.note && <div className="mb-3 rounded-xl bg-muted p-3 text-sm"><p className="mb-1 text-xs font-semibold text-muted-foreground">Their message</p>{c.note}</div>}
        <form onSubmit={addNote} className="space-y-2"><Textarea placeholder="What did you talk about?" value={note} onChange={(e) => setNote(e.target.value)} /><Button type="submit" size="sm" disabled={!note.trim()}>Add note</Button></form>
        <ul className="mt-4 space-y-2">
          {data.notes.map((n) => (
            <li key={n.id} className="surface flex gap-3 p-3 text-sm">
              <div className="flex-1"><p className="whitespace-pre-wrap">{n.body}</p><p className="mt-1 text-xs text-muted-foreground">{format(new Date(n.created_at), "MMM d, yyyy · h:mm a")}</p></div>
              <button onClick={() => del("contact_notes", n.id)} aria-label="Delete note" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8 space-y-3"><h2 className="text-lg font-bold">Details</h2>
        {([["full_name", "Name"], ["email", "Email"], ["phone", "Phone"], ["company", "Company"], ["job_title", "Title"], ["met_at", "Where you met"]] as const).map(([k, l]) => (
          <div key={k} className="space-y-1"><Label>{l}</Label><Input value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
        ))}
        <Button onClick={saveFields}>Save details</Button>
      </section>

      <AlertDialog>
        <AlertDialogTrigger asChild><Button variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" />Delete contact</Button></AlertDialogTrigger>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {c.full_name}?</AlertDialogTitle><AlertDialogDescription>Their notes and tags are deleted too. This can't be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteContact}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
