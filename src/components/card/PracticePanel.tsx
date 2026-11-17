import { useState } from "react";
import { AlertTriangle, Plus, Scale, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ADMISSIONS_MAX,
  ADMISSION_STATE_MAX,
  AREAS_MAX,
  AREA_MAX,
  BAR_NUMBER_MAX,
  CONSULT_URL_MAX,
  DEFAULT_DISCLAIMER,
  DISCLAIMER_MAX,
  SUGGESTED_AREAS,
  cleanConsultUrl,
  newAttorneyPractice,
  practiceWarnings,
  type Admission,
  type CardPractice,
} from "@/lib/practice";
import { cn } from "@/lib/utils";

/** The attorney pack in the editor's Details tab. Holds the owner's raw
 *  typing (the editor cleans it with parsePractice on save), so fields never
 *  fight the cursor. Cards without a pack see only the one-line opt-in. */
export function PracticePanel({
  practice,
  location,
  onChange,
}: {
  practice: CardPractice | null | undefined;
  location: string | null;
  onChange: (p: CardPractice | null) => void;
}) {
  const [areaDraft, setAreaDraft] = useState("");

  if (practice?.kind !== "attorney") {
    return (
      <div className="surface flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Scale className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
          <div>
            <p className="text-sm font-semibold">Are you an attorney?</p>
            <p className="text-sm text-muted-foreground">
              Add bar admissions, practice areas, a disclaimer and a consultation link.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => onChange(newAttorneyPractice())}>
          Add attorney details
        </Button>
      </div>
    );
  }

  const p = practice;
  const set = (patch: Partial<CardPractice>) => onChange({ ...p, ...patch });
  const admissions = p.admissions ?? [];
  const areas = p.areas ?? [];
  const warnings = practiceWarnings(
    { ...p, admissions: admissions.filter((a) => a.state.trim()) },
    { location },
  );
  const urlBad = !!p.consultUrl?.trim() && !cleanConsultUrl(p.consultUrl);

  const setAdmission = (i: number, patch: Partial<Admission>) =>
    set({ admissions: admissions.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const addArea = (raw: string) => {
    const area = raw.trim().slice(0, AREA_MAX);
    if (!area || areas.length >= AREAS_MAX) return;
    if (areas.some((a) => a.toLowerCase() === area.toLowerCase())) return;
    set({ areas: [...areas, area] });
    setAreaDraft("");
  };

  return (
    <section className="surface space-y-5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-brand" />
          <h3 className="text-sm font-semibold">Attorney details</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
          Remove
        </Button>
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          {warnings.map((w) => (
            <li key={w} className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <Label>Bar admissions</Label>
        {admissions.map((a, i) => (
          <div key={i} className="flex gap-2">
            <Input
              aria-label="State"
              placeholder="Florida"
              maxLength={ADMISSION_STATE_MAX}
              value={a.state}
              onChange={(e) => setAdmission(i, { state: e.target.value })}
            />
            <Input
              aria-label="Bar number"
              placeholder="Bar no. (optional)"
              maxLength={BAR_NUMBER_MAX}
              className="w-44"
              value={a.number ?? ""}
              onChange={(e) => setAdmission(i, { number: e.target.value })}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove admission"
              onClick={() => set({ admissions: admissions.filter((_, j) => j !== i) })}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {admissions.length < ADMISSIONS_MAX && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => set({ admissions: [...admissions, { state: "" }] })}
          >
            <Plus className="h-4 w-4" /> Add a state
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="pa-area">Practice areas</Label>
        {areas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {areas.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium"
              >
                {a}
                <button
                  aria-label={`Remove ${a}`}
                  onClick={() => set({ areas: areas.filter((x) => x !== a) })}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {areas.length < AREAS_MAX && (
          <>
            <div className="flex gap-2">
              <Input
                id="pa-area"
                placeholder="Type an area and press Enter"
                maxLength={AREA_MAX}
                value={areaDraft}
                onChange={(e) => setAreaDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addArea(areaDraft);
                  }
                }}
              />
              <Button variant="outline" onClick={() => addArea(areaDraft)}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_AREAS.filter(
                (s) => !areas.some((a) => a.toLowerCase() === s.toLowerCase()),
              ).map((s) => (
                <button
                  key={s}
                  onClick={() => addArea(s)}
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
                >
                  + {s}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pa-consult">Consultation booking link</Label>
        <Input
          id="pa-consult"
          placeholder="calendly.com/your-name"
          maxLength={CONSULT_URL_MAX}
          value={p.consultUrl ?? ""}
          className={cn(urlBad && "border-destructive")}
          onChange={(e) => set({ consultUrl: e.target.value })}
        />
        <p className={cn("text-xs", urlBad ? "text-destructive" : "text-muted-foreground")}>
          {urlBad
            ? "Use a secure (https) web address, like calendly.com/your-name."
            : "Adds a “Schedule a consultation” button to your card. Calendly, Clio Grow, or your firm's intake page."}
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="pa-disclaimer">Disclaimer</Label>
          {p.disclaimer !== DEFAULT_DISCLAIMER && (
            <button
              className="text-xs text-brand underline"
              onClick={() => set({ disclaimer: DEFAULT_DISCLAIMER })}
            >
              Use the standard wording
            </button>
          )}
        </div>
        <Textarea
          id="pa-disclaimer"
          maxLength={DISCLAIMER_MAX}
          value={p.disclaimer ?? ""}
          onChange={(e) => set({ disclaimer: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Shown at the bottom of your card. You're responsible for meeting your bar's advertising
          rules; this is a starting point, not legal advice.
        </p>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <Label htmlFor="pa-consent">Ask for an acknowledgment</Label>
          <p className="text-xs text-muted-foreground">
            People who share their details with you confirm that it doesn't make you their lawyer
            and that they won't send confidential information. It's recorded on the contact.
          </p>
        </div>
        <Switch
          id="pa-consent"
          checked={p.consent === true}
          onCheckedChange={(v) => set({ consent: v })}
        />
      </div>
    </section>
  );
}
