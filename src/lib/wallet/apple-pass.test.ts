import { describe, expect, it } from "vitest";
import forge from "node-forge";
import { unzipSync } from "fflate";
import { buildPassJson, hexToRgb, passColors, passShowsPhoto, type PassCard } from "./apple-pass";

const ID = { passTypeIdentifier: "pass.com.quickieqr.card", teamIdentifier: "TEAM123456" };

const card: PassCard = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "jane-doe",
  label: "Work",
  full_name: "Jane Doe",
  job_title: "Partner",
  company: "Doe Law",
  phones: [{ label: "Mobile", value: "+1 555 0100" }],
  emails: [{ label: "Work", value: "jane@doelaw.com" }],
  website: "doelaw.com",
  location: "Jacksonville, FL",
  accent_color: "#0E1230",
  headshot_path: "u/photo.jpg",
  practice: null,
};

const lowProfile: PassCard = {
  ...card,
  full_name: "Maria Lopez",
  company: "The PLACE",
  practice: { kind: "nonprofit", lowProfile: true } as PassCard["practice"],
};

describe("buildPassJson", () => {
  it("puts the card link in the QR and one pass per card", () => {
    const p = buildPassJson(card, ID, { hasLogo: true });
    expect(p.barcodes[0]!.message).toBe("https://quickieqr.com/c/jane-doe");
    expect(p.barcodes[0]!.format).toBe("PKBarcodeFormatQR");
    expect(p.serialNumber).toBe(card.id);
    expect(p.passTypeIdentifier).toBe(ID.passTypeIdentifier);
    expect(p.teamIdentifier).toBe(ID.teamIdentifier);
  });

  it("shows name, title and company", () => {
    const p = buildPassJson(card, ID, { hasLogo: true });
    expect(p.generic.primaryFields[0]).toMatchObject({ label: "WORK", value: "Jane Doe" });
    expect(p.generic.secondaryFields[0]?.value).toBe("Partner");
    expect(p.generic.auxiliaryFields[0]?.value).toBe("Doe Law");
    expect(p).not.toHaveProperty("logoText");
  });

  it("writes the company in the logo spot when there's no logo image", () => {
    const p = buildPassJson(card, ID, { hasLogo: false });
    expect(p.logoText).toBe("Doe Law");
    expect(p.generic.auxiliaryFields).toEqual([]);
    expect(buildPassJson({ ...card, company: null }, ID, { hasLogo: false }).logoText).toBe(
      "QuickieQR",
    );
  });

  it("keeps the person off a low-profile pass", () => {
    const p = buildPassJson(lowProfile, ID, { hasLogo: false });
    const text = JSON.stringify(p);
    expect(text).not.toContain("Maria");
    expect(text).not.toContain("555");
    expect(text).not.toContain("jane@");
    expect(p.generic.primaryFields[0]?.value).toBe("The PLACE");
    expect(passShowsPhoto(lowProfile)).toBe(false);
    expect(passShowsPhoto(card)).toBe(true);
  });
});

describe("colors", () => {
  it("parses hex", () => {
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("0e1230")).toEqual([14, 18, 48]);
    expect(hexToRgb("nope")).toEqual([17, 17, 17]);
  });

  it("uses white text on dark cards and dark text on light ones", () => {
    expect(passColors("#0E1230").foregroundColor).toBe("rgb(255, 255, 255)");
    expect(passColors("#F5E663").foregroundColor).toBe("rgb(20, 22, 31)");
  });
});

/** A throwaway Pass Type ID certificate issued by a fake "G4" CA, as a .p12. */
function testP12(password: string) {
  const caKeys = forge.pki.rsa.generateKeyPair(1024);
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 30 * 86_400_000);
  cert.setSubject([
    { type: "0.9.2342.19200300.100.1.1", value: "pass.com.quickieqr.card" },
    { shortName: "CN", value: "Pass Type ID: pass.com.quickieqr.card" },
    { shortName: "OU", value: "TEAM123456" },
  ]);
  cert.setIssuer([
    { shortName: "CN", value: "Fake WWDR" },
    { shortName: "OU", value: "G4" },
  ]);
  cert.sign(caKeys.privateKey, forge.md.sha256.create());
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: "3des" });
  return forge.util.encode64(forge.asn1.toDer(asn1).getBytes());
}

describe("buildPkpass", () => {
  it("signs a pass Wallet can read", async () => {
    process.env["APPLE_PASS_CERT"] = testP12("pw");
    process.env["APPLE_PASS_KEY_PASSWORD"] = "pw";
    const { loadAppleSigner, buildPkpass } = await import("./apple-pass.server");
    const signer = loadAppleSigner();
    expect(signer.passTypeIdentifier).toBe("pass.com.quickieqr.card");
    expect(signer.teamIdentifier).toBe("TEAM123456");

    const zip = await buildPkpass(buildPassJson(card, signer, { hasLogo: false }), {
      "logo.png": new Uint8Array([1, 2, 3]),
    });
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(
      [
        "icon.png",
        "icon@2x.png",
        "icon@3x.png",
        "logo.png",
        "manifest.json",
        "pass.json",
        "signature",
      ].sort(),
    );

    // Every file is in the manifest with its SHA-1.
    const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"])) as Record<
      string,
      string
    >;
    for (const name of Object.keys(files).filter(
      (n) => n !== "manifest.json" && n !== "signature",
    )) {
      const md = forge.md.sha1.create();
      md.update(String.fromCharCode(...files[name]!));
      expect(manifest[name]).toBe(md.digest().toHex());
    }

    // The signature is PKCS#7 signed data carrying the pass cert and Apple's G4.
    const der = String.fromCharCode(...files["signature"]!);
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(der)) as forge.pkcs7.PkcsSignedData;
    const subjects = p7.certificates.map((c) => c.subject.getField("CN")?.value);
    expect(subjects).toContain("Pass Type ID: pass.com.quickieqr.card");
    expect(subjects).toContain("Apple Worldwide Developer Relations Certification Authority");
  });
});
