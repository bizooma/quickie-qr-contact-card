import { describe, expect, it } from "vitest";
import {
  decodeQrText,
  mergeScannedContacts,
  nameFromLinkedInSlug,
  parseMeCard,
  parseVCard,
} from "./scan-decode";
import type { ScannedContact } from "./ai-model";

const VCARD = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "N:Doe;Jane;;;",
  "FN:Jane Doe",
  "ORG:Acme Corp;Sales",
  "TITLE:VP Sales",
  "TEL;TYPE=CELL:+1 555 0100",
  "EMAIL;TYPE=WORK:jane@acme.com",
  "URL:https://acme.com",
  "NOTE:Met at expo\\, hall 4",
  "END:VCARD",
].join("\r\n");

describe("parseVCard", () => {
  it("reads the common fields", () => {
    const c = parseVCard(VCARD)!;
    expect(c.full_name).toBe("Jane Doe");
    expect(c.company).toBe("Acme Corp");
    expect(c.job_title).toBe("VP Sales");
    expect(c.phone).toBe("+1 555 0100");
    expect(c.email).toBe("jane@acme.com");
    expect(c.website).toBe("https://acme.com");
    expect(c.extra).toBe("Met at expo, hall 4");
  });
  it("falls back to N when FN is missing", () => {
    const c = parseVCard("BEGIN:VCARD\r\nN:Doe;Jane;;;\r\nTEL:1\r\nEND:VCARD")!;
    expect(c.full_name).toBe("Jane Doe");
  });
  it("unfolds continuation lines", () => {
    const folded = "BEGIN:VCARD\r\nFN:Jane\r\n  Doe\r\nTEL:1\r\nEND:VCARD";
    expect(parseVCard(folded)!.full_name).toBe("Jane Doe");
  });
  it("rejects non-vcards and empty vcards", () => {
    expect(parseVCard("hello")).toBeNull();
    expect(parseVCard("BEGIN:VCARD\r\nVERSION:3.0\r\nEND:VCARD")).toBeNull();
  });
});

describe("parseMeCard", () => {
  it("reads MECARD fields and reverses the name", () => {
    const c = parseMeCard("MECARD:N:Doe,John;TEL:+15550101;EMAIL:j@d.co;ORG:Acme;;")!;
    expect(c.full_name).toBe("John Doe");
    expect(c.phone).toBe("+15550101");
    expect(c.email).toBe("j@d.co");
    expect(c.company).toBe("Acme");
  });
  it("rejects other text", () => {
    expect(parseMeCard("https://x.com")).toBeNull();
  });
});

describe("nameFromLinkedInSlug", () => {
  it("prettifies slugs and drops id fragments", () => {
    expect(nameFromLinkedInSlug("jane-a-doe-1b2c3d")).toBe("Jane A Doe");
    expect(nameFromLinkedInSlug("johndoe")).toBe("Johndoe");
  });
});

describe("decodeQrText", () => {
  it("classifies vCards, LinkedIn URLs, other URLs and plain text", () => {
    expect(decodeQrText(VCARD).type).toBe("contact");
    const li = decodeQrText("https://www.linkedin.com/in/jane-doe-123?utm=x");
    expect(li.type).toBe("linkedin");
    if (li.type === "linkedin") {
      expect(li.contact.full_name).toBe("Jane Doe");
      expect(li.url).toBe("https://www.linkedin.com/in/jane-doe-123");
    }
    expect(decodeQrText("https://example.com").type).toBe("url");
    expect(decodeQrText("WIFI:S:x;;").type).toBe("other");
  });
});

function sc(p: Partial<ScannedContact>): ScannedContact {
  return {
    full_name: "",
    job_title: null,
    company: null,
    email: null,
    phone: null,
    website: null,
    extra: null,
    source_image_index: 0,
    headshot_box: null,
    ...p,
  };
}

describe("mergeScannedContacts", () => {
  it("merges the same person by email, QR fields winning", () => {
    const ai = [
      sc({
        full_name: "Jane Do",
        email: "jane@acme.com",
        company: "Acme",
        headshot_box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
        source_image_index: 1,
      }),
    ];
    const qr = [sc({ full_name: "Jane Doe", email: "JANE@acme.com", phone: "+1555" })];
    const out = mergeScannedContacts(ai, qr);
    expect(out).toHaveLength(1);
    expect(out[0]!.full_name).toBe("Jane Doe");
    expect(out[0]!.company).toBe("Acme");
    expect(out[0]!.phone).toBe("+1555");
    expect(out[0]!.headshot_box).not.toBeNull();
    expect(out[0]!.source_image_index).toBe(1);
  });
  it("keeps distinct people from both sources", () => {
    const out = mergeScannedContacts(
      [sc({ full_name: "A", email: "a@x.co" })],
      [sc({ full_name: "B", email: "b@x.co" })],
    );
    expect(out.map((c) => c.full_name).sort()).toEqual(["A", "B"]);
  });
  it("matches by normalized phone when there is no email", () => {
    const out = mergeScannedContacts(
      [sc({ full_name: "A", phone: "(555) 010-0" })],
      [sc({ full_name: "A2", phone: "+5550100" })],
    );
    expect(out).toHaveLength(2); // "+..." vs "..." differ once normalized — stays separate
    const out2 = mergeScannedContacts(
      [sc({ full_name: "A", phone: "555 0100" })],
      [sc({ full_name: "A2", phone: "5550100" })],
    );
    expect(out2).toHaveLength(1);
  });
});
