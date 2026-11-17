import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, HeartHandshake, IdCard, Plus, Scale, X } from "lucide-react";
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
  DEFAULT_DISCLAIMER,
  DISCLAIMER_MAX,
  DISCLOSURE_MAX,
  DEDUCTIBLE_LINE,
  FLORIDA_DISCLOSURE,
  INTERESTS,
  LINK_URL_MAX,
  PROFESSIONS,
  STATE_REG_MAX,
  SUGGESTED_AREAS,
  cleanEin,
  cleanPackUrl,
  parsePractice,
  practiceWarnings,
  switchPractice,
  type Admission,
  type CardPractice,
} from "@/lib/practice";
import { cn } from "@/lib/utils";

/** The editor's Profession tab: pick what kind of card this is, then fill in
 *  that pack. Holds the owner's raw typing (the editor cleans it with
 *  parsePractice on save), so fields never fight the cursor. Adding a pack is
 *  one more PROFESSIONS entry and one more fields component. */
export function PracticePanel({
  practice,
  location,
  company,
  onChange,
}: {
  practice: CardPractice | null | undefined;
  location: string | null;
  company: string | null;
  onChange: (p: CardPractice | null) => void;
}) {
  const current = practice?.kind ?? "general";
  const warnings = practiceWarnings(parsePractice(practice), { location, company });
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold">What kind of card is this?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          A profession adds the details, buttons and safeguards that work needs. It only changes
          this card.
        </p>
        <div role="radiogroup" className="mt-3 grid gap-2 sm:grid-cols-3">
          {PROFESSIONS.map((pr) => {
            const Icon = PROFESSION_ICONS[pr.id];
            const on = current === pr.id;
            return (
              <button
                key={pr.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(switchPractice(practice, pr.id))}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                  on ? "border-brand bg-brand/5 ring-1 ring-brand" : "hover:bg-accent",
                )}
              >
                <Icon className={cn("h-5 w-5", on ? "text-brand" : "text-muted-foreground")} />
                <span className="text-sm font-semibold">{pr.name}</span>
                <span className="text-xs text-muted-foreground">{pr.hint}</span>
              </button>
            );
          })}
        </div>
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

      {practice?.kind === "attorney" && <AttorneyFields practice={practice} onChange={onChange} />}
      {practice?.kind === "nonprofit" && (
        <NonprofitFields practice={practice} onChange={onChange} />
      )}
    </div>
  );
}

const PROFESSION_ICONS = { general: IdCard, attorney: Scale, nonprofit: HeartHandshake };

function AttorneyFields({
  practice: p,
  onChange,
}: {
  practice: CardPractice;
  onChange: (p: CardPractice) => void;
}) {
  const [areaDraft, setAreaDraft] = useState("");
  const set = (patch: Partial<CardPractice>) => onChange({ ...p, ...patch });
  const admissions = p.admissions ?? [];
  const areas = p.areas ?? [];
  const urlBad = !!p.consultUrl?.trim() && !cleanPackUrl(p.consultUrl);

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
    <section className="space-y-5">
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
          maxLength={LINK_URL_MAX}
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

      <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        Use Clio Grow? Send every share-back from this card straight to your Lead Inbox. Connect it
        in{" "}
        <Link to="/app/settings" hash="notifications" className="font-medium text-brand underline">
          Settings → Notifications & integrations
        </Link>
        .
      </p>
    </section>
  );
}

function NonprofitFields({
  practice: p,
  onChange,
}: {
  practice: CardPractice;
  onChange: (p: CardPractice) => void;
}) {
  const set = (patch: Partial<CardPractice>) => onChange({ ...p, ...patch });
  const urlBad = !!p.donateUrl?.trim() && !cleanPackUrl(p.donateUrl);
  const einBad = !!p.ein?.trim() && !cleanEin(p.ein);

  return (
    <section className="space-y-5">
      <ToggleRow
        id="np-exempt"
        label="We're a registered 501(c)(3)"
        hint={`Shows "501(c)(3) nonprofit" and the standard line: ${DEDUCTIBLE_LINE}`}
        checked={p.exempt === true}
        onChange={(v) => set({ exempt: v })}
      />

      <div className="space-y-1.5">
        <Label htmlFor="np-ein">EIN</Label>
        <Input
          id="np-ein"
          placeholder="12-3456789"
          inputMode="numeric"
          maxLength={10}
          value={p.ein ?? ""}
          className={cn("w-44", einBad && "border-destructive")}
          onChange={(e) => set({ ein: e.target.value })}
        />
        <p className={cn("text-xs", einBad ? "text-destructive" : "text-muted-foreground")}>
          {einBad
            ? "An EIN is 9 digits, like 12-3456789."
            : "Optional. Donors and grant makers look for it."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="np-donate">Donation link</Label>
        <Input
          id="np-donate"
          placeholder="givebutter.com/your-org"
          maxLength={LINK_URL_MAX}
          value={p.donateUrl ?? ""}
          className={cn(urlBad && "border-destructive")}
          onChange={(e) => set({ donateUrl: e.target.value })}
        />
        <p className={cn("text-xs", urlBad ? "text-destructive" : "text-muted-foreground")}>
          {urlBad
            ? "Use a secure (https) web address, like givebutter.com/your-org."
            : "Makes “Donate” the main button on your card. Givebutter, Donorbox, PayPal Giving, or your own page."}
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="np-disclosure">State solicitation disclosure</Label>
          {p.disclosure !== FLORIDA_DISCLOSURE && (
            <button
              type="button"
              className="text-xs text-brand underline"
              onClick={() => set({ disclosure: FLORIDA_DISCLOSURE })}
            >
              Use Florida's wording
            </button>
          )}
        </div>
        <Textarea
          id="np-disclosure"
          rows={4}
          maxLength={DISCLOSURE_MAX}
          value={p.disclosure ?? ""}
          onChange={(e) => set({ disclosure: e.target.value })}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="np-reg" className="shrink-0 text-xs font-normal">
            State registration no.
          </Label>
          <Input
            id="np-reg"
            placeholder="CH12345"
            maxLength={STATE_REG_MAX}
            className="h-8 w-36"
            value={p.stateReg ?? ""}
            onChange={(e) => set({ stateReg: e.target.value })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Florida requires this disclosure and your registration number anywhere you ask for
          donations, and a card with a Donate button counts. Other states have their own rules.
          You're responsible for your organization's compliance.
        </p>
      </div>

      <ToggleRow
        id="np-interests"
        label="Ask what people are interested in"
        hint={`Adds checkboxes to "Share yours": ${INTERESTS.join(", ")}. Each one becomes a tag on the contact, so you can filter everyone who wants to volunteer.`}
        checked={p.interests === true}
        onChange={(v) => set({ interests: v })}
      />

      <ToggleRow
        id="np-low"
        label="Low-profile card"
        hint="For organizations whose people shouldn't be publicly identifiable. Your card shows the organization's name instead of yours, with no photo, no job title, and no listing in search engines. Fill in Company on the Details tab, and check that your bio, email address and links don't name you either."
        checked={p.lowProfile === true}
        onChange={(v) => set({ lowProfile: v })}
      />
    </section>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
