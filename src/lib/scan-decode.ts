// Pure parsing for QR codes found in scanned photos: vCard, MECARD, and
// LinkedIn profile URLs all become scanner results without an AI round-trip.
// Browser-side QR detection lives in qr-decode.ts; this file is unit-testable.

import type { ScannedContact } from "./ai-model";

/** Unfold RFC 2425 continuation lines and split a vCard/MECARD blob. */
function vcardLines(text: string): string[] {
  return text
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
    .split(/\r?\n/)
    .filter(Boolean);
}

function unescapeVcard(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

/** Minimal vCard reader: the fields our contacts can hold. */
export function parseVCard(text: string): ScannedContact | null {
  if (!/BEGIN:VCARD/i.test(text)) return null;
  const out: Record<string, string> = {};
  const extras: string[] = [];
  for (const line of vcardLines(text)) {
    const m = line.match(/^([^:;]+)(;[^:]*)?:(.*)$/);
    if (!m) continue;
    const key = (m[1] ?? "").toUpperCase();
    const value = unescapeVcard((m[3] ?? "").trim());
    if (!value) continue;
    switch (key) {
      case "FN":
        out["name"] = out["name"] || value;
        break;
      case "N": {
        if (!out["name"]) {
          const [last = "", first = ""] = value.split(";");
          out["name"] = [first, last].filter(Boolean).join(" ").trim();
        }
        break;
      }
      case "ORG":
        out["company"] = out["company"] || value.split(";")[0] || "";
        break;
      case "TITLE":
        out["title"] = out["title"] || value;
        break;
      case "TEL":
        out["phone"] = out["phone"] || value;
        break;
      case "EMAIL":
        out["email"] = out["email"] || value;
        break;
      case "URL":
        out["website"] = out["website"] || value;
        break;
      case "NOTE":
        extras.push(value);
        break;
      case "ADR": {
        const addr = value.split(";").filter(Boolean).join(", ");
        if (addr) extras.push(addr);
        break;
      }
      default:
        break;
    }
  }
  if (!out["name"] && !out["email"] && !out["phone"]) return null;
  return {
    full_name: out["name"] ?? "",
    job_title: out["title"] ?? null,
    company: out["company"] ?? null,
    email: out["email"] ?? null,
    phone: out["phone"] ?? null,
    website: out["website"] ?? null,
    extra: extras.length ? extras.join("\n") : null,
    source_image_index: 0,
    headshot_box: null,
  };
}

/** MECARD:N:Doe,John;TEL:...;EMAIL:...;; — the compact phone-contact QR format. */
export function parseMeCard(text: string): ScannedContact | null {
  const m = text.match(/^MECARD:(.*)$/is);
  if (!m) return null;
  const out: Record<string, string> = {};
  for (const part of (m[1] ?? "").split(/(?<!\\);/)) {
    const kv = part.match(/^([A-Z]+):(.*)$/s);
    if (!kv) continue;
    const value = (kv[2] ?? "").replace(/\\(.)/g, "$1").trim();
    if (!value) continue;
    switch ((kv[1] ?? "").toUpperCase()) {
      case "N":
        out["name"] = value.split(",").reverse().filter(Boolean).join(" ").trim();
        break;
      case "TEL":
        out["phone"] = out["phone"] || value;
        break;
      case "EMAIL":
        out["email"] = out["email"] || value;
        break;
      case "ORG":
        out["company"] = value;
        break;
      case "URL":
        out["website"] = value;
        break;
      case "NOTE":
        out["note"] = value;
        break;
      default:
        break;
    }
  }
  if (!out["name"] && !out["email"] && !out["phone"]) return null;
  return {
    full_name: out["name"] ?? "",
    job_title: null,
    company: out["company"] ?? null,
    email: out["email"] ?? null,
    phone: out["phone"] ?? null,
    website: out["website"] ?? null,
    extra: out["note"] ?? null,
    source_image_index: 0,
    headshot_box: null,
  };
}

/** "jane-a-doe-1b2c3" → "Jane A Doe" (ids and numbers dropped). */
export function nameFromLinkedInSlug(slug: string): string {
  return slug
    .split("-")
    .filter((p) => p && !/\d/.test(p))
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export type DecodedQr =
  | { type: "contact"; contact: ScannedContact }
  | { type: "linkedin"; contact: ScannedContact; url: string }
  | { type: "url"; url: string }
  | { type: "other"; text: string };

/** Classify raw QR text into something the scanner can use. */
export function decodeQrText(text: string): DecodedQr {
  const t = text.trim();
  const vcard = parseVCard(t);
  if (vcard) return { type: "contact", contact: vcard };
  const mecard = parseMeCard(t);
  if (mecard) return { type: "contact", contact: mecard };
  const li = t.match(/^https?:\/\/(?:www\.)?linkedin\.com\/in\/([^/?#]+)/i);
  if (li) {
    const url = t.split(/[?#]/)[0] ?? t;
    return {
      type: "linkedin",
      url,
      contact: {
        full_name: nameFromLinkedInSlug(decodeURIComponent(li[1] ?? "")),
        job_title: null,
        company: null,
        email: null,
        phone: null,
        website: null,
        extra: `LinkedIn: ${url}`,
        source_image_index: 0,
        headshot_box: null,
      },
    };
  }
  if (/^https?:\/\//i.test(t)) return { type: "url", url: t };
  return { type: "other", text: t };
}

function normKey(c: Pick<ScannedContact, "email" | "phone">): string | null {
  const email = c.email?.trim().toLowerCase();
  if (email) return `e:${email}`;
  const phone = c.phone?.replace(/[^\d+]/g, "");
  if (phone) return `p:${phone}`;
  return null;
}

/**
 * Merge AI-extracted contacts with QR-decoded ones. When both describe the
 * same person (same email or phone), QR fields win — they're machine-exact —
 * and the AI entry contributes whatever the QR lacked (headshot box included).
 */
export function mergeScannedContacts(ai: ScannedContact[], qr: ScannedContact[]): ScannedContact[] {
  const out: ScannedContact[] = [];
  const aiByKey = new Map<string, ScannedContact>();
  for (const c of ai) {
    const k = normKey(c);
    if (k && !aiByKey.has(k)) aiByKey.set(k, c);
  }
  const usedAi = new Set<ScannedContact>();
  for (const q of qr) {
    const k = normKey(q);
    const match = k ? aiByKey.get(k) : undefined;
    if (match) {
      usedAi.add(match);
      out.push({
        full_name: q.full_name || match.full_name,
        job_title: q.job_title ?? match.job_title,
        company: q.company ?? match.company,
        email: q.email ?? match.email,
        phone: q.phone ?? match.phone,
        website: q.website ?? match.website,
        extra: [q.extra, match.extra].filter(Boolean).join("\n") || null,
        source_image_index: match.source_image_index,
        headshot_box: match.headshot_box,
      });
    } else {
      out.push(q);
    }
  }
  for (const c of ai) if (!usedAi.has(c)) out.push(c);
  return out;
}
