import { appHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Download,
  MapPin,
  Plus,
  QrCode,
  Reply,
  ScanLine,
  Search,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { format, isThisWeek, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listContacts } from "@/lib/contacts-api";
import { listCards } from "@/lib/cards-api";
import { signedUrls } from "@/lib/media";
import { contactsToCsv, initials } from "@/lib/card-model";
import { usePlan } from "@/components/PremiumGate";
import { EventModeBar } from "@/components/contacts/EventMode";
import { BulkRemindButton, FollowUpsPanel } from "@/components/contacts/Reminders";
import { listEvents } from "@/lib/events-api";
import { SharebackNote } from "@/components/SharebackNote";

export const Route = createFileRoute("/app/contacts/")({
  head: appHead("Contacts", "Search, tag and export the contacts you've captured."),
  component: ContactsPage,
});

const RANGES = {
  all: "Any time",
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
} as const;

// How each contact got here, shown as a colored tag on the row.
const SOURCES: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  shareback: { label: "Shared back", icon: Reply, className: "bg-pop-rose-soft text-pop-rose" },
  scan: { label: "Scanned", icon: ScanLine, className: "bg-pop-teal-soft text-pop-teal" },
  manual: { label: "Added", icon: UserPlus, className: "bg-muted text-muted-foreground" },
};

// Avatar tints for people without a photo, picked from the name so a
// person keeps the same color everywhere.
const TINTS = [
  "from-brand to-[#7A5CFF]",
  "from-pop-rose to-[#FF7A59]",
  "from-pop-teal to-brand",
  "from-[#0E1230] to-brand",
  "from-[#7A5CFF] to-pop-rose",
];
function tintFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

function dayGroup(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d)) return "Earlier this week";
  return format(d, "MMMM yyyy");
}

function ContactsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const {
    data: contacts = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["contacts"],
    queryFn: listContacts,
  });
  const { data: cards = [] } = useQuery({ queryKey: ["cards"], queryFn: listCards });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: listEvents });

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
  const [eventId, setEventId] = useState("all");
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
  const eventName = useMemo(
    () => Object.fromEntries(events.map((e) => [e.id, e.name])) as Record<string, string>,
    [events],
  );
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
    if (eventId !== "all" && c.event_id !== eventId) return false;
    if (range !== "all" && Date.now() - new Date(c.created_at).getTime() > Number(range) * 864e5)
      return false;
    return true;
  });

  const { isPro } = usePlan();

  const stats = useMemo(
    () => ({
      week: contacts.filter((c) => Date.now() - new Date(c.created_at).getTime() <= 7 * 864e5)
        .length,
      shareback: contacts.filter((c) => c.source === "shareback").length,
      scan: contacts.filter((c) => c.source === "scan").length,
    }),
    [contacts],
  );

  // Newest first (the list arrives sorted), bucketed by day.
  const groups: [string, typeof filtered][] = [];
  for (const c of filtered) {
    const g = dayGroup(c.created_at);
    const last = groups[groups.length - 1];
    if (last && last[0] === g) last[1].push(c);
    else groups.push([g, [c]]);
  }

  // CSV export is on every plan: a customer's contacts are theirs to take anywhere.
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {contacts.length} {contacts.length === 1 ? "person" : "people"} you've met
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/app/scan"
            className="inline-flex items-center gap-2 rounded-full bg-pop-lime px-4 py-2 text-sm font-extrabold text-[#0E1230] transition-transform hover:-translate-y-0.5"
          >
            <ScanLine className="h-4 w-4" />
            Scan a card
          </Link>
          <Button
            className="rounded-full bg-brand text-white hover:bg-brand/90"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={exportCsv}
            disabled={!filtered.length}
            aria-label="Export CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>
      {contacts.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { label: "This week", value: stats.week, icon: Users, onClick: () => setRange("7") },
            { label: "Shared back", value: stats.shareback, icon: Reply },
            { label: "Scanned", value: stats.scan, icon: ScanLine },
          ].map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={t.onClick}
              disabled={!t.onClick}
              className="surface rounded-2xl p-3 text-left transition-colors enabled:hover:border-brand sm:p-4"
            >
              <t.icon className="h-4 w-4 text-brand" />
              <p className="mt-2 font-display text-2xl font-extrabold tabular-nums">{t.value}</p>
              <p className="text-[11px] font-medium text-muted-foreground">{t.label}</p>
            </button>
          ))}
        </div>
      )}
      <EventModeBar
        events={events}
        isPro={isPro}
        countFor={(id) => contacts.filter((c) => c.event_id === id).length}
        onShowEvent={setEventId}
      />
      <SharebackNote className="mb-4" />
      <FollowUpsPanel />
      <div
        className={`surface mb-6 grid gap-2 rounded-2xl p-2 ${contacts.length ? "" : "hidden"} ${events.length ? "grid-cols-4 sm:grid-cols-[1fr_auto_auto_auto_auto]" : "grid-cols-3 sm:grid-cols-[1fr_auto_auto_auto]"}`}
      >
        <div className="relative col-span-full sm:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="border-0 bg-muted/60 pl-9 shadow-none"
            aria-label="Search contacts"
            placeholder="Search name, company, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger className="min-w-0 px-2.5 text-xs sm:w-36 sm:px-3 sm:text-sm">
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
          <SelectTrigger className="min-w-0 px-2.5 text-xs sm:w-36 sm:px-3 sm:text-sm">
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
        {events.length > 0 && (
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger
              className="min-w-0 px-2.5 text-xs sm:w-40 sm:px-3 sm:text-sm"
              aria-label="Event"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={range} onValueChange={(v) => setRange(v as keyof typeof RANGES)}>
          <SelectTrigger className="min-w-0 px-2.5 text-xs sm:w-36 sm:px-3 sm:text-sm">
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
      {eventId !== "all" && eventName[eventId] && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-brand" />
            {eventName[eventId]} · {filtered.length} contact{filtered.length === 1 ? "" : "s"}
          </p>
          <BulkRemindButton contactIds={filtered.map((c) => c.id)} eventName={eventName[eventId]} />
        </div>
      )}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="surface p-10 text-center" role="alert">
          <p className="font-semibold">Couldn't load your contacts</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Check your connection and try again — nothing has been lost.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : filtered.length === 0 && contacts.length > 0 ? (
        <div className="surface p-10 text-center">
          <p className="font-semibold">No contacts match</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different search, or clear the filters.
          </p>
          <Button
            variant="ghost"
            className="mt-3"
            onClick={() => {
              setQ("");
              setTag("all");
              setCardId("all");
              setEventId("all");
              setRange("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <section className="dark relative overflow-hidden rounded-[2rem] bg-[#0B0D1C] p-8 text-center text-foreground sm:p-12">
          <div className="qq-dots pointer-events-none absolute inset-0 opacity-[0.07]" />
          <div className="relative">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-pop-lime text-[#0E1230]">
              <Users className="h-7 w-7" />
            </span>
            <h2 className="mt-5 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              Your people land here.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/60">
              Hold up your QR. When someone saves you and shares their details back, they show up
              here automatically. Got a stack of paper cards? Scan them in.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/app/qr"
                className="inline-flex items-center gap-2 rounded-full bg-pop-lime px-5 py-3 text-sm font-extrabold text-[#0E1230]"
              >
                <QrCode className="h-4 w-4" />
                Show my QR
              </Link>
              <Link
                to="/app/scan"
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15"
              >
                <ScanLine className="h-4 w-4" />
                Scan business cards
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <div className="space-y-7">
          {groups.map(([group, rows]) => (
            <section key={group}>
              <h2 className="mb-2.5 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {group}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tracking-normal">
                  {rows.length}
                </span>
              </h2>
              <ul className="space-y-2">
                {rows.map((c) => {
                  const src = SOURCES[c.source ?? ""] ?? SOURCES["manual"]!;
                  return (
                    <li key={c.id}>
                      <Link
                        to="/app/contacts/$id"
                        params={{ id: c.id }}
                        className="group flex items-center gap-4 rounded-2xl border bg-surface px-4 py-3.5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-float"
                      >
                        {c.photo_path && photoUrls[c.photo_path] ? (
                          <img
                            src={photoUrls[c.photo_path]}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-2xl object-cover"
                          />
                        ) : (
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br font-display text-sm font-extrabold text-white ${tintFor(c.full_name)}`}
                          >
                            {initials(c.full_name)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-[1.05rem] font-bold">
                            {c.full_name}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {[c.job_title, c.company].filter(Boolean).join(" · ") ||
                              c.email ||
                              c.phone}
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${src.className}`}
                            >
                              <src.icon className="h-3 w-3" />
                              {src.label}
                            </span>
                            {c.event_id && eventName[c.event_id] && (
                              <Badge variant="outline" className="gap-1 rounded-full text-[10px]">
                                <MapPin className="h-3 w-3" />
                                {eventName[c.event_id]}
                              </Badge>
                            )}
                            {c.tags.map((t) => (
                              <Badge
                                key={t}
                                variant="secondary"
                                className="rounded-full text-[10px]"
                              >
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                          <p className="font-semibold text-foreground">
                            {format(new Date(c.created_at), "h:mm a")}
                          </p>
                          <p>{format(new Date(c.created_at), "MMM d")}</p>
                          <p className="max-w-[12rem] truncate">
                            {c.met_at ||
                              (c.card_id ? `via ${cardLabel[c.card_id] ?? "your"} card` : "")}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      <AddContact open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function AddContact({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const empty = {
    full_name: "",
    email: "",
    phone: "",
    company: "",
    job_title: "",
    met_at: "",
    note: "",
  };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const row = Object.fromEntries(
      Object.entries(f).map(([k, v]) => [k, v.trim() || null]),
    ) as Record<keyof typeof empty, string | null>;
    const { error } = await supabase
      .from("contacts")
      .insert({ ...row, full_name: f.full_name.trim(), user_id: user.id, source: "manual" });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setF(empty);
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["contacts"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Input
            required
            aria-label="Name"
            placeholder="Name *"
            value={f.full_name}
            onChange={(e) => setF({ ...f, full_name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="email"
              aria-label="Email"
              autoComplete="off"
              placeholder="Email"
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })}
            />
            <Input
              type="tel"
              aria-label="Phone"
              autoComplete="off"
              placeholder="Phone"
              value={f.phone}
              onChange={(e) => setF({ ...f, phone: e.target.value })}
            />
            <Input
              aria-label="Company"
              placeholder="Company"
              value={f.company}
              onChange={(e) => setF({ ...f, company: e.target.value })}
            />
            <Input
              aria-label="Title"
              placeholder="Title"
              value={f.job_title}
              onChange={(e) => setF({ ...f, job_title: e.target.value })}
            />
          </div>
          <Input
            aria-label="Where you met"
            placeholder="Where you met (e.g. SaaStr 2026)"
            value={f.met_at}
            onChange={(e) => setF({ ...f, met_at: e.target.value })}
          />
          <Textarea
            aria-label="Note"
            placeholder="Note"
            value={f.note}
            onChange={(e) => setF({ ...f, note: e.target.value })}
          />
          <Button type="submit" className="w-full" disabled={busy}>
            Save contact
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
