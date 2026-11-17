// Server-only: signs and zips an Apple Wallet pass (.pkpass).
//
// A .pkpass is a zip of pass.json, its images, manifest.json (SHA-1 of every
// file) and "signature": a detached PKCS#7 signature of manifest.json made with
// the Pass Type ID certificate, carrying Apple's WWDR intermediate. node-forge
// and fflate are pure JS, so this runs on Cloudflare Workers (no Node fs or
// child processes, which the usual passkit libraries need).
//
// Secrets (Lovable Cloud): APPLE_PASS_CERT = the .p12 export, base64;
// APPLE_PASS_KEY_PASSWORD = its export password. The Pass Type ID and Team ID
// are read from the certificate itself (APPLE_PASS_TYPE_ID / APPLE_TEAM_ID are
// only checked against it), so they can't drift apart.

import forge from "node-forge";
import { zipSync } from "fflate";
import { BRAND_ICON_PNGS, WWDR_PEMS } from "./assets";
import type { PassIdentity } from "./apple-pass";

// OIDs spelled out (forge types them as an index signature).
const OID = {
  keyBag: "1.2.840.113549.1.12.10.1.1",
  shroudedKeyBag: "1.2.840.113549.1.12.10.1.2",
  certBag: "1.2.840.113549.1.12.10.1.3",
  sha256: "2.16.840.1.101.3.4.2.1",
  data: "1.2.840.113549.1.7.1",
  contentType: "1.2.840.113549.1.9.3",
  messageDigest: "1.2.840.113549.1.9.4",
  signingTime: "1.2.840.113549.1.9.5",
  uid: "0.9.2342.19200300.100.1.1",
};

type Signer = PassIdentity & {
  key: forge.pki.rsa.PrivateKey;
  cert: forge.pki.Certificate;
  wwdr: forge.pki.Certificate;
  expires: Date;
};

const bytesToBinary = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return s;
};

// Workers expose only part of node:crypto, and forge picks it up at import
// when it sees Node. Keep forge on its own JS (a few thousand PBKDF2 rounds,
// no key generation) and seed its random generator (used to blind the RSA
// signature) from Web Crypto, which Workers have.
(forge as unknown as { options: { usePureJavaScript: boolean } }).options.usePureJavaScript = true;
(forge.random as unknown as { seedFileSync: (n: number) => string }).seedFileSync = (n) => {
  const bytes = new Uint8Array(n);
  for (let i = 0; i < n; i += 65536) crypto.getRandomValues(bytes.subarray(i, i + 65536));
  return bytesToBinary(bytes);
};

let cached: Signer | null = null;

/** True when the Apple secrets are set (the Wallet button shows only then). */
export function appleWalletConfigured(): boolean {
  return !!process.env["APPLE_PASS_CERT"]?.trim();
}

function attr(cert: forge.pki.Certificate, shortName: string, oid?: string): string {
  const a = cert.subject.attributes.find(
    (x) => x.shortName === shortName || (oid && x.type === oid),
  );
  return typeof a?.value === "string" ? a.value : "";
}

/** Reads the certificate and key from the secrets once per worker. Throws a
 *  plain-English error when they are set but unusable. */
export function loadAppleSigner(): Signer {
  if (cached) return cached;
  const b64 = (process.env["APPLE_PASS_CERT"] ?? "").replace(/\s+/g, "");
  if (!b64) throw new Error("Apple Wallet isn't set up yet.");
  const password = process.env["APPLE_PASS_KEY_PASSWORD"] ?? "";

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.decode64(b64)), password);
  } catch {
    throw new Error(
      "APPLE_PASS_CERT couldn't be opened. Check it's the base64 of the .p12 and that APPLE_PASS_KEY_PASSWORD is its export password.",
    );
  }
  const bags = (type: string): forge.pkcs12.Bag[] => p12.getBags({ bagType: type })[type] ?? [];
  const key = (bags(OID.shroudedKeyBag)[0]?.key ?? bags(OID.keyBag)[0]?.key) as
    forge.pki.rsa.PrivateKey | undefined;
  // The pass certificate is the one whose subject carries the Pass Type ID.
  const cert = bags(OID.certBag)
    .map((b) => b.cert)
    .find((c): c is forge.pki.Certificate => !!c && attr(c, "UID", OID.uid).startsWith("pass."));
  if (!key || !cert)
    throw new Error(
      "The .p12 needs both the Pass Type ID certificate and its private key. Export it from Keychain's login > My Certificates.",
    );

  const passTypeIdentifier = attr(cert, "UID", OID.uid);
  const teamIdentifier = attr(cert, "OU");
  const wantType = process.env["APPLE_PASS_TYPE_ID"]?.trim();
  const wantTeam = process.env["APPLE_TEAM_ID"]?.trim();
  if (wantType && wantType !== passTypeIdentifier)
    throw new Error(
      `The certificate is for ${passTypeIdentifier}, but APPLE_PASS_TYPE_ID is ${wantType}.`,
    );
  if (wantTeam && wantTeam !== teamIdentifier)
    throw new Error(
      `The certificate is for team ${teamIdentifier}, but APPLE_TEAM_ID is ${wantTeam}.`,
    );

  const issuerOu = cert.issuer.attributes.find(
    (a: forge.pki.CertificateField) => a.shortName === "OU",
  )?.value;
  const wwdrPem = typeof issuerOu === "string" ? WWDR_PEMS[issuerOu] : undefined;
  if (!wwdrPem)
    throw new Error(`Unknown Apple intermediate (${String(issuerOu)}) for this certificate.`);

  cached = {
    key,
    cert,
    wwdr: forge.pki.certificateFromPem(wwdrPem),
    passTypeIdentifier,
    teamIdentifier,
    expires: cert.validity.notAfter,
  };
  return cached;
}

async function sha1Hex(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-1", bytes as Uint8Array<ArrayBuffer>));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const binaryToBytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const b64ToBytes = (b64: string) => binaryToBytes(atob(b64));

/** Detached PKCS#7 signature of the manifest (what Wallet checks). */
export function signManifest(manifest: Uint8Array, signer: Signer): Uint8Array {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(bytesToBinary(manifest));
  p7.addCertificate(signer.cert);
  p7.addCertificate(signer.wwdr);
  p7.addSigner({
    key: signer.key,
    certificate: signer.cert,
    digestAlgorithm: OID.sha256,
    authenticatedAttributes: [
      { type: OID.contentType, value: OID.data },
      { type: OID.messageDigest },
      // No value: forge stamps the current time.
      { type: OID.signingTime },
    ],
  });
  p7.sign({ detached: true });
  return binaryToBytes(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

/** Builds the .pkpass: pass.json, the QuickieQR icon, any extra images
 *  (logo, thumbnail; PNG bytes keyed by file name), manifest and signature. */
export async function buildPkpass(
  passJson: object,
  images: Record<string, Uint8Array>,
  signer: Signer = loadAppleSigner(),
): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {
    "pass.json": new TextEncoder().encode(JSON.stringify(passJson)),
  };
  for (const [name, b64] of Object.entries(BRAND_ICON_PNGS)) files[name] = b64ToBytes(b64);
  Object.assign(files, images);

  const manifest: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) manifest[name] = await sha1Hex(bytes);
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));

  const all = {
    ...files,
    "manifest.json": manifestBytes,
    signature: signManifest(manifestBytes, signer),
  };
  // Copy into this realm's Uint8Array: fflate tells files from folders with
  // instanceof, and a TextEncoder result can come from another realm.
  return zipSync(Object.fromEntries(Object.entries(all).map(([k, v]) => [k, new Uint8Array(v)])), {
    level: 6,
  });
}
