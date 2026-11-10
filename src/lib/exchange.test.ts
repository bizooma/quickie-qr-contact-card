import { describe, expect, it } from "vitest";
import {
  ANSWER_MAX,
  DEFAULT_FORM,
  NOTE_MAX,
  QUESTION_LABEL_MAX,
  composeNote,
  formFor,
  parseExchange,
  prefillSubmission,
  submissionProblem,
  vcardHidden,
  type ExchangeForm,
} from "./exchange";

const form = (over: Partial<ExchangeForm> = {}): ExchangeForm => ({ ...DEFAULT_FORM, ...over });

describe("parseExchange", () => {
  it("is null for nothing, junk and plain defaults", () => {
    expect(parseExchange(null)).toBeNull();
    expect(parseExchange("x")).toBeNull();
    expect(parseExchange([])).toBeNull();
    expect(parseExchange({})).toBeNull();
    expect(parseExchange({ vcardHide: [], form: { ...DEFAULT_FORM } })).toBeNull();
  });

  it("keeps known parts only, in a stable order, without repeats", () => {
    expect(parseExchange({ vcardHide: ["photo", "name", "phones", "photo", 7] })).toEqual({
      vcardHide: ["phones", "photo"],
    });
  });

  it("drops unknown keys so the database guard never sees them", () => {
    expect(parseExchange({ vcardHide: ["bio"], other: 1 })).toEqual({ vcardHide: ["bio"] });
  });

  it("cleans a form: unknown mode, blank and extra questions, long labels", () => {
    const out = parseExchange({
      form: {
        require: "any",
        company: false,
        note: "yes",
        extra: true,
        questions: [
          { label: "  What are you working on?  ", required: true },
          { label: "   " },
          "nope",
          { label: "x".repeat(200), required: "yes", html: "<b>" },
          { label: "Third" },
          { label: "Fourth" },
        ],
      },
    });
    expect(out?.form).toEqual({
      require: "either",
      company: false,
      note: true,
      questions: [
        { label: "What are you working on?", required: true },
        { label: "x".repeat(QUESTION_LABEL_MAX) },
        { label: "Third" },
      ],
    });
  });

  it("never cuts a long label in the middle of an emoji", () => {
    const label = "x".repeat(QUESTION_LABEL_MAX - 1) + "🎉🎉";
    const out = parseExchange({ form: { questions: [{ label }] } });
    expect(out?.form?.questions[0]?.label).toBe("x".repeat(QUESTION_LABEL_MAX - 1) + "🎉");
  });

  it("keeps a form that only changes the required contact method", () => {
    expect(parseExchange({ form: { require: "both" } })).toEqual({
      form: { ...DEFAULT_FORM, require: "both" },
    });
  });
});

describe("formFor, vcardHidden", () => {
  const full = parseExchange({ vcardHide: ["bio"], form: { require: "email" } });
  it("falls back to the standard form and an empty list", () => {
    expect(formFor(null)).toEqual(DEFAULT_FORM);
    expect(formFor(full).require).toBe("email");
    expect(vcardHidden(undefined)).toEqual([]);
    expect(vcardHidden(full)).toEqual(["bio"]);
  });
});

describe("submissionProblem", () => {
  const ok = { name: "Ana", email: "ana@example.com", phone: "555 0100", answers: [] };

  it("passes a complete submission", () => {
    expect(submissionProblem(form(), ok)).toBeNull();
    expect(submissionProblem(form({ require: "both" }), ok)).toBeNull();
  });

  it("needs a name", () => {
    expect(submissionProblem(form(), { ...ok, name: "  " })).toBe("Add your name.");
  });

  it("applies each contact rule", () => {
    const noEmail = { ...ok, email: "" };
    const noPhone = { ...ok, phone: " " };
    const neither = { ...ok, email: "", phone: "" };
    expect(submissionProblem(form(), noEmail)).toBeNull();
    expect(submissionProblem(form(), noPhone)).toBeNull();
    expect(submissionProblem(form(), neither, "Sam")).toBe(
      "Add an email or phone number so Sam can reach you.",
    );
    expect(submissionProblem(form({ require: "email" }), noEmail, "Sam")).toBe(
      "Add your email so Sam can reach you.",
    );
    expect(submissionProblem(form({ require: "phone" }), noPhone, "Sam")).toBe(
      "Add your phone number so Sam can reach you.",
    );
    expect(submissionProblem(form({ require: "both" }), noPhone, "Sam")).toBe(
      "Add your email and phone number so Sam can reach you.",
    );
  });

  it("requires only the questions marked required", () => {
    const f = form({ questions: [{ label: "Role?", required: true }, { label: "Budget" }] });
    expect(submissionProblem(f, { ...ok, answers: ["", "10k"] })).toBe('Please answer "Role?".');
    expect(submissionProblem(f, { ...ok, answers: ["Founder"] })).toBeNull();
  });

  it("refuses an answer that is too long", () => {
    const f = form({ questions: [{ label: "Budget" }] });
    expect(submissionProblem(f, { ...ok, answers: ["x".repeat(ANSWER_MAX + 1)] })).toBe(
      '"Budget" is too long.',
    );
  });
});

describe("prefillSubmission", () => {
  const mine = {
    name: "Vera",
    email: "vera@example.com",
    phone: "",
    company: "Belay",
    cardUrl: "https://contactkickstart.com/c/vera",
  };
  it("sends the member's details with their card address as the note", () => {
    expect(prefillSubmission(form(), mine)).toEqual({
      name: "Vera",
      email: "vera@example.com",
      phone: "",
      company: "Belay",
      note: "My card: https://contactkickstart.com/c/vera",
    });
  });
  it("leaves out fields the owner switched off", () => {
    const out = prefillSubmission(form({ company: false, note: false }), mine);
    expect(out.company).toBe("");
    expect(out.note).toBe("");
  });
  it("is enough for one tap only when it meets the owner's rules", () => {
    const sent = { ...prefillSubmission(form(), mine), answers: [] };
    expect(submissionProblem(form(), sent)).toBeNull();
    expect(submissionProblem(form({ require: "phone" }), sent)).not.toBeNull();
    expect(
      submissionProblem(form({ questions: [{ label: "Role?", required: true }] }), sent),
    ).not.toBeNull();
  });
});

describe("composeNote", () => {
  const f = form({ questions: [{ label: "What are you working on?" }, { label: "Budget" }] });

  it("is just the note when there are no answers", () => {
    expect(composeNote(form(), "  Met at the expo  ", [])).toBe("Met at the expo");
    expect(composeNote(f, "Hi", ["", " "])).toBe("Hi");
  });

  it("puts answers first, one per line", () => {
    expect(composeNote(f, "Met at the expo", ["A CRM\nfor  vets", "10k"])).toBe(
      "What are you working on? A CRM for vets\nBudget: 10k\n\nMet at the expo",
    );
    expect(composeNote(f, "", ["", "10k"])).toBe("Budget: 10k");
  });

  it("ignores the visitor's note when the owner turned the field off", () => {
    expect(composeNote(form({ note: false }), "sneaky", [])).toBe("");
  });

  it("never exceeds the note column, cutting the visitor's note first", () => {
    const out = composeNote(f, "n".repeat(NOTE_MAX), ["a".repeat(ANSWER_MAX), "b".repeat(500)]);
    expect(out.length).toBeLessThanOrEqual(NOTE_MAX);
    expect(out).toContain(`Budget: ${"b".repeat(ANSWER_MAX)}\n\nn`);
    expect(composeNote(form(), "n".repeat(NOTE_MAX + 50), []).length).toBe(NOTE_MAX);
  });
});
