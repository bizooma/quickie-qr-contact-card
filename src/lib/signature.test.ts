import { describe, expect, it } from "vitest";
import { buildSignatureHtml, MAX_SIGNATURE_LINKS, SIGNATURE_STYLES } from "./signature";
import type { CardData } from "./card-model";

const card: CardData = {
  slug: "kale",
  label: "Work",
  full_name: "Kale Dabling",
  job_title: "Founder",
  company: "Acme & Co <North>",
  phones: [{ label: "Mobile", value: "+1 555 0100" }],
  emails: [{ label: "Work", value: "kale@acme.com" }],
  website: "https://acme.com",
  location: null,
  bio: null,
  headshot_path: "kale/photo.jpg",
  logo_path: null,
  accent_color: "#E8553D",
  background_color: "#FFFFFF",
  font: "sans",
  template: "classic",
  links: [1, 2, 3, 4, 5, 6].map((i) => ({
    label: `Link ${i}`,
    url: `example.com/${i}`,
    icon: "link",
  })),
};

const PUBLIC_URL = "https://app.example.com/c/kale";

describe("buildSignatureHtml", () => {
  for (const style of SIGNATURE_STYLES) {
    it(`${style.id}: email-safe output with the save-contact link`, () => {
      const html = buildSignatureHtml(card, PUBLIC_URL, style.id);
      expect(html).not.toContain("<img");
      expect(html).not.toContain('class="');
      expect(html).toContain(`href="${PUBLIC_URL}"`);
      expect(html).toContain("Save my contact");
      expect(html.startsWith("<table")).toBe(true);
    });
  }

  it("escapes HTML in card fields", () => {
    const html = buildSignatureHtml(card, PUBLIC_URL, "classic");
    expect(html).toContain("Acme &amp; Co &lt;North&gt;");
    expect(html).not.toContain("<North>");
  });

  it("caps links and never embeds the private headshot", () => {
    const html = buildSignatureHtml(card, PUBLIC_URL, "classic");
    const linkAnchors = html.match(/example\.com\/\d/g) ?? [];
    expect(linkAnchors).toHaveLength(MAX_SIGNATURE_LINKS);
    expect(html).not.toContain("photo.jpg");
  });

  it("classic shows an initials badge", () => {
    expect(buildSignatureHtml(card, PUBLIC_URL, "classic")).toContain(">KD</td>");
  });
});
