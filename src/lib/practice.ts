// Profession packs: optional professional details a card can carry, one pack
// per card. Attorneys: bar admissions, practice areas, a disclaimer, a
// consultation link, and a consent step on the share-back form. Nonprofits:
// 501(c)(3) status and EIN, a donate link, a state solicitation disclosure,
// "I'm interested in…" checkboxes on the share-back form, and a low-profile
// mode for organizations whose people shouldn't be publicly identifiable.
// Pure and client-safe. The database guard (valid_card_practice) is the
// authority; this mirrors it so the editor never sends something it refuses.
// Packs are free on every plan: compliance details shouldn't be paywalled.

export const PRACTICE_KINDS = ["attorney", "nonprofit"] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];

/** The profession picker, in order. "general" means no pack. */
export const PROFESSIONS: readonly {
  id: PracticeKind | "general";
  name: string;
  hint: string;
}[] = [
  { id: "general", name: "General", hint: "A standard card for anyone" },
  {
    id: "attorney",
    name: "Attorney",
    hint: "Bar admissions, practice areas, disclaimer, consultation booking",
  },
  {
    id: "nonprofit",
    name: "Nonprofit",
    hint: "Donate button, 501(c)(3) status, volunteer sign-ups, low-profile mode",
  },
];

export const ADMISSIONS_MAX = 6;
export const ADMISSION_STATE_MAX = 40;
export const BAR_NUMBER_MAX = 20;
export const AREAS_MAX = 8;
export const AREA_MAX = 40;
export const DISCLAIMER_MAX = 400;
export const LINK_URL_MAX = 500;
export const DISCLOSURE_MAX = 600;
export const STATE_REG_MAX = 30;

export type Admission = { state: string; number?: string | undefined };

export type CardPractice = {
  kind: PracticeKind;
  // ---- attorney
  admissions?: Admission[] | undefined;
  areas?: string[] | undefined;
  disclaimer?: string | undefined;
  /** An https booking page (Calendly, Clio Grow, the firm's intake form). */
  consultUrl?: string | undefined;
  /** Visitors must tick an acknowledgment before sharing their details. */
  consent?: boolean | undefined;
  // ---- nonprofit
  /** A registered 501(c)(3): shows the status line and the deductibility line. */
  exempt?: boolean | undefined;
  /** Federal EIN, stored as NN-NNNNNNN. */
  ein?: string | undefined;
  /** An https giving page (Givebutter, Donorbox, the org's own site). */
  donateUrl?: string | undefined;
  /** A state charitable-solicitation disclosure (Florida's, prefilled on request). */
  disclosure?: string | undefined;
  /** The charity's state registration number (Florida: CH#####). */
  stateReg?: string | undefined;
  /** Show the "I'm interested in…" checkboxes on the share-back form. */
  interests?: boolean | undefined;
  /** Hide the person: no headshot, no personal name, title or search indexing. */
  lowProfile?: boolean | undefined;
};

const ATTORNEY_KEYS = ["admissions", "areas", "disclaimer", "consultUrl", "consent"] as const;
const NONPROFIT_KEYS = [
  "exempt",
  "ein",
  "donateUrl",
  "disclosure",
  "stateReg",
  "interests",
  "lowProfile",
] as const;

export const DEFAULT_DISCLAIMER =
  "Contacting me through this card does not create an attorney-client relationship. " +
  "Please don't send confidential information until we have agreed to work together.";

/** The standard line on a 501(c)(3) card; deliberately not editable, so it
 *  can never be turned into a stronger promise. */
export const DEDUCTIBLE_LINE = "Contributions are tax-deductible to the extent allowed by law.";

/** Florida's required solicitation disclosure (s. 496.411(3), F.S.), in the
 *  capital letters the statute asks for. The registration number (496.411(6))
 *  is shown alongside it from stateReg. */
export const FLORIDA_DISCLOSURE =
  "A COPY OF THE OFFICIAL REGISTRATION AND FINANCIAL INFORMATION MAY BE OBTAINED FROM THE " +
  "DIVISION OF CONSUMER SERVICES BY CALLING TOLL-FREE (800-435-7352) WITHIN THE STATE OR " +
  "VISITING www.FloridaConsumerHelp.com. REGISTRATION DOES NOT IMPLY ENDORSEMENT, APPROVAL, " +
  "OR RECOMMENDATION BY THE STATE.";

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

