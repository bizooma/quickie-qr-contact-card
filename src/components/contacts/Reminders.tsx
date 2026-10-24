import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Bell, BellRing, Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PremiumUpsell, usePlan } from "@/components/PremiumGate";
import {
  addReminders,
  completeReminder,
  deleteReminder,
  listOpenReminders,
  type ReminderRow,
} from "@/lib/events-api";
import { dueGroup, QUICK_PICKS, quickPickDate } from "@/lib/followups";

const KEY = ["reminders"];

export function useOpenReminders(enabled: boolean) {
  return useQuery({ queryKey: KEY, queryFn: listOpenReminders, enabled });
}

function notificationsOff(): boolean {
  return typeof Notification !== "undefined" && Notification.permission !== "granted";
}

/** Quick picks plus a custom date/time and an optional note. */
function RemindPicker({
  busy,
  onPick,
}: {
  busy: boolean;
  onPick: (when: Date, note: string) => void;
}) {
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {QUICK_PICKS.map((p) => (
          <Hint key={p.id} label={format(quickPickDate(p.id), "EEEE, MMM d 'at' h:mm a")}>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onPick(quickPickDate(p.id), note)}
            >
              {p.label}
            </Button>
          </Hint>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="datetime-local"
          aria-label="Custom date and time"
          className="h-9 w-auto"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <Button size="sm" disabled={busy || !custom} onClick={() => onPick(new Date(custom), note)}>
          Set
        </Button>
      </div>
      <Input
        aria-label="Follow-up note"
        placeholder="What to follow up about (optional)"
        maxLength={300}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="h-9"
      />
      {notificationsOff() && (
        <p className="text-xs text-muted-foreground">
          Reminders arrive as phone notifications —{" "}
          <Link to="/app/settings" className="underline">
            turn on notifications in Settings
          </Link>
          . They also show at the top of Contacts.
        </p>
      )}
    </div>
  );
}

function when(r: ReminderRow): string {
  const d = new Date(r.remind_at);
  const g = dueGroup(d);
  if (g === "overdue") return `Overdue · ${format(d, "MMM d")}`;
  if (g === "today") return `Today · ${format(d, "h:mm a")}`;
  return format(d, "EEE, MMM d · h:mm a");
}

function ReminderItem({ r, showName }: { r: ReminderRow; showName: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const overdue = dueGroup(new Date(r.remind_at)) === "overdue";
  async function act(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: KEY });
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="flex items-center gap-3 py-2.5">
      <BellRing className={`h-4 w-4 shrink-0 ${overdue ? "text-destructive" : "text-brand"}`} />
      <div className="min-w-0 flex-1">
        {showName ? (
          <Link
            to="/app/contacts/$id"
            params={{ id: r.contact_id }}
            className="block truncate text-sm font-semibold hover:underline"
          >
            {r.contacts?.full_name ?? "Contact"}
          </Link>
        ) : null}
        <p className={`text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
          {when(r)}
          {r.note ? ` — ${r.note}` : ""}
        </p>
      </div>
      <Hint label="You followed up — clear this reminder">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void act(() => completeReminder(r.id), "Marked done")}
        >
          <Check className="h-4 w-4" />
          Done
        </Button>
      </Hint>
      {!showName && (
        <Hint label="Delete this reminder">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete reminder"
            disabled={busy}
            onClick={() => void act(() => deleteReminder(r.id), "Reminder deleted")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </Hint>
      )}
    </li>
  );
}

/** Contact page: this contact's reminders and a way to add one (Premium). */
export function ContactReminders({
  contactId,
  firstName,
}: {
  contactId: string;
  firstName: string;
}) {
  const { plan, isPremium } = usePlan();
  const qc = useQueryClient();
  const { data: all = [] } = useOpenReminders(isPremium);
  const [busy, setBusy] = useState(false);
  if (!plan) return null;
  if (!isPremium) {
    return <PremiumUpsell feature="Follow-up reminders" />;
  }
  const mine = all.filter((r) => r.contact_id === contactId);

  async function add(when: Date, note: string) {
    if (Number.isNaN(when.getTime())) return;
    setBusy(true);
    try {
      await addReminders([contactId], when, note);
      await qc.invalidateQueries({ queryKey: KEY });
      toast.success(
        `We'll remind you ${formatDistanceToNowStrict(when, { addSuffix: true })} to follow up with ${firstName}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not set the reminder");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Bell className="h-4 w-4 text-brand" />
        Remind me to follow up
      </p>
      {mine.length > 0 && (
        <ul className="divide-y">
          {mine.map((r) => (
            <ReminderItem key={r.id} r={r} showName={false} />
          ))}
        </ul>
      )}
      <RemindPicker busy={busy} onPick={(d, n) => void add(d, n)} />
    </div>
  );
}

/** Contacts page: follow-ups that are overdue, due today or due this week. */
export function FollowUpsPanel() {
  const { isPremium } = usePlan();
  const { data: all = [] } = useOpenReminders(isPremium);
  if (!isPremium) return null;
  const weekOut = Date.now() + 7 * 864e5;
  const soon = all.filter((r) => new Date(r.remind_at).getTime() <= weekOut);
  if (!soon.length) return null;
  const dueNow = soon.filter((r) => dueGroup(new Date(r.remind_at)) !== "upcoming").length;
  return (
    <section className="surface mb-5 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <BellRing className="h-4 w-4 text-brand" />
        Follow-ups
        {dueNow > 0 && (
          <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
            {dueNow} due
          </span>
        )}
      </h2>
      <ul className="mt-1 divide-y">
        {soon.slice(0, 8).map((r) => (
          <ReminderItem key={r.id} r={r} showName />
        ))}
      </ul>
      {soon.length > 8 && (
        <p className="mt-2 text-xs text-muted-foreground">…and {soon.length - 8} more this week.</p>
      )}
    </section>
  );
}

/** "Remind me to follow up with everyone from this event" (Premium). */
export function BulkRemindButton({
  contactIds,
  eventName,
}: {
  contactIds: string[];
  eventName: string;
}) {
  const { isPremium } = usePlan();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!contactIds.length) return null;

  async function add(when: Date, note: string) {
    if (Number.isNaN(when.getTime())) return;
    setBusy(true);
    try {
      await addReminders(contactIds, when, note || `Met at ${eventName}`);
      await qc.invalidateQueries({ queryKey: KEY });
      toast.success(
        `${contactIds.length} reminder${contactIds.length === 1 ? "" : "s"} set for ${format(when, "EEE, MMM d 'at' h:mm a")}`,
      );
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not set the reminders");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Hint label="Set one follow-up reminder for each person you met at this event">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Bell className="h-4 w-4" />
          Remind me to follow up with all {contactIds.length}
        </Button>
      </Hint>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Follow up with everyone from {eventName}</DialogTitle>
            <DialogDescription>
              One reminder per contact — check them off as you reach out.
            </DialogDescription>
          </DialogHeader>
          {isPremium ? (
            <RemindPicker busy={busy} onPick={(d, n) => void add(d, n)} />
          ) : (
            <PremiumUpsell feature="Follow-up reminders" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
