import { describe, expect, it } from "vitest";
import { buildSignatureHtml, SIGNATURE_STYLES } from "./signature";
import type { CardData } from "./card-model";

const card: CardData = {
  slug: "kale", label: "Work", full_name: "Kale Dabling", job_title: "Founder", company: "Acme <Co>",
  phones: [{ label: "Mobile", value: "+1 555 0100" }], emails: [{ label: "Work", value: "kale@acme.com" }],
  website: "acme.com", location: null, bio: null, headshot_path: "u/x.jpg", logo_path: "u/y.png",
  accent_color: "#E8553D", background_color: "#FFFFFF", font: "sans", template: "classic",
  links: [1, 2, 3, 4, 5].map((n) => ({ label: `Link${n}`, url: `https://ex.com/${n}`, icon: "link" })),
};
const URL_ = "https://app.example/c/kale";

describe("email signature HTML", () => {
  for (const s of SIGNATURE_STYLES) {
    it(`${s.id}: inline styles only, no images, no classes or external CSS`, () => {
      const html = buildSignatureHtml(card, s.id, URL_);
      expect(html).not.toMatch(/<img/i);
      expect(html).not.toMatch(/class=/i);
      expect(html).not.toMatch(/<style|<link|flex/i);
      expect(html.startsWith("<table")).toBe(true);
    });
    it(`${s.id}: links "Save my contact" to the public card page`, () => {
      expect(buildSignatureHtml(card, s.id, URL_)).toMatch(/<a href="https:\/\/app\.example\/c\/kale"[^>]*>Save my contact<\/a>/);
    });
  }
  it("classic shows an initials badge in the accent color", () => {
    const html = buildSignatureHtml(card, "classic", URL_);
    expect(html).toMatch(/background-color:#E8553D;[^"]*">KD<\/td>/);
  });
  it("caps custom links at 4", () => {
    const html = buildSignatureHtml(card, "minimal", URL_);
    expect(html).toContain("Link4");
    expect(html).not.toContain("Link5");
  });
  it("escapes card text", () => {
    expect(buildSignatureHtml(card, "minimal", URL_)).toContain("Acme &lt;Co&gt;");
  });
});
