import { Link } from "@tanstack/react-router";
import { RotateCcw, ScanLine, Star } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  checklistProgress,
  starredOpeners,
  type GoalSheet,
  type PrepContent,
} from "@/lib/event-prep";
import { cn } from "@/lib/utils";

// The three Event prep tabs. They only render what they are handed, so the
// page owns loading, the paid check and what is saved on the device.

export function Checklist({
  content,
  checked,
  onToggle,
  onReset,
}: {
  content: PrepContent;
  checked: string[];
  onToggle: (id: string) => void;
  onReset: () => void;
}) {
  const { done, total } = checklistProgress(content, checked);
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{content.checklist.intro}</p>
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold">
            {done} of {total} done
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost">
                <RotateCcw className="h-3.5 w-3.5" />
                Start a new event
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start a new event?</AlertDialogTitle>
                <AlertDialogDescription>
                  This clears your ticks and your goal sheet. Your starred openers stay.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onReset}>Clear and start</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <Progress value={total ? (done / total) * 100 : 0} aria-label="Checklist progress" />
      </div>

      {content.checklist.sections.map((s) => (
        <section key={s.id}>
          <h2 className="mb-3 text-lg font-bold">{s.title}</h2>
          <ul className="space-y-1">
            {s.items.map((item) => {
              const isChecked = checked.includes(item.id);
              const id = `prep-${item.id}`;
              return (
                <li key={item.id}>
                  <label
                    htmlFor={id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-muted"
                  >
                    <Checkbox
                      id={id}
                      checked={isChecked}
                      onCheckedChange={() => onToggle(item.id)}
                      className="mt-0.5 h-5 w-5"
                    />
                    <span
                      className={cn(
                        "text-sm leading-relaxed",
                        isChecked && "text-muted-foreground line-through",
                      )}
                    >
                      {item.text}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {s.id === "evening" && (
            <Button asChild size="sm" className="mt-3">
              <Link to="/app/scan">
                <ScanLine className="h-4 w-4" />
                Open the scanner
              </Link>
            </Button>
          )}
        </section>
      ))}

      <p className="surface p-4 text-sm">{content.checklist.closing}</p>
    </div>
  );
}

export function Openers({
  content,
  starred,
  onToggle,
}: {
  content: PrepContent;
  starred: number[];
  onToggle: (n: number) => void;
}) {
  const mine = starredOpeners(content, starred);
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{content.openers.intro}</p>

      <section className="surface p-4" aria-label="Your three openers">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Your three
        </h2>
        {mine.length ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {mine.map((t) => (
              <li key={t}>"{t}"</li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tap the star on up to three openers to keep them here.
          </p>
        )}
      </section>

      {content.openers.groups.map((g) => (
        <section key={g.title}>
          <h2 className="mb-3 text-lg font-bold">{g.title}</h2>
          <ul className="space-y-1">
            {g.items.map((o) => {
              const on = starred.includes(o.n);
              return (
                <li key={o.n} className="flex items-start gap-2 rounded-xl p-2 hover:bg-muted">
                  <span className="w-6 shrink-0 pt-0.5 text-right text-sm tabular-nums text-muted-foreground">
                    {o.n}
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-relaxed">
                    "{o.text}"
                    {o.note && <span className="block text-muted-foreground">{o.note}</span>}
                  </span>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={on ? `Unstar opener ${o.n}` : `Star opener ${o.n}`}
                    onClick={() => onToggle(o.n)}
                    className="shrink-0 rounded-full p-1.5 hover:bg-background"
                  >
                    <Star
                      className={cn(
                        "h-5 w-5",
                        on ? "fill-brand text-brand" : "text-muted-foreground",
                      )}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section>
        <h2 className="mb-3 text-lg font-bold">The two rules that make any opener work</h2>
        <ul className="space-y-3 text-sm leading-relaxed">
          {content.openers.rules.map((r) => (
            <li key={r.title}>
              <span className="font-semibold">{r.title}</span> {r.text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function Sheet({
  content,
  sheet,
  openers,
  onChange,
  onPickOpeners,
}: {
  content: PrepContent;
  sheet: GoalSheet;
  openers: string[];
  onChange: (p: Partial<GoalSheet>) => void;
  onPickOpeners: () => void;
}) {
  const setWho = (i: number, p: Partial<GoalSheet["who"][number]>) =>
    onChange({ who: sheet.who.map((w, j) => (j === i ? { ...w, ...p } : w)) });
  const setName = (i: number, p: Partial<GoalSheet["names"][number]>) =>
    onChange({ names: sheet.names.map((n, j) => (j === i ? { ...n, ...p } : n)) });

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{content.goalSheet.intro}</p>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="prep-event">Event</Label>
          <Input
            id="prep-event"
            value={sheet.event}
            onChange={(e) => onChange({ event: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prep-date">Date</Label>
          <Input
            id="prep-date"
            type="date"
            value={sheet.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prep-why">Why I'm going</Label>
        <Textarea
          id="prep-why"
          rows={2}
          value={sheet.why}
          placeholder="One sentence, a business outcome"
          onChange={(e) => onChange({ why: e.target.value })}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Who I want to meet</legend>
        <p className="text-xs text-muted-foreground">Roles, not names.</p>
        {sheet.who.map((w, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-2">
            <Input
              aria-label={`Role ${i + 1}`}
              value={w.role}
              placeholder={`Role ${i + 1}`}
              onChange={(e) => setWho(i, { role: e.target.value })}
            />
            <Input
              aria-label={`Because, for role ${i + 1}`}
              value={w.because}
              placeholder="because…"
              onChange={(e) => setWho(i, { because: e.target.value })}
            />
          </div>
        ))}
        <details className="pt-1 text-sm">
          <summary className="cursor-pointer font-medium text-brand">How to choose</summary>
          <ul className="mt-2 space-y-2 text-muted-foreground">
            {content.goalSheet.categories.map((c) => (
              <li key={c.name}>
                <span className="font-semibold text-foreground">{c.name}:</span> {c.text}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-muted-foreground">{content.goalSheet.because}</p>
        </details>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Names I already know will be there</legend>
        <p className="text-xs text-muted-foreground">Speakers, sponsors, attendees.</p>
        {sheet.names.map((n, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-2">
            <Input
              aria-label={`Name ${i + 1}`}
              value={n.name}
              placeholder={`Name ${i + 1}`}
              onChange={(e) => setName(i, { name: e.target.value })}
            />
            <Input
              aria-label={`What I'd open with, for name ${i + 1}`}
              value={n.opener}
              placeholder="what I'd open with…"
              onChange={(e) => setName(i, { opener: e.target.value })}
            />
          </div>
        ))}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="prep-target">Card target</Label>
          <Input
            id="prep-target"
            inputMode="numeric"
            value={sheet.target}
            placeholder="How many cards"
            onChange={(e) => onChange({ target: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            A fair guide is one card per 30 minutes of open networking time.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prep-scan">Scan slot</Label>
          <Input
            id="prep-scan"
            type="time"
            value={sheet.scanSlot}
            onChange={(e) => onChange({ scanSlot: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">15 minutes, the same evening.</p>
        </div>
      </div>

      <p className="text-sm">
        <span className="font-semibold">Hot five:</span> your 5 best conversations get follow-ups
        tonight.
      </p>

      <section>
        <h2 className="mb-2 text-sm font-medium">My 3 openers</h2>
        {openers.length ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {openers.map((t) => (
              <li key={t}>"{t}"</li>
            ))}
          </ol>
        ) : (
          <Button size="sm" variant="outline" onClick={onPickOpeners}>
            <Star className="h-4 w-4" />
            Pick your openers
          </Button>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">My exit line</h2>
        <blockquote className="border-l-2 border-brand pl-4 text-sm">
          "{content.goalSheet.exitLine}"
        </blockquote>
        <p className="mt-1 text-xs text-muted-foreground">Ends the chat and collects the card.</p>
      </section>

      <p className="surface p-4 text-sm">{content.goalSheet.after}</p>
    </div>
  );
}
