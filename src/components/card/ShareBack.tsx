import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitShareback } from "@/lib/capture.functions";
import {
  ANSWER_MAX,
  prefillSubmission,
  submissionProblem,
  type ExchangeForm,
  type ShareBackPrefill,
} from "@/lib/exchange";

const SEND_FAILED = "Couldn't send your details. Please try again.";

const optional = <span className="font-normal text-muted-foreground">(optional)</span>;

/** The "Share yours" drawer on a public card. It lays out the owner's form
 *  (or the standard one); the server checks every rule again on submit. */
export function ShareBack({
  slug,
  ownerName,
  form,
  prefill,
  open,
  onOpenChange,
  onSent,
}: {
  slug: string;
  ownerName: string;
  form: ExchangeForm;
  prefill?: ShareBackPrefill | null | undefined;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSent?: (() => void) | undefined;
}) {
  const [f, setF] = useState({ name: "", email: "", phone: "", company: "", note: "" });
  const [answers, setAnswers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const first = ownerName.trim().split(/\s+/)[0] || "them";

  // A signed-in visitor's own card arrives a moment after the page: fill the
  // form with it, once, unless they have already started typing.
  const filled = useRef(false);
  useEffect(() => {
    if (!prefill || filled.current) return;
    filled.current = true;
    setF((cur) =>
      cur.name || cur.email || cur.phone || cur.company || cur.note
        ? cur
        : prefillSubmission(form, prefill),
    );
  }, [prefill, form]);

  // One phone or tablet often gets passed around at an event: once the
  // "Sent!" screen is closed, the form is blank again for the next person.
  useEffect(() => {
    if (open || !done || prefill) return;
    setDone(false);
    setF({ name: "", email: "", phone: "", company: "", note: "" });
    setAnswers([]);
  }, [open, done, prefill]);

  const needEmail = form.require === "email" || form.require === "both";
  const needPhone = form.require === "phone" || form.require === "both";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = submissionProblem(form, { ...f, answers }, first);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      // Server function: applies the owner's form, saves, then notifies them.
      await submitShareback({
        data: {
          slug,
          name: f.name,
          email: f.email,
          phone: f.phone,
          company: form.company ? f.company : "",
          note: form.note ? f.note : "",
          answers: form.questions.map((_, i) => answers[i] ?? ""),
        },
      });
      setDone(true);
      onSent?.();
    } catch (err) {
      // Server function messages are already visitor-safe (sharebackErrorMessage).
      toast.error(err instanceof Error ? err.message : SEND_FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {/* The owner's form can be taller than a small phone: cap it and scroll. */}
      <DrawerContent className="max-h-[92dvh]">
        <div className="mx-auto w-full max-w-md overflow-y-auto px-6 pb-8">
          <DrawerHeader className="px-0">
            <DrawerTitle>{done ? "Sent!" : `Share your details with ${first}`}</DrawerTitle>
          </DrawerHeader>
          {done ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Thanks. {first} now has your details.</p>
              {/* The viral loop: the person who just shared is the next card owner. */}
              {!prefill && (
                <>
                  <Button asChild className="h-11 w-full">
                    <a href={`/?ref=shareback&c=${encodeURIComponent(slug)}`}>
                      Get your own free card
                    </a>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    A digital card like this one, with your own QR code and share-back form. Free,
                    no credit card.
                  </p>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="sb-name">Your name</Label>
                <Input
                  id="sb-name"
                  required
                  maxLength={120}
                  autoComplete="name"
                  value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="sb-email">Email</Label>
                  <Input
                    id="sb-email"
                    type="email"
                    inputMode="email"
                    required={needEmail}
                    maxLength={255}
                    autoComplete="email"
                    value={f.email}
                    onChange={(e) => setF({ ...f, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sb-phone">Phone</Label>
                  <Input
                    id="sb-phone"
                    type="tel"
                    inputMode="tel"
                    required={needPhone}
                    maxLength={40}
                    autoComplete="tel"
                    value={f.phone}
                    onChange={(e) => setF({ ...f, phone: e.target.value })}
                  />
                </div>
              </div>
              {form.company && (
                <div className="space-y-1">
                  <Label htmlFor="sb-company">Company {optional}</Label>
                  <Input
                    id="sb-company"
                    maxLength={120}
                    autoComplete="organization"
                    value={f.company}
                    onChange={(e) => setF({ ...f, company: e.target.value })}
                  />
                </div>
              )}
              {form.questions.map((q, i) => (
                <div key={i} className="space-y-1">
                  <Label htmlFor={`sb-q-${i}`}>
                    {q.label} {!q.required && optional}
                  </Label>
                  <Input
                    id={`sb-q-${i}`}
                    required={q.required === true}
                    maxLength={ANSWER_MAX}
                    value={answers[i] ?? ""}
                    onChange={(e) => {
                      const next = form.questions.map((_, j) => answers[j] ?? "");
                      next[i] = e.target.value;
                      setAnswers(next);
                    }}
                  />
                </div>
              ))}
              {form.note && (
                <div className="space-y-1">
                  <Label htmlFor="sb-note">Note {optional}</Label>
                  <Textarea
                    id="sb-note"
                    maxLength={1000}
                    placeholder="Where we met, what you need…"
                    value={f.note}
                    onChange={(e) => setF({ ...f, note: e.target.value })}
                  />
                </div>
              )}
              {form.require === "either" && (
                <p className="text-xs text-muted-foreground">
                  An email or phone number is needed so {first} can reach you.
                </p>
              )}
              <Button type="submit" className="h-11 w-full" disabled={busy}>
                {busy ? "Sending…" : "Send my details"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Only {first} receives these details, to follow up with you. Delivered by
                ContactKickstart.{" "}
                <a href="/privacy" className="underline">
                  Privacy
                </a>
              </p>
            </form>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
