import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listContacts } from "@/lib/contacts-api";
import { listCards } from "@/lib/cards-api";
import { signedUrls } from "@/lib/media";
import { contactsToCsv, initials } from "@/lib/card-model";

export const Route = createFileRoute("/app/contacts/")({ component: ContactsPage });

const RANGES = { all: "Any time", "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days" } as const;

function ContactsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: listContacts,
  });
  const { data: cards = [] } = useQuery({ queryKey: ["cards"], queryFn: listCards });

  // Opening this page clears the "new leads" badge in the nav.
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .update({ contacts_seen_at: new Date().toISOString() })
      .eq("id", user.id)
      .then(() => qc.invalidateQueries({ queryKey: ["new-leads"] }));
  }, [user, qc]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("all");
  const [cardId, setCardId] = useState("all");
  const [range, setRange] = useState<keyof typeof RANGES>("all");
  const [addOpen, setAddOpen] = useState(false);

  const photoPaths = useMemo(
    () => contacts.map((c) => c.photo_path).filter((p): p is string => !!p),
    [contacts],
  );
  const { data: photoUrls = {} } = useQuery({
    queryKey: ["contact-photos", photoPaths],
    enabled: photoPaths.length > 0,
    queryFn: () => signedUrls(photoPaths),
  });

  const cardLabel = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c.label])), [cards]);
  const allTags = useMemo(
    () => Array.from(new Set(contacts.flatMap((c) => c.tags))).sort(),
    [contacts],
  );

  const filtered = contacts.filter((c) => {
    const s = q.trim().toLowerCase();
    if (
      s &&
      ![c.full_name, c.email, c.company, c.phone, c.met_at].some((v) =>
        v?.toLowerCase().includes(s),
      )
    )
      return false;
    if (tag !== "all" && !c.tags.includes(tag)) return false;
    if (cardId !== "all" && c.card_id !== cardId) return false;
    if (range !== "all" && Date.now() - new Date(c.created_at).getTime() > Number(range) * 864e5)
      return false;
    return true;
  });

  function exportCsv() {
    const csv = contactsToCsv(
      filtered.map((c) => ({
        ...c,
        card_label: c.card_id ? (cardLabel[c.card_id] ?? null) : null,
      })),
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `contacts-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">{contacts.length} people you've met</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>
      <div className="mb-5 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, company, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger className="sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {allTags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cardId} onValueChange={setCardId}>
          <SelectTrigger className="sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cards</SelectItem>
            {cards.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={(v) => setRange(v as keyof typeof RANGES)}>
          <SelectTrigger className="sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RANGES).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="surface p-10 text-center">
          <p className="font-semibold">No contacts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When someone shares their details from your card, they'll appear here.
          </p>
        </div>
      ) : (
        <ul className="surface divide-y">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                to="/app/contacts/$id"
                params={{ id: c.id }}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/50"
              >
                {c.photo_path && photoUrls[c.photo_path] ? (
                  <img
                    src={photoUrls[c.photo_path]}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full border object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-accent-foreground">
                    {initials(c.full_name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.full_name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[c.job_title, c.company].filter(Boolean).join(" · ") || c.email || c.phone}
                  </p>
                  {c.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="hidden text-right text-xs text-muted-foreground sm:block">
                  <p>{format(new Date(c.created_at), "MMM d, yyyy · h:mm a")}</p>
                  <p>
                    {c.met_at ||
                      (c.card_id ? `${cardLabel[c.card_id] ?? "Card"} card` : "Added manually")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <AddContact open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function AddContact({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const empty = { full_name: "", email: "", phone: "", company: "", job_title: "", met_at: "", note: "" };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const row = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null])) as Record<keyof typeof empty, string | null>;
    const { error } = await supabase.from("contacts").insert({ ...row, full_name: f.full_name.trim(), user_id: user.id, source: "manual" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setF(empty);
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["contacts"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Input required placeholder="Name *" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <Input type="tel" placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <Input placeholder="Company" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
            <Input placeholder="Title" value={f.job_title} onChange={(e) => setF({ ...f, job_title: e.target.value })} />
          </div>
          <Input placeholder="Where you met (e.g. SaaStr 2026)" value={f.met_at} onChange={(e) => setF({ ...f, met_at: e.target.value })} />
          <Textarea placeholder="Note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <Button type="submit" className="w-full" disabled={busy}>Save contact</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
