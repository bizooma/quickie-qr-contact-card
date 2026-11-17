import { describe, expect, it } from "vitest";
import {
  AREAS_MAX,
  CONSENT_NOTE,
  admissionsLine,
  cleanPackUrl,
  needsConsent,
  parsePractice,
  practiceWarnings,
  withConsentNote,
  FLORIDA_DISCLOSURE,
  cleanEin,
  cleanInterests,
  lowProfileView,
  newPractice,
  nonprofitStatusLine,
  packCta,
  switchPractice,
  withInterestsNote,
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
    const p = newPractice("attorney");
    expect(parsePractice(p)).toEqual({ kind: "attorney", disclaimer: p.disclaimer, consent: true });
  });
});

describe("cleanPackUrl", () => {
  it("accepts https and adds it to bare domains", () => {
    expect(cleanPackUrl("calendly.com/jane")).toBe("https://calendly.com/jane");
    expect(cleanPackUrl("https://app.clio.com/book")).toBe("https://app.clio.com/book");
  });
  it("refuses anything that isn't an https web page", () => {
    expect(cleanPackUrl("javascript:alert(1)")).toBeUndefined();
    expect(cleanPackUrl("http://example.com")).toBeUndefined();
    expect(cleanPackUrl("not a url")).toBeUndefined();
    expect(cleanPackUrl("")).toBeUndefined();
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

describe("nonprofit pack", () => {
  it("keeps only nonprofit keys and normalizes the EIN", () => {
    expect(
      parsePractice({
        kind: "nonprofit",
        exempt: true,
        ein: "123456789",
        donateUrl: "givebutter.com/theplace",
        disclosure: " FL text ",
        stateReg: "CH12345",
        interests: true,
        lowProfile: true,
        consultUrl: "https://calendly.com/x",
        areas: ["Probate"],
      }),
    ).toEqual({
      kind: "nonprofit",
      exempt: true,
      ein: "12-3456789",
      donateUrl: "https://givebutter.com/theplace",
      disclosure: "FL text",
      stateReg: "CH12345",
      interests: true,
      lowProfile: true,
    });
  });

  it("drops a malformed EIN and unsafe donate links", () => {
    expect(cleanEin("12-345")).toBeUndefined();
    expect(cleanEin("12-3456789")).toBe("12-3456789");
    expect(parsePractice({ kind: "nonprofit", donateUrl: "javascript:x" })).toEqual({
      kind: "nonprofit",
    });
  });

  it("an attorney pack never carries nonprofit keys", () => {
    expect(parsePractice({ kind: "attorney", lowProfile: true, ein: "123456789" })).toEqual({
      kind: "attorney",
    });
  });

  it("status line, main button and warnings", () => {
    const p = {
      kind: "nonprofit" as const,
      exempt: true,
      ein: "12-3456789",
      donateUrl: "https://a.org/give",
    };
    expect(nonprofitStatusLine(p)).toBe("501(c)(3) nonprofit · EIN 12-3456789");
    expect(packCta(p)).toEqual({ label: "Donate", url: "https://a.org/give", kind: "donate" });
    expect(practiceWarnings(p, { location: null })).toHaveLength(1);
    expect(practiceWarnings({ ...p, disclosure: FLORIDA_DISCLOSURE }, { location: null })).toEqual(
      [],
    );
    expect(packCta({ kind: "attorney", consultUrl: "https://c.com/x" })?.label).toBe(
      "Schedule a consultation",
    );
    expect(packCta(null)).toBeNull();
  });

  it("low-profile shows the organization, not the person", () => {
    const card = {
      full_name: "Jane Doe",
      job_title: "Director",
      company: "The PLACE",
      headshot_path: "u/h.jpg",
      practice: { kind: "nonprofit" as const, lowProfile: true },
    };
    expect(lowProfileView(card)).toMatchObject({
      full_name: "The PLACE",
      company: null,
      job_title: null,
      headshot_path: null,
    });
    expect(lowProfileView({ ...card, company: null }).full_name).toBe("Jane Doe");
    const normal = { ...card, practice: { kind: "nonprofit" as const } };
    expect(lowProfileView(normal)).toBe(normal);
  });

  it("interests: known ones only, recorded ahead of the note", () => {
    expect(cleanInterests(["Donating", "Hacking", "Volunteering", "Donating"])).toEqual([
      "Volunteering",
      "Donating",
    ]);
    expect(withInterestsNote(["Volunteering"], "Met at the gala", 1000)).toBe(
      "Interested in: Volunteering\n\nMet at the gala",
    );
    expect(withInterestsNote([], "hi", 1000)).toBe("hi");
  });

  it("switching profession", () => {
    const att = { kind: "attorney" as const, areas: ["Probate"] };
    expect(switchPractice(att, "attorney")).toBe(att);
    expect(switchPractice(att, "nonprofit")).toEqual(newPractice("nonprofit"));
    expect(switchPractice(att, "general")).toBeNull();
  });
});
