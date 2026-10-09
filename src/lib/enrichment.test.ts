import { describe, expect, it } from "vitest";
import { buildSuggestions, canEnrich } from "./enrichment";
import type { EnrichmentResult } from "./ai-model";

const empty: EnrichmentResult = { job_title: null, company: null, website: null, linkedin_url: null, summary: "" };

describe("enrichment suggestions", () => {
  it("returns nothing when the AI found nothing reliable", () => {
    expect(buildSuggestions({}, empty)).toEqual([]);
  });
  it("suggests filling an empty field", () => {
    const r = { ...empty, job_title: { value: "CTO", source: "https://acme.com/team" } };
    expect(buildSuggestions({ job_title: null }, r)).toEqual([{ field: "job_title", current: null, value: "CTO", source: "https://acme.com/team" }]);
  });
  it("skips values that only differ cosmetically", () => {
    const r = { ...empty, website: { value: "https://www.acme.com/", source: "x" }, company: { value: "ACME", source: "x" } };
    expect(buildSuggestions({ website: "acme.com", company: "Acme" }, r)).toEqual([]);
  });
  it("offers a replacement when the value meaningfully differs", () => {
    const r = { ...empty, job_title: { value: "VP Sales", source: "x" } };
    expect(buildSuggestions({ job_title: "Sales Manager" }, r)[0]?.current).toBe("Sales Manager");
  });
});

describe("canEnrich", () => {
  it("needs name + company, or an email", () => {
    expect(canEnrich({ full_name: "Ann", company: "Acme", email: null })).toBe(true);
    expect(canEnrich({ full_name: "Ann", company: null, email: "a@acme.com" })).toBe(true);
    expect(canEnrich({ full_name: "Ann", company: null, email: null })).toBe(false);
  });
});
