import { describe, expect, it } from "vitest";
import {
  buildContactVCard,
  buildVCard,
  contactsToCsv,
  contactsToVcf,
  guessIcon,
  slugify,
  SLUG_RE,
  type CardData,
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
