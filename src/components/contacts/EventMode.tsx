import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Loader2, MapPin, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProUpsell } from "@/components/PremiumGate";
import { endEvent, startEvent, type EventRow } from "@/lib/events-api";
import { cleanEventName, eventIsRunning } from "@/lib/followups";

/** Contacts-page bar: the running event (with an End button), or a way to
 *  start one. Free accounts see the Pro upsell when they try. */
export function EventModeBar({
  events,
  isPro,
  countFor,
  onShowEvent,
}: {
  events: EventRow[];
  isPro: boolean;
  countFor: (eventId: string) => number;
  onShowEvent: (eventId: string) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const running = events.find((e) => eventIsRunning(e));

  async function end() {
    if (!running) return;
    setEnding(true);
    try {
      await endEvent(running.id);
      await qc.invalidateQueries({ queryKey: ["events"] });
      toast.success(`Ended ${running.name}`, {
        description: "Its contacts stay tagged — filter by the event any time.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not end the event");
    } finally {
      setEnding(false);
    }
  }

  return (
    <>
      {running ? (
        <div className="surface mb-5 flex flex-wrap items-center gap-3 border-brand/40 bg-brand-soft/40 px-4 py-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Event mode: {running.name}</p>
            <p className="text-xs text-muted-foreground">
              New contacts are tagged automatically · {countFor(running.id)} so far
            </p>
          </div>
          {/* Own row on phones so the event name isn't cut off. */}
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => onShowEvent(running.id)}>
              View contacts
            </Button>
            <Button variant="outline" size="sm" onClick={() => void end()} disabled={ending}>
              {ending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              End event
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="mb-5" onClick={() => setOpen(true)}>
          <MapPin className="h-4 w-4" />
          Start event mode
        </Button>
      )}
      <StartEventDialog open={open} onOpenChange={setOpen} isPro={isPro} />
    </>
  );
}

function StartEventDialog({
  open,
  onOpenChange,
  isPro,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isPro: boolean;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cleanEventName(name)) return;
    setBusy(true);
    try {
      const ev = await startEvent(name, endsOn || null);
      await qc.invalidateQueries({ queryKey: ["events"] });
      toast.success(`Event mode on: ${ev.name}`, {
        description: "Everyone you meet is tagged with it until you end the event.",
      });
      setName("");
      setEndsOn("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the event");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-brand" />
            Start event mode
          </DialogTitle>
          <DialogDescription>
            Heading to a conference, expo or open house? Everyone who scans your card, shares their
            details or gets scanned by you is tagged with the event — so afterwards you have one
            list to follow up with.
          </DialogDescription>
        </DialogHeader>
        {isPro ? (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="event-name">Event name</Label>
              <Input
                id="event-name"
                autoFocus
                required
                maxLength={80}
                placeholder="e.g. Denver Realtor Expo"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="event-end">Last day (optional)</Label>
              <Input
                id="event-end"
                type="date"
                value={endsOn}
                onChange={(e) => setEndsOn(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Tagging stops by itself after this day. Leave empty to end it yourself.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={busy || !cleanEventName(name)}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Start event
            </Button>
          </form>
        ) : (
          <ProUpsell feature="Event mode" />
        )}
      </DialogContent>
    </Dialog>
  );
}
