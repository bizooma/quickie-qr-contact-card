import { describe, expect, it } from "vitest";
import {
  cleanClioToken,
  clioErrorMessage,
  clioInboxUrl,
  splitName,
  toClioLead,
  tokenCheckResult,
  tokenHint,
} from "./crm";

describe("Clio Grow", () => {
  it("picks the regional inbox", () => {
    expect(clioInboxUrl("us")).toBe("https://grow.clio.com/inbox_leads");
    expect(clioInboxUrl("eu")).toBe("https://eu.grow.clio.com/inbox_leads");
  });

  it("accepts plausible tokens only", () => {
    expect(cleanClioToken("  abcDEF123_-xyz  ")).toBe("abcDEF123_-xyz");
    expect(cleanClioToken("short")).toBeNull();
    expect(cleanClioToken("has spaces in it")).toBeNull();
    expect(tokenHint("abcdefgh1234")).toBe("1234");
  });

  it("splits names without inventing a last name", () => {
    expect(splitName("Jane van der Berg")).toEqual({ first: "Jane", last: "van der Berg" });
    expect(splitName("Cher")).toEqual({ first: "Cher", last: "Cher" });
    expect(splitName("  ")).toEqual({ first: "Unknown", last: "Unknown" });
  });

  it("maps a share-back to an inbox lead with the acknowledgment kept", () => {
    const lead = toClioLead(
      {
        full_name: "Sam Smith",
        email: " sam@example.com ",
        phone: "",
        company: "Acme",
        note: "[Acknowledged: ...]\n\nNeed help with an estate",
        source: "shareback",
        met_at: "Work card",
      },
      "https://quickieqr.com/c/jane",
    );
    expect(lead).toEqual({
      from_first: "Sam",
      from_last: "Smith",
      from_message:
        "[Acknowledged: ...]\n\nNeed help with an estate\n\nCompany: Acme\n\nShared their details from your QuickieQR card (Work card).",
      referring_url: "https://quickieqr.com/c/jane",
      from_source: "QuickieQR",
      from_email: "sam@example.com",
    });
  });

  it("always sends a message, which Clio requires", () => {
    const lead = toClioLead(
      {
        full_name: "Al",
        email: null,
        phone: "555",
        company: null,
        note: null,
        source: "scan",
        met_at: null,
      },
      "https://quickieqr.com/c/x",
    );
    expect(lead.from_message).toBe("Added in QuickieQR.");
    expect(lead.from_phone).toBe("555");
  });

  it("reads token checks and errors", () => {
    expect(tokenCheckResult(401)).toBe("invalid");
    expect(tokenCheckResult(422)).toBe("valid");
    expect(tokenCheckResult(500)).toBe("unknown");
    expect(clioErrorMessage(401)).toContain("lead capture token");
  });
});
