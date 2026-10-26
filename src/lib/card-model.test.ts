import { describe, expect, it } from "vitest";
import {
  buildContactVCard,
  buildVCard,
  companyDomain,
  companyLogoUrl,
  contactsToCsv,
  contactsToVcf,
  guessIcon,
  slugify,
  SLUG_RE,
  type CardData,
  lockedCardIds,
  cardLogoBox,
} from "./card-model";

const card: CardData = {
  slug: "kale",
  label: "Work",
  full_name: "Kale Dabling",
  job_title: "Founder",
  company: "Acme, Inc.",
  phones: [{ label: "Mobile", value: "+1 555 0100" }],
  emails: [{ label: "Work", value: "kale@acme.com" }],
  website: "acme.com",
  location: "Chicago",
  bio: null,
  headshot_path: null,
  logo_path: null,
  logo_size: "standard",
  banner_path: null,
  accent_color: "#E8553D",
  background_color: "#FFFFFF",
  font: "sans",
  template: "classic",
  links: [{ label: "LinkedIn", url: "linkedin.com/in/kale", icon: "linkedin" }],
};

describe("vCard", () => {
  it("includes name, escaped org, phone, email, links and photo", () => {
    const v = buildVCard(card, { photoBase64: "AAAA", photoType: "JPEG" });
    expect(v).toContain("FN:Kale Dabling");
    expect(v).toContain("N:Dabling;Kale;;;");
    expect(v).toContain("ORG:Acme\\, Inc.");
    expect(v).toContain("TEL;TYPE=CELL,VOICE:+1 555 0100");
    expect(v).toContain("EMAIL;TYPE=INTERNET,WORK:kale@acme.com");
    expect(v).toContain("URL;TYPE=LinkedIn:https://linkedin.com/in/kale");
    expect(v).toContain("PHOTO;ENCODING=b;TYPE=JPEG:AAAA");
  });

  it("builds a contact vCard with escaped fields and met-at note", () => {
    const v = buildContactVCard({
      full_name: "Maria Chen",
      job_title: "VP Sales",
      company: "Globex; Corp",
      email: "maria@globex.com",
      phone: "+1 555 0101",
      website: "globex.com",
      note: "Met at Web Summit",
    });
    expect(v).toContain("N:Chen;Maria;;;");
    expect(v).toContain("ORG:Globex\\; Corp");
    expect(v).toContain("TEL;TYPE=CELL,VOICE:+1 555 0101");
    expect(v).toContain("URL:https://globex.com");
    expect(v).toContain("NOTE:Met at Web Summit");
  });

  it("adds the contact's LinkedIn profile to the phone contact", () => {
    const v = buildContactVCard({
      full_name: "Maria Chen",
      linkedin_url: "linkedin.com/in/maria",
    });
    expect(v).toContain("URL;TYPE=LinkedIn:https://linkedin.com/in/maria");
  });

  it("joins a batch into one multi-contact vcf and skips empty names", () => {
    const vcf = contactsToVcf([
      { full_name: "A One", email: "a@x.com" },
      { full_name: "  " },
      { full_name: "B Two", phone: "123" },
    ]);
    expect(vcf.match(/BEGIN:VCARD/g)).toHaveLength(2);
    expect(vcf.match(/END:VCARD/g)).toHaveLength(2);
    expect(vcf).toContain("FN:A One");
    expect(vcf).toContain("FN:B Two");
  });
});

describe("CSV export", () => {
  it("neutralises formula injection from share-back input", () => {
    const csv = contactsToCsv([
      {
        full_name: "=HYPERLINK(1)",
        email: null,
        phone: null,
        company: null,
        job_title: null,
        website: null,
        linkedin_url: null,
        address: null,
        met_at: null,
        source: "shareback",
        card_label: "Work",
        tags: ["Hot lead"],
        note: null,
        created_at: "2026-01-01",
      },
    ]);
    expect((csv.split("\r\n")[1] ?? "").startsWith("'=HYPERLINK(1)")).toBe(true);
  });

  it("exports website and LinkedIn in their own columns", () => {
    const csv = contactsToCsv([
      {
        full_name: "Maria Chen",
        email: null,
        phone: null,
        company: "Globex",
        job_title: null,
        website: "globex.com",
        linkedin_url: "https://linkedin.com/in/maria",
        address: null,
        met_at: null,
        source: "scan",
        card_label: null,
        tags: [],
        note: null,
        created_at: "2026-01-01",
      },
    ]);
    const [header, row] = csv.split("\r\n");
    expect(header?.split(",")).toEqual(expect.arrayContaining(["Website", "LinkedIn"]));
    expect(row).toContain("globex.com,https://linkedin.com/in/maria");
  });
});

describe("slugs and icons", () => {
  it("produces slugs the database accepts", () => {
    expect(SLUG_RE.test(slugify("Kale Dabling — Work"))).toBe(true);
    expect(SLUG_RE.test(slugify("Al"))).toBe(true);
  });
  it("detects social icons from URLs", () => {
    expect(guessIcon("https://x.com/kale")).toBe("x");
    expect(guessIcon("https://calendly.com/kale")).toBe("calendar");
  });
});

describe("companyDomain", () => {
  it("prefers the website and strips www", () => {
    expect(companyDomain({ website: "www.Northwind.com", email: "t@gmail.com" })).toBe(
      "northwind.com",
    );
    expect(companyDomain({ website: "https://app.acme.io/about" })).toBe("app.acme.io");
  });
  it("falls back to a work email domain", () => {
    expect(companyDomain({ email: "kale@belayreports.com" })).toBe("belayreports.com");
  });
  it("ignores personal-mail domains and garbage", () => {
    expect(companyDomain({ email: "someone@gmail.com" })).toBeNull();
    expect(companyDomain({ email: "someone@icloud.com" })).toBeNull();
    expect(companyDomain({ email: "not-an-email" })).toBeNull();
    expect(companyDomain({})).toBeNull();
  });
  it("builds a favicon url for the domain", () => {
    expect(companyLogoUrl("belayreports.com")).toBe(
      "https://www.google.com/s2/favicons?domain=belayreports.com&sz=128",
    );
  });
});

describe("lockedCardIds", () => {
  const u = "user-1";
  const cards = [
    { id: "b", user_id: u, org_id: null, created_at: "2026-10-12T00:00:00+00:00" },
    { id: "a", user_id: u, org_id: null, created_at: "2026-10-10T00:00:00+00:00" },
    { id: "t", user_id: u, org_id: "org-1", created_at: "2026-10-01T00:00:00+00:00" },
    { id: "x", user_id: "someone-else", org_id: null, created_at: "2026-10-01T00:00:00+00:00" },
  ];
  it("locks every personal card but the oldest on free", () => {
    expect([...lockedCardIds(cards, u, "free")]).toEqual(["b"]);
  });
  it("locks nothing on paid plans", () => {
    expect(lockedCardIds(cards, u, "pro").size).toBe(0);
    expect(lockedCardIds(cards, u, "premium").size).toBe(0);
  });
});

describe("cardLogoBox", () => {
  it("matches the photo, or grows on large", () => {
    expect(cardLogoBox(112, "standard")).toEqual({ height: 112, maxWidth: 224 });
    expect(cardLogoBox(112, "large")).toEqual({ height: 157, maxWidth: 314 });
    expect(cardLogoBox(72, "anything-else")).toEqual({ height: 72, maxWidth: 144 });
  });
});
