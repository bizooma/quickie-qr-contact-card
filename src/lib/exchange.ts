// How a card trades contact details: what "Save contact" leaves out, and the
// owner's own share-back form. Pure and client-safe. The database guard
// (valid_card_exchange, migration 0035) is the authority; this mirrors it so
// the editor never sends something the database would refuse.

/** The parts of a card "Save contact" can leave out. The name and the link
 *  back to the card always stay. "company" covers the job title too. */
export const VCARD_PARTS = [
  "phones",
  "emails",
  "company",
  "website",
  "location",
  "bio",
  "links",
  "photo",
] as const;
export type VCardPart = (typeof VCARD_PARTS)[number];

export const VCARD_PART_NAMES: Record<VCardPart, string> = {
  phones: "Phone numbers",
  emails: "Email addresses",
  company: "Company and job title",
  website: "Website",
  location: "Location",
  bio: "Bio",
  links: "Links",
  photo: "Photo",
};

/** Which contact method a visitor must give. */
export const REQUIRE_MODES = ["either", "email", "phone", "both"] as const;
export type RequireMode = (typeof REQUIRE_MODES)[number];

export const REQUIRE_NAMES: Record<RequireMode, string> = {
  either: "Email or phone",
  email: "Email",
  phone: "Phone",
  both: "Both",
};

export const QUESTIONS_MAX = 3;
export const QUESTION_LABEL_MAX = 80;
export const ANSWER_MAX = 200;
/** The contact's note column holds this much (submit_shareback). */
export const NOTE_MAX = 1000;

export type ExchangeQuestion = { label: string; required?: boolean | undefined };

export type ExchangeForm = {
  require: RequireMode;
  /** Show the optional Company field. */
  company: boolean;
  /** Show the optional Note field. */
  note: boolean;
  questions: ExchangeQuestion[];
};

export type CardExchange = {
  vcardHide?: VCardPart[] | undefined;
  form?: ExchangeForm | undefined;
};

/** The form every card had before owners could change it. */
export const DEFAULT_FORM: ExchangeForm = {
  require: "either",
  company: true,
  note: true,
  questions: [],
};

/** A plain object read loosely: only the named keys, each of unknown type. */
type Loose<K extends string> = Partial<Record<K, unknown>>;

function isRecord<K extends string>(v: unknown): v is Loose<K> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseForm(raw: unknown): ExchangeForm | undefined {
  if (!isRecord<"require" | "company" | "note" | "questions">(raw)) return undefined;
  const require = (REQUIRE_MODES as readonly unknown[]).includes(raw.require)
    ? (raw.require as RequireMode)
    : DEFAULT_FORM.require;
  const questions: ExchangeQuestion[] = [];
  if (Array.isArray(raw.questions)) {
    for (const q of raw.questions) {
      if (questions.length >= QUESTIONS_MAX) break;
      if (!isRecord<"label" | "required">(q) || typeof q.label !== "string") continue;
      // Cut by whole characters: slicing a string can split an emoji in two,
      // and the database refuses the half that is left.
      const label = Array.from(q.label.trim()).slice(0, QUESTION_LABEL_MAX).join("").trim();
      if (!label) continue;
      questions.push(q.required === true ? { label, required: true } : { label });
    }
  }
  return {
    require,
    company: typeof raw.company === "boolean" ? raw.company : DEFAULT_FORM.company,
    note: typeof raw.note === "boolean" ? raw.note : DEFAULT_FORM.note,
    questions,
  };
}

function isDefaultForm(f: ExchangeForm): boolean {
  return f.require === "either" && f.company && f.note && f.questions.length === 0;
}

/** Cleans anything (a database value, an editor draft) into settings the
 *  database accepts. Null when nothing differs from the defaults, so an
 *  untouched card keeps a null column. */
export function parseExchange(raw: unknown): CardExchange | null {
  if (!isRecord<"vcardHide" | "form">(raw)) return null;
  const out: CardExchange = {};
  const hidden: unknown = raw.vcardHide;
  if (Array.isArray(hidden)) {
    const hide = VCARD_PARTS.filter((p) => hidden.includes(p));
    if (hide.length) out.vcardHide = hide;
  }
  const form = parseForm(raw.form);
  if (form && !isDefaultForm(form)) out.form = form;
  return out.vcardHide || out.form ? out : null;
}

/** The form a card shows: the owner's, or the standard one. */
export function formFor(exchange: CardExchange | null | undefined): ExchangeForm {
  return exchange?.form ?? DEFAULT_FORM;
}

export function vcardHidden(exchange: CardExchange | null | undefined): readonly VCardPart[] {
  return exchange?.vcardHide ?? [];
}

export type Submission = {
  name: string;
  email: string;
  phone: string;
  /** One per question, in order. */
  answers: readonly string[];
};

/** What still stops a share-back from being sent, in words the visitor can
 *  act on. Null when it is good to go. Runs in the form and again on the
 *  server, which never trusts the form. */
export function submissionProblem(
  form: ExchangeForm,
  s: Submission,
  ownerFirstName = "they",
): string | null {
  if (!s.name.trim()) return "Add your name.";
  const hasEmail = !!s.email.trim();
  const hasPhone = !!s.phone.trim();
  const reach = `so ${ownerFirstName} can reach you`;
  if (form.require === "email" && !hasEmail) return `Add your email ${reach}.`;
  if (form.require === "phone" && !hasPhone) return `Add your phone number ${reach}.`;
  if (form.require === "both" && !(hasEmail && hasPhone))
    return `Add your email and phone number ${reach}.`;
  if (!hasEmail && !hasPhone) return `Add an email or phone number ${reach}.`;
  for (const [i, q] of form.questions.entries()) {
    const a = s.answers[i] ?? "";
    if (a.length > ANSWER_MAX) return `"${q.label}" is too long.`;
    if (q.required && !a.trim()) return `Please answer "${q.label}".`;
  }
  return null;
}

/** A signed-in visitor's own details, taken from their ContactKickstart card. */
export type ShareBackPrefill = {
  name: string;
  email: string;
  phone: string;
  company: string;
  /** Their card's address, sent along as the note. */
  cardUrl: string;
};

/** What a member sends with one tap, and what their form starts out holding.
 *  Fields the owner switched off stay empty. */
export function prefillSubmission(form: ExchangeForm, mine: ShareBackPrefill) {
  return {
    name: mine.name,
    email: mine.email,
    phone: mine.phone,
    company: form.company ? mine.company : "",
    note: form.note ? `My card: ${mine.cardUrl}` : "",
  };
}

/** Folds the answers into the contact's note, one "Question answer" line
 *  each, ahead of the visitor's own note. If it runs long the visitor's note
 *  is what gets cut, so the owner always gets the answers they asked for. */
export function composeNote(form: ExchangeForm, note: string, answers: readonly string[]): string {
  const lines: string[] = [];
  for (const [i, q] of form.questions.entries()) {
    const a = (answers[i] ?? "").replace(/\s+/g, " ").trim().slice(0, ANSWER_MAX);
    if (a) lines.push(/[?:]$/.test(q.label) ? `${q.label} ${a}` : `${q.label}: ${a}`);
  }
  const own = form.note ? note.trim() : "";
  const head = lines.join("\n");
  if (!head) return own.slice(0, NOTE_MAX);
  if (!own) return head.slice(0, NOTE_MAX);
  const room = NOTE_MAX - head.length - 2;
  return room > 0 ? `${head}\n\n${own.slice(0, room).trim()}` : head.slice(0, NOTE_MAX);
}
