import { describe, expect, it } from "vitest";
import type { OwnCardScan } from "./ai-model";
import type { CardData } from "./card-model";
import {
  contrastRatio,
  deriveCardColors,
  mergeScannedIntoCard,
  normalizeHex,
  ownCardToFields,
} from "./own-card";

const scan = (over: Partial<OwnCardScan> = {}): OwnCardScan => ({
  is_business_card: true,
  full_name: "  Dana Reyes ",
  job_title: "Broker",
  company: "Summit Realty",
  phones: [
    { label: "Mobile", value: "+1 555 010 2000" },
    { label: "", value: "+1 (555) 010-2000" },
    { label: "Office", value: "+1 555 010 3000" },
  ],
  emails: [{ label: "", value: "dana@summit.example" }],
  website: "summit.example",
  address: "12 Main St, Denver CO",
  tagline: "Homes that fit",
  social_links: [
    { label: "LinkedIn", url: "linkedin.com/in/danareyes" },
    { label: "Site", url: "https://www.summit.example/" },
    { label: "", url: "  " },
  ],
  brand_color: "#0f766e",
  background_color: "#ffffff",
  headshot: null,
  logo: null,
  ...over,
});

describe("normalizeHex", () => {
  it("accepts 3- and 6-digit hex with or without #", () => {
    expect(normalizeHex("#0f766e")).toBe("#0F766E");
    expect(normalizeHex("abc")).toBe("#AABBCC");
  });
  it("rejects anything else", () => {
    expect(normalizeHex("teal")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex(null)).toBeNull();
  });
});

describe("deriveCardColors", () => {
  it("keeps a brand color that reads on the background", () => {
    expect(deriveCardColors("#0F766E", "#FFFFFF")).toEqual({
      accent_color: "#0F766E",
      background_color: "#FFFFFF",
    });
  });
  it("swaps a washed-out accent for a readable preset", () => {
    const c = deriveCardColors("#FAFAFA", "#FFFFFF");
    expect(c.accent_color).not.toBe("#FAFAFA");
    expect(contrastRatio(c.accent_color, c.background_color)).toBeGreaterThanOrEqual(2);
  });
  it("defaults to a white background and a preset accent when unreadable", () => {
    const c = deriveCardColors("not a color", undefined);
    expect(c.background_color).toBe("#FFFFFF");
    expect(contrastRatio(c.accent_color, "#FFFFFF")).toBeGreaterThanOrEqual(2);
  });
});

describe("ownCardToFields", () => {
  it("maps details, dedupes contacts, and skips the website as a link", () => {
    const f = ownCardToFields(scan(), { headshotPath: "u/face.jpg", logoPath: "u/logo.jpg" });
    expect(f.full_name).toBe("Dana Reyes");
    expect(f.phones).toEqual([
      { label: "Mobile", value: "+1 555 010 2000" },
      { label: "Office", value: "+1 555 010 3000" },
    ]);
    expect(f.emails).toEqual([{ label: "Email", value: "dana@summit.example" }]);
    expect(f.location).toBe("12 Main St, Denver CO");
    expect(f.bio).toBe("Homes that fit");
    expect(f.links).toEqual([
      { label: "LinkedIn", url: "https://linkedin.com/in/danareyes", icon: "linkedin" },
    ]);
    expect(f.headshot_path).toBe("u/face.jpg");
    expect(f.logo_path).toBe("u/logo.jpg");
    expect(f.accent_color).toBe("#0F766E");
  });
});

describe("mergeScannedIntoCard", () => {
  const card: CardData = {
    slug: "dana",
    label: "Work",
    full_name: "Dana",
    job_title: "Agent",
    company: null,
    phones: [{ label: "Mobile", value: "111" }],
    emails: [],
    website: "old.example",
    location: null,
    bio: "Keep me",
    headshot_path: "u/old-face.jpg",
    logo_path: null,
    accent_color: "#E8553D",
    background_color: "#FFFFFF",
    font: "sans",
    template: "classic",
    links: [{ label: "LinkedIn", url: "https://linkedin.com/in/danareyes", icon: "linkedin" }],
  };

  it("fills from the scan but keeps what the scan didn't find", () => {
    const merged = mergeScannedIntoCard(
      card,
      ownCardToFields(scan({ tagline: null }), { logoPath: "u/logo.jpg" }),
    );
    expect(merged.full_name).toBe("Dana Reyes");
    expect(merged.job_title).toBe("Broker");
    expect(merged.bio).toBe("Keep me");
    expect(merged.headshot_path).toBe("u/old-face.jpg");
    expect(merged.logo_path).toBe("u/logo.jpg");
    expect(merged.links).toHaveLength(1);
    expect(merged.slug).toBe("dana");
    expect(merged.template).toBe("classic");
  });
});