/** What a nonprofit visitor can tick on the share-back form. Each becomes a
 *  tag on the contact, so the org can filter "everyone who wants to volunteer". */
export const INTERESTS = ["Volunteering", "Donating", "Partnering", "Event updates"] as const;
export type Interest = (typeof INTERESTS)[number];

/** What a new card of each kind starts with. */
export function newPractice(kind: PracticeKind): CardPractice {
  return kind === "attorney"
    ? { kind, admissions: [], areas: [], disclaimer: DEFAULT_DISCLAIMER, consent: true }
    : { kind, exempt: true, interests: true };
}

/** Switching profession keeps nothing from the old pack (the fields don't
 *  overlap), but switching back to a kind already open keeps its draft. */
export function switchPractice(
  current: CardPractice | null | undefined,
  to: PracticeKind | "general",
): CardPractice | null {
  if (to === "general") return null;
  if (current?.kind === to) return current;
  return newPractice(to);
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

/** A pack link the database accepts: https only, so a card can never carry a
 *  javascript: or data: link. Bare domains get https:// added. */
export function cleanPackUrl(raw: string): string | undefined {
  let s = raw.trim();
  if (!s) return undefined;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(s)) return undefined;
  return s.length <= LINK_URL_MAX ? s : undefined;
}

/** "123456789" or "12-3456789" → "12-3456789"; anything else is not an EIN. */
export function cleanEin(raw: string): string | undefined {
  const digits = raw.replace(/[\s-]/g, "");
  return /^\d{9}$/.test(digits) ? `${digits.slice(0, 2)}-${digits.slice(2)}` : undefined;
}

/** Cleans anything (a database value, an editor draft) into a pack the
 *  database accepts, or null for a card without one. Only the keys of the
 *  pack's own kind survive; empty text fields are dropped. */
export function parsePractice(raw: unknown): CardPractice | null {
  if (!isRecord<"kind" | (typeof ATTORNEY_KEYS)[number] | (typeof NONPROFIT_KEYS)[number]>(raw))
    return null;
  if (!(PRACTICE_KINDS as readonly unknown[]).includes(raw.kind)) return null;
  const out: CardPractice = { kind: raw.kind as PracticeKind };

  if (out.kind === "attorney") {
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
      const u = cleanPackUrl(raw.consultUrl);
      if (u) out.consultUrl = u;
    }
    if (raw.consent === true) out.consent = true;
    return out;
  }

  // nonprofit
  if (raw.exempt === true) out.exempt = true;
  if (typeof raw.ein === "string") {
    const ein = cleanEin(raw.ein);
    if (ein) out.ein = ein;
  }
  if (typeof raw.donateUrl === "string") {
    const u = cleanPackUrl(raw.donateUrl);
    if (u) out.donateUrl = u;
  }
  if (typeof raw.disclosure === "string") {
    const d = clip(raw.disclosure, DISCLOSURE_MAX);
    if (d) out.disclosure = d;
  }
  if (typeof raw.stateReg === "string") {
    const r = clip(raw.stateReg, STATE_REG_MAX);
    if (r) out.stateReg = r;
  }
  if (raw.interests === true) out.interests = true;
  if (raw.lowProfile === true) out.lowProfile = true;
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

/** "501(c)(3) nonprofit · EIN 12-3456789" (either part may be missing). */
export function nonprofitStatusLine(p: CardPractice | null | undefined): string {
  if (p?.kind !== "nonprofit") return "";
  return [p.exempt ? "501(c)(3) nonprofit" : "", p.ein ? `EIN ${p.ein}` : ""]
    .filter(Boolean)
    .join(" · ");
}

/** The pack's main button on a public card, if it has one. */
export function packCta(
  p: CardPractice | null | undefined,
): { label: string; url: string; kind: "consult" | "donate" } | null {
  if (p?.kind === "attorney" && p.consultUrl)
    return { label: "Schedule a consultation", url: p.consultUrl, kind: "consult" };
  if (p?.kind === "nonprofit" && p.donateUrl)
    return { label: "Donate", url: p.donateUrl, kind: "donate" };
  return null;
}

