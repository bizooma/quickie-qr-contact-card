import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CardData } from "@/lib/card-model";
import {
  QUESTIONS_MAX,
  QUESTION_LABEL_MAX,
  REQUIRE_MODES,
  REQUIRE_NAMES,
  VCARD_PARTS,
  VCARD_PART_NAMES,
  formFor,
  parseExchange,
  vcardHidden,
  type CardExchange,
  type ExchangeForm,
  type ExchangeQuestion,
  type VCardPart,
} from "@/lib/exchange";
import { PRO_PRICE_LABEL } from "@/lib/plans";
import { cn } from "@/lib/utils";

function Row({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

/** Editor controls for how a card trades details: what "Save contact" puts in
 *  someone's phone, and the owner's own "Share yours" form (paid plans).
 *  Every change goes back out through parseExchange, so the editor can never
 *  save something the database refuses. On the free plan the form controls
 *  are locked and a form saved earlier is carried through untouched: the
 *  public card simply doesn't use it until the plan is paid again. */
export function ExchangePanel({
  card,
  canEditForm,
  onChange,
}: {
  card: CardData;
  /** Pro, Premium and team plans. */
  canEditForm: boolean;
  onChange: (exchange: CardExchange | null) => void;
}) {
  const hidden = vcardHidden(card.exchange);
  const form = formFor(card.exchange);
  // Questions as typed, including a blank one just added: parseExchange drops
  // blanks and trims labels, which would otherwise fight the cursor.
  const [draft, setDraft] = useState<ExchangeQuestion[]>(form.questions);

  const emit = (next: { vcardHide?: readonly VCardPart[]; form?: Partial<ExchangeForm> }) => {
    onChange(
      parseExchange({
        vcardHide: next.vcardHide ?? hidden,
        form: canEditForm ? { ...form, questions: draft, ...next.form } : card.exchange?.form,
      }),
    );
  };
  const setQuestions = (questions: ExchangeQuestion[]) => {
    setDraft(questions);
    emit({ form: { questions } });
  };

  return (
    <div className="space-y-8">
      <section>
        <h3 className="font-display text-base font-bold">Save contact</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose what lands in someone's phone when they tap Save contact. Your card still shows
          everything, and your name and a link back to your card are always included.
        </p>
        <div className="mt-3 divide-y rounded-xl border px-4">
          {VCARD_PARTS.map((part) => (
            <Row
              key={part}
              id={`vc-${part}`}
              label={VCARD_PART_NAMES[part]}
              checked={!hidden.includes(part)}
              onChange={(on) =>
                emit({ vcardHide: on ? hidden.filter((p) => p !== part) : [...hidden, part] })
              }
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="flex items-center gap-2 font-display text-base font-bold">
          Share yours form
          {!canEditForm && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold">
              <Lock className="h-3 w-3" aria-hidden />
              Pro
            </span>
          )}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Decide what people fill in when they send you their details. Answers to your questions
          are saved in the contact's note.
        </p>

        <fieldset disabled={!canEditForm} className={cn("mt-4 space-y-5", !canEditForm && "opacity-60")}>
          <div>
            <Label className="mb-3 block">They must give</Label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="They must give">
              {REQUIRE_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={form.require === m}
                  onClick={() => emit({ form: { require: m } })}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                    form.require === m ? "border-brand bg-brand text-white" : "hover:bg-muted",
                    !canEditForm && "cursor-not-allowed hover:bg-transparent",
                  )}
                >
                  {REQUIRE_NAMES[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y rounded-xl border px-4">
            <Row
              id="ex-company"
              label="Ask for their company"
              checked={form.company}
              disabled={!canEditForm}
              onChange={(company) => emit({ form: { company } })}
            />
            <Row
              id="ex-note"
              label="Let them add a note"
              checked={form.note}
              disabled={!canEditForm}
              onChange={(note) => emit({ form: { note } })}
            />
          </div>

          <div>
            <Label className="mb-1 block">Your questions</Label>
            <p className="mb-3 text-xs text-muted-foreground">
              Up to {QUESTIONS_MAX}, each with a short answer. For example: What are you working
              on?
            </p>
            <div className="space-y-2">
              {draft.map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    aria-label={`Question ${i + 1}`}
                    placeholder="Your question"
                    maxLength={QUESTION_LABEL_MAX}
                    value={q.label}
                    onChange={(e) =>
                      setQuestions(
                        draft.map((d, j) => (j === i ? { ...d, label: e.target.value } : d)),
                      )
                    }
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium">
                    <Switch
                      checked={q.required === true}
                      onCheckedChange={(required) =>
                        setQuestions(draft.map((d, j) => (j === i ? { ...d, required } : d)))
                      }
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove question ${i + 1}`}
                    onClick={() => setQuestions(draft.filter((_, j) => j !== i))}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {draft.length < QUESTIONS_MAX && (
              <button
                type="button"
                onClick={() => setDraft([...draft, { label: "" }])}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-dashed px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <Plus className="h-4 w-4" />
                Add a question
              </button>
            )}
          </div>
        </fieldset>

        {!canEditForm && (
          <p className="mt-4 text-xs text-muted-foreground">
            Your own form comes with Pro ({PRO_PRICE_LABEL}) and Premium. Until then your card uses
            the standard form: name, email or phone, company and a note.{" "}
            <Link to="/app/settings" className="font-semibold text-brand underline">
              See plans
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
