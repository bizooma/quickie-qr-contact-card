import { describe, expect, it } from "vitest";
import {
  AREAS_MAX,
  CONSENT_NOTE,
  admissionsLine,
  cleanConsultUrl,
  needsConsent,
  newAttorneyPractice,
  parsePractice,
  practiceWarnings,
  withConsentNote,
} from "./practice";

describe("parsePractice", () => {
  it("is null for nothing, junk and unknown kinds", () => {
    expect(parsePractice(null)).toBeNull();
    expect(parsePractice("attorney")).toBeNull();
    expect(parsePractice([])).toBeNull();
    expect(parsePractice({})).toBeNull();
    expect(parsePractice({ kind: "plumber" })).toBeNull();
  });

  it("keeps a bare attorney pack", () => {
    expect(parsePractice({ kind: "attorney" })).toEqual({ kind: "attorney" });
  });

  it("drops half-typed admissions and empty bar numbers", () => {
    expect(
      parsePractice({
        kind: "attorney",
        admissions: [
          { state: " Florida ", number: " 123456 " },
          { state: "" },
          { state: "Georgia", number: "" },
          7,
        ],
      }),
    ).toEqual({
      kind: "attorney",
      admissions: [{ state: "Florida", number: "123456" }, { state: "Georgia" }],
    });
  });

  it("dedupes areas case-insensitively and caps the count", () => {
    const many = Array.from({ length: 12 }, (_, i) => `Area ${i}`);
    expect(
      parsePractice({ kind: "attorney", areas: ["Probate", "probate", " ", ...many] })?.areas,
    ).toHaveLength(AREAS_MAX);
    expect(parsePractice({ kind: "attorney", areas: ["Probate", "probate"] })?.areas).toEqual([
      "Probate",
    ]);
  });

  it("keeps consent only when explicitly true", () => {
    expect(parsePractice({ kind: "attorney", consent: true })?.consent).toBe(true);
    expect(parsePractice({ kind: "attorney", consent: "yes" })?.consent).toBeUndefined();
  });

  it("round-trips a new attorney pack", () => {
    const p = newAttorneyPractice();
    expect(parsePractice(p)).toEqual({ kind: "attorney", disclaimer: p.disclaimer, consent: true });
  });
});

describe("cleanConsultUrl", () => {
  it("accepts https and adds it to bare domains", () => {
    expect(cleanConsultUrl("calendly.com/jane")).toBe("https://calendly.com/jane");
    expect(cleanConsultUrl("https://app.clio.com/book")).toBe("https://app.clio.com/book");
  });
  it("refuses anything that isn't an https web page", () => {
    expect(cleanConsultUrl("javascript:alert(1)")).toBeUndefined();
    expect(cleanConsultUrl("http://example.com")).toBeUndefined();
    expect(cleanConsultUrl("not a url")).toBeUndefined();
    expect(cleanConsultUrl("")).toBeUndefined();
  });
});

describe("admissionsLine", () => {
  it("lists states with bar numbers when given", () => {
    expect(admissionsLine([{ state: "Florida", number: "123" }, { state: "Georgia" }])).toBe(
      "Admitted in Florida (Bar No. 123) · Georgia",
    );
    expect(admissionsLine([])).toBe("");
  });
});

describe("practiceWarnings", () => {
  it("flags a missing office location, admission and disclaimer", () => {
    expect(practiceWarnings({ kind: "attorney" }, { location: null })).toHaveLength(3);
    expect(
      practiceWarnings(
        { kind: "attorney", admissions: [{ state: "FL" }], disclaimer: "x" },
        { location: "Jacksonville, FL" },
      ),
    ).toEqual([]);
    expect(practiceWarnings(null, { location: null })).toEqual([]);
  });
});

describe("consent", () => {
  it("is needed only on attorney cards that ask for it", () => {
    expect(needsConsent({ kind: "attorney", consent: true })).toBe(true);
    expect(needsConsent({ kind: "attorney" })).toBe(false);
    expect(needsConsent(null)).toBe(false);
  });
  it("puts the record first so a long note never cuts it", () => {
    expect(withConsentNote("", 1000)).toBe(CONSENT_NOTE);
    const long = withConsentNote("x".repeat(2000), 1000);
    expect(long).toHaveLength(1000);
    expect(long.startsWith(CONSENT_NOTE)).toBe(true);
  });
});
