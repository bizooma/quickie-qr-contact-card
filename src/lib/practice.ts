// Profession packs: optional professional details a card can carry. The first
// (and for now only) pack is for attorneys: bar admissions, practice areas, a
// disclaimer, a consultation link, and a consent step on the share-back form.
// Pure and client-safe. The database guard (valid_card_practice) is the
// authority; this mirrors it so the editor never sends something it refuses.
// Packs are free on every plan: compliance details shouldn't be paywalled.

export const PRACTICE_KINDS = ["attorney"] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];

export const ADMISSIONS_MAX = 6;
export const ADMISSION_STATE_MAX = 40;
export const BAR_NUMBER_MAX = 20;
export const AREAS_MAX = 8;
export const AREA_MAX = 40;
export const DISCLAIMER_MAX = 400;
export const CONSULT_URL_MAX = 500;

export type Admission = { state: string; number?: string | undefined };

export type CardPractice = {
  kind: PracticeKind;
  admissions?: Admission[] | undefined;
  areas?: string[] | undefined;
  disclaimer?: string | undefined;
  /** An https booking page (Calendly, Clio Grow, the firm's intake form). */
  consultUrl?: string | undefined;
  /** Visitors must tick an acknowledgment before sharing their details. */
  consent?: boolean | undefined;
};

export const DEFAULT_DISCLAIMER =
  "Contacting me through this card does not create an attorney-client relationship. " +
  "Please don't send confidential information until we have agreed to work together.";

/** Practice areas offered as one-tap chips; owners can type their own. */
export const SUGGESTED_AREAS = [
  "Estate planning",
  "Probate",
  "Family law",
  "Personal injury",
  "Criminal defense",
  "Business law",
  "Real estate",
  "Employment",
  "Immigration",
  "Bankruptcy",
  "Litigation",
  "Elder law",
] as const;

/** What a new attorney card starts with. */
export function newAttorneyPractice(): CardPractice {
  return {
    kind: "attorney",
    admissions: [],
    areas: [],
    disclaimer: DEFAULT_DISCLAIMER,
    consent: true,
  };
}

/** Cut by whole characters: slicing a string can split an emoji in two, and
 *  the database refuses the half that is left. */
function clip(s: string, max: number): string {
  return Array.from(s.trim()).slice(0, max).join("").trim();
}

type Loose<K extends string> = Partial<Record<K, unknown>>;
function isRecord<K extends string>(v: unknown): v is Loose<K> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A consultation link the database accepts: https only, so a card can never
 *  carry a javascript: or data: link. Bare domains get https:// added. */
export function cleanConsultUrl(raw: string): string | undefined {
  let s = raw.trim();
  if (!s) return undefined;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(s)) return undefined;
  return s.length <= CONSULT_URL_MAX ? s : undefined;
}

/** Cleans anything (a database value, an editor draft) into a pack the
 *  database accepts, or null for a card without one. Empty text fields are
 *  dropped; half-typed rows (no state) are left out. */
export function parsePractice(raw: unknown): CardPractice | null {
  if (!isRecord<"kind" | "admissions" | "areas" | "disclaimer" | "consultUrl" | "consent">(raw))
    return null;
  if (!(PRACTICE_KINDS as readonly unknown[]).includes(raw.kind)) return null;
  const out: CardPractice = { kind: raw.kind as PracticeKind };

  if (Array.isArray(raw.admissions)) {
    const admissions: Admission[] = [];
    for (const a of raw.admissions) {
      if (admissions.length >= ADMISSIONS_MAX) break;
      if (!isRecord<"state" | "number">(a) || typeof a.state !== "string") continue;
      const state = clip(a.state, ADMISSION_STATE_MAX);
      if (!state) continue;
      const number = typeof a.number === "string" ? clip(a.number, BAR_NUMBER_MAX) : "";
      admissions.push(number ? { state, number } : { state });
    }
    if (admissions.length) out.admissions = admissions;
  }

  if (Array.isArray(raw.areas)) {
    const areas: string[] = [];
    for (const v of raw.areas) {
      if (areas.length >= AREAS_MAX) break;
      if (typeof v !== "string") continue;
      const area = clip(v, AREA_MAX);
      if (area && !areas.some((x) => x.toLowerCase() === area.toLowerCase())) areas.push(area);
    }
    if (areas.length) out.areas = areas;
  }

  if (typeof raw.disclaimer === "string") {
    const d = clip(raw.disclaimer, DISCLAIMER_MAX);
    if (d) out.disclaimer = d;
  }
  if (typeof raw.consultUrl === "string") {
    const u = cleanConsultUrl(raw.consultUrl);
    if (u) out.consultUrl = u;
  }
  if (raw.consent === true) out.consent = true;
  return out;
}

/** "Admitted in Florida (Bar No. 123456) · Georgia" */
export function admissionsLine(admissions: readonly Admission[] | undefined): string {
  if (!admissions?.length) return "";
  return (
    "Admitted in " +
    admissions.map((a) => (a.number ? `${a.state} (Bar No. ${a.number})` : a.state)).join(" · ")
  );
}

/** What the editor flags (never blocks) on an attorney card. Florida's rules
 *  call for the name and office location of a responsible lawyer on ads. */
export function practiceWarnings(
  practice: CardPractice | null | undefined,
  card: { location: string | null },
): string[] {
  if (practice?.kind !== "attorney") return [];
  const out: string[] = [];
  if (!card.location?.trim())
    out.push("Add your office city in Location. Bar advertising rules usually require it.");
  if (!practice.admissions?.length) out.push("Add at least one state you're admitted in.");
  if (!practice.disclaimer) out.push("A disclaimer is strongly recommended on an attorney card.");
  return out;
}

/** The line recorded on the contact when a visitor ticks the consent box, so
 *  the firm keeps a record of what was acknowledged. */
export const CONSENT_NOTE =
  "[Acknowledged: sharing details does not create an attorney-client relationship; no confidential information sent.]";

export function consentLabel(ownerFirstName: string): string {
  return `I understand that sharing my details doesn't make ${ownerFirstName} my lawyer, and I won't include confidential information.`;
}

/** Puts the consent record ahead of the note so a long note never cuts it. */
export function withConsentNote(note: string, max: number): string {
  const rest = note.trim();
  if (!rest) return CONSENT_NOTE.slice(0, max);
  return `${CONSENT_NOTE}\n\n${rest}`.slice(0, max);
}

export function needsConsent(practice: CardPractice | null | undefined): boolean {
  return practice?.kind === "attorney" && practice.consent === true;
}
