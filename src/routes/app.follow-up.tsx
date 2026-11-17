import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlarmClock,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Mail,
  MessageSquare,
  PartyPopper,
  ScanLine,
  Sparkles,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { appHead } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AllowanceNote } from "@/components/AllowanceNote";
import { useAuth } from "@/hooks/use-auth";
import { draftFollowUp } from "@/lib/ai.functions";
import type { FollowUpDraft } from "@/lib/ai-model";
import {
  emailHref,
  followUpRate,
  plainDraft,
  QUICK_PICKS,
  quickPickDate,
  queueState,
  smsHref,
} from "@/lib/followups";
import {
  loadQueue,
  markDone,
  myFirstCardName,
  QUEUE_COUNT_KEY,
  QUEUE_KEY,
  reopen,
  saveDraft,
  snooze,
  type QueueItem,
} from "@/lib/follow-up-api";
import { cn } from "@/lib/utils";

// The follow-up queue: everyone you met, a draft ready for each, and one tap
// to send, snooze or close. New contacts land here on their own.

export const Route = createFileRoute("/app/follow-up")({
  head: appHead("Follow up", "Everyone you met, with a follow-up ready to send."),
  component: FollowUpPage,
});

const SNOOZES = QUICK_PICKS.filter((p) => p.id !== "2w");

function FollowUpPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: QUEUE_KEY,
    enabled: !!user,
    queryFn: () => loadQueue(user!.id),
  });
  const { data: sender } = useQuery({
    queryKey: ["first-card-name", user?.id],
    enabled: !!user,
    queryFn: () => myFirstCardName(user!.id),
    staleTime: 5 * 60_000,
  });
  const [open, setOpen] = useState<string | null>(null);

  const now = new Date();
  const due = (data?.open ?? []).filter((c) => queueState(c, now) === "due");
  const later = (data?.open ?? []).filter((c) => queueState(c, now) === "later");
  // The first one due starts open, so the page is ready to act on.
  const expanded = open ?? due[0]?.id ?? null;

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: QUEUE_KEY }),
      qc.invalidateQueries({ queryKey: QUEUE_COUNT_KEY }),
    ]);
  }

  async function close(item: QueueItem, outcome: "sent" | "skipped") {
    try {
      await markDone(item.id, outcome);
      setOpen(null);
      await refresh();
      toast.success(
        outcome === "sent"
          ? `Followed up with ${firstName(item.full_name)}`
          : `${firstName(item.full_name)} is off your list`,
        {
          action: {
            label: "Undo",
            onClick: () => void reopen(item.id).then(refresh),
          },
        },
      );
    } catch {
      toast.error("Couldn't update that. Try again.");
    }
  }

  async function later_(item: QueueItem, pick: string) {
    try {
      await snooze(item.id, quickPickDate(pick));
      setOpen(null);
      await refresh();
      toast.success(`We'll bring ${firstName(item.full_name)} back ${pickLabel(pick)}`);
    } catch {
      toast.error("Couldn't snooze that. Try again.");
    }
  }

  const rate = data ? followUpRate(data.met30, data.sent30) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Follow up</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone you meet lands here with a draft ready. Send it, snooze it, or close it.
          </p>
        </div>
        {rate !== null && data && (
          <div className="surface rounded-2xl px-4 py-3 text-right">
            <p className="font-display text-2xl font-extrabold leading-none">{rate}%</p>
            <p className="mt-1 text-xs text-muted-foreground">
              followed up · {data.sent30} of {data.met30} in 30 days
            </p>
          </div>
        )}
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : due.length === 0 ? (
        <section className="surface rounded-3xl p-8 text-center">
          <PartyPopper className="mx-auto h-8 w-8 text-brand" />
          <h2 className="mt-3 font-display text-xl font-extrabold">You're all caught up</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Scan a card or share yours, and the next person you meet shows up here with a draft
            ready.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/app/scan">
              <ScanLine className="h-4 w-4" />
              Scan a card
            </Link>
          </Button>
        </section>
      ) : (
        <Section title="Due now" count={due.length}>
          {due.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              sender={sender ?? null}
              expanded={expanded === item.id}
              onToggle={() => setOpen(expanded === item.id ? "" : item.id)}
              onDone={(o) => void close(item, o)}
              onSnooze={(p) => void later_(item, p)}
            />
          ))}
        </Section>
      )}

      {later.length > 0 && (
        <Section title="Snoozed" count={later.length}>
          {later.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              sender={sender ?? null}
              expanded={expanded === item.id}
              onToggle={() => setOpen(expanded === item.id ? "" : item.id)}
              onDone={(o) => void close(item, o)}
              onSnooze={(p) => void later_(item, p)}
            />
          ))}
        </Section>
      )}

      {(data?.recentlyDone.length ?? 0) > 0 && (
        <Section title="Done this week" count={data!.recentlyDone.length}>
          {data!.recentlyDone.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <Check className="h-4 w-4" />
              </span>
              <Link
                to="/app/contacts/$id"
                params={{ id: item.id }}
                className="min-w-0 flex-1 text-sm"
              >
                <span className="block truncate font-semibold">{item.full_name}</span>
                <span className="block text-xs text-muted-foreground">
                  {item.follow_up_outcome === "sent" ? "Followed up" : "No follow-up needed"}
                  {item.follow_up_done_at &&
                    ` · ${formatDistanceToNow(new Date(item.follow_up_done_at), { addSuffix: true })}`}
                </span>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => void reopen(item.id).then(refresh)}>
                <Undo2 className="h-4 w-4" />
                Reopen
              </Button>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title} · {count}
      </h2>
      <div className="surface divide-y overflow-hidden rounded-3xl">{children}</div>
    </section>
  );
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function pickLabel(id: string) {
  return (QUICK_PICKS.find((p) => p.id === id)?.label ?? "later").toLowerCase();
}