/** What the editor flags (never blocks). Florida's lawyer rules call for the
 *  name and office location of a responsible lawyer on ads; its charity rules
 *  call for the disclosure on any page that takes donations. */
export function practiceWarnings(
  practice: CardPractice | null | undefined,
  card: { location: string | null; company?: string | null | undefined },
): string[] {
  const out: string[] = [];
  if (practice?.kind === "attorney") {
    if (!card.location?.trim())
      out.push("Add your office city in Location. Bar advertising rules usually require it.");
    if (!practice.admissions?.length) out.push("Add at least one state you're admitted in.");
    if (!practice.disclaimer) out.push("A disclaimer is strongly recommended on an attorney card.");
  }
  if (practice?.kind === "nonprofit" && practice.lowProfile && !card.company?.trim())
    out.push(
      "Low-profile cards show your organization's name instead of yours. Add it in Company on the Details tab.",
    );
  if (practice?.kind === "nonprofit" && practice.donateUrl && !practice.disclosure)
    out.push(
      "Your card asks for donations. Many states (Florida included) require a solicitation disclosure on it.",
    );
  return out;
}

/** A public card as the world sees it under low-profile mode: the
 *  organization, not the person. The database applies the same rule
 *  (get_public_card), so the person never reaches the page at all; this keeps
 *  the editor's preview honest. */
export function lowProfileView<
  T extends {
    full_name: string;
    job_title: string | null;
    company: string | null;
    headshot_path: string | null;
    practice?: CardPractice | null | undefined;
  },
>(card: T): T {
  if (card.practice?.kind !== "nonprofit" || !card.practice.lowProfile) return card;
  return {
    ...card,
    full_name: card.company?.trim() || card.full_name,
    // The organization is the name now; don't repeat it as the company line.
    company: card.company?.trim() ? null : card.company,
    job_title: null,
    headshot_path: null,
  };
}

export function isLowProfile(p: CardPractice | null | undefined): boolean {
  return p?.kind === "nonprofit" && p.lowProfile === true;
}

/** How visitors address the card's owner: a person by first name ("Jane"),
 *  a low-profile card by the whole organization name ("The PLACE"). */
export function addressAs(
  card: { full_name: string; company?: string | null | undefined },
  practice: CardPractice | null | undefined,
  fallback = "them",
): string {
  if (isLowProfile(practice)) return card.company?.trim() || card.full_name.trim() || fallback;
  return card.full_name.trim().split(/\s+/)[0] || fallback;
}

// ---- Share-back extras -------------------------------------------------------

/** The line recorded on the contact when a visitor ticks the consent box, so
 *  the firm keeps a record of what was acknowledged. */
export const CONSENT_NOTE =
  "[Acknowledged: sharing details does not create an attorney-client relationship; no confidential information sent.]";

export function consentLabel(ownerFirstName: string): string {
  return `I understand that sharing my details doesn't make ${ownerFirstName} my lawyer, and I won't include confidential information.`;
}

/** Puts the consent record ahead of the note so a long note never cuts it. */
export function withConsentNote(note: string, max: number): string {
  return withLeadLine(CONSENT_NOTE, note, max);
}

export function needsConsent(practice: CardPractice | null | undefined): boolean {
  return practice?.kind === "attorney" && practice.consent === true;
}

export function asksInterests(practice: CardPractice | null | undefined): boolean {
  return practice?.kind === "nonprofit" && practice.interests === true;
}

/** Only known interests, each once, in the standard order. */
export function cleanInterests(raw: readonly unknown[] | undefined): Interest[] {
  if (!raw) return [];
  return INTERESTS.filter((i) => raw.includes(i));
}

/** "Interested in: Volunteering, Donating", ahead of the note. */
export function withInterestsNote(interests: readonly Interest[], note: string, max: number) {
  return interests.length
    ? withLeadLine(`Interested in: ${interests.join(", ")}`, note, max)
    : note;
}

function withLeadLine(line: string, note: string, max: number): string {
  const rest = note.trim();
  if (!rest) return line.slice(0, max);
  return `${line}\n\n${rest}`.slice(0, max);
}