function QueueCard({
  item,
  sender,
  expanded,
  onToggle,
  onDone,
  onSnooze,
}: {
  item: QueueItem;
  sender: { full_name: string } | null;
  expanded: boolean;
  onToggle: () => void;
  onDone: (outcome: "sent" | "skipped") => void;
  onSnooze: (pick: string) => void;
}) {
  const where = item.event || item.met_at;
  const snoozed = queueState(item) === "later";
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft font-display text-sm font-extrabold text-brand">
          {initials(item.full_name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{item.full_name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {snoozed && item.follow_up_due_at
              ? `Back ${formatDistanceToNow(new Date(item.follow_up_due_at), { addSuffix: true })}`
              : [item.company, where && `met at ${where}`].filter(Boolean).join(" · ") ||
                sourceLabel(item.source)}
          </span>
        </span>
        {/* Phones keep the room for the name. */}
        <span className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>
      {expanded && <Composer item={item} sender={sender} onDone={onDone} onSnooze={onSnooze} />}
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
}

function sourceLabel(source: string) {
  return source === "shareback"
    ? "Shared their details with you"
    : source === "scan"
      ? "Scanned card"
      : "Added by you";
}

function Composer({
  item,
  sender,
  onDone,
  onSnooze,
}: {
  item: QueueItem;
  sender: { full_name: string } | null;
  onDone: (outcome: "sent" | "skipped") => void;
  onSnooze: (pick: string) => void;
}) {
  const qc = useQueryClient();
  const initial = useMemo<FollowUpDraft>(
    () => item.follow_up_draft ?? plainDraft(item, sender, item.event),
    [item, sender],
  );
  const [draft, setDraft] = useState<FollowUpDraft>(initial);
  const [dirty, setDirty] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const hasAiDraft = !!item.follow_up_draft;

  // A new draft (AI, or the sender's name arriving) replaces the text unless
  // they've started editing it.
  useEffect(() => {
    if (!dirty) setDraft(initial);
  }, [initial, dirty]);

  async function persist() {
    if (!dirty) return;
    try {
      await saveDraft(item.id, draft);
    } catch {
      // Their edits are still on screen; saving is a convenience.
    }
  }

  async function aiDraft() {
    setDrafting(true);
    try {
      const d = await draftFollowUp({ data: { contactId: item.id } });
      setDraft(d);
      setDirty(false);
      await qc.invalidateQueries({ queryKey: QUEUE_KEY });
      await qc.invalidateQueries({ queryKey: ["billing"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't write the draft");
    } finally {
      setDrafting(false);
    }
  }

  async function copy() {
    await navigator.clipboard
      .writeText(`Subject: ${draft.subject}\n\n${draft.body}`)
      .catch(() => undefined);
    toast.success("Copied");
  }

  return (
    <div className="space-y-3 border-t bg-muted/30 px-4 pb-4 pt-3">
      <Input
        aria-label="Subject"
        value={draft.subject}
        onChange={(e) => {
          setDraft({ ...draft, subject: e.target.value });
          setDirty(true);
        }}
        onBlur={() => void persist()}
        className="bg-background font-semibold"
      />
      <Textarea
        aria-label="Message"
        value={draft.body}
        rows={8}
        onChange={(e) => {
          setDraft({ ...draft, body: e.target.value });
          setDirty(true);
        }}
        onBlur={() => void persist()}
        className="bg-background text-sm"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void aiDraft()} disabled={drafting}>
          {drafting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {drafting ? "Writing…" : hasAiDraft ? "Rewrite with AI" : "Write it with AI"}
        </Button>
        {!hasAiDraft && (
          <span className="text-xs text-muted-foreground">
            Uses what you know about them: where you met, your notes, their message.
          </span>
        )}
      </div>
      <AllowanceNote kind="follow_up" />

      <div className="flex flex-wrap gap-2 pt-1">
        {item.email && (
          <Button size="sm" asChild className="rounded-full">
            <a
              href={emailHref(item.email, draft)}
              onClick={() => {
                void persist();
                // Give the mail app a moment to open before the card closes.
                setTimeout(() => onDone("sent"), 400);
              }}
            >
              <Mail className="h-4 w-4" />
              Send email
            </a>
          </Button>
        )}
        {item.phone && (
          <Button
            size="sm"
            variant={item.email ? "outline" : "default"}
            asChild
            className="rounded-full"
          >
            <a
              href={smsHref(item.phone, draft.body)}
              onClick={() => {
                void persist();
                setTimeout(() => onDone("sent"), 400);
              }}
            >
              <MessageSquare className="h-4 w-4" />
              Send text
            </a>
          </Button>
        )}
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => void copy()}>
          <Copy className="h-4 w-4" />
          Copy
        </Button>
        {!item.email && !item.phone && (
          <Button size="sm" className="rounded-full" onClick={() => onDone("sent")}>
            <Check className="h-4 w-4" />I sent it
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="rounded-full">
              <AlarmClock className="h-4 w-4" />
              Snooze
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {SNOOZES.map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => onSnooze(p.id)}>
                {p.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full text-muted-foreground"
          onClick={() => onDone("skipped")}
        >
          No follow-up needed
        </Button>
      </div>
      <Link
        to="/app/contacts/$id"
        params={{ id: item.id }}
        className="inline-block text-xs font-semibold text-muted-foreground underline hover:text-foreground"
      >
        Open {firstName(item.full_name)}'s contact
      </Link>
    </div>
  );
}
