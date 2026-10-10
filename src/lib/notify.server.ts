// Server-only notification plumbing: Web Push (VAPID, RFC 8292) and the
// outbound contact webhook. Pushes are sent WITHOUT a payload on purpose —
// payload-less pushes need no RFC 8291 encryption, and the service worker
// shows a generic "new contact" notification. Keys are generated once with
// WebCrypto and kept in the service-role-only app_secrets table.
// Top-level import is safe only from other server-only modules.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const VAPID_SECRET_KEY = "vapid";
// Contact address the push service may use to reach the operator (RFC 8292).
const VAPID_SUBJECT = "mailto:support@contactkickstart.com";

type StoredVapid = { publicJwk: JsonWebKey; privateJwk: JsonWebKey };

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

/** Uncompressed P-256 point (0x04||x||y) in base64url — the applicationServerKey format. */
export function jwkToApplicationServerKey(publicJwk: JsonWebKey): string {
  const x = b64urlDecode(publicJwk.x ?? "");
  const y = b64urlDecode(publicJwk.y ?? "");
  const point = new Uint8Array(1 + x.length + y.length);
  point[0] = 0x04;
  point.set(x, 1);
  point.set(y, 1 + x.length);
  return b64url(point);
}

let cachedVapid: StoredVapid | null = null;

export async function getVapidKeys(): Promise<StoredVapid> {
  if (cachedVapid) return cachedVapid;
  const { data } = await supabaseAdmin
    .from("app_secrets")
    .select("value")
    .eq("key", VAPID_SECRET_KEY)
    .maybeSingle();
  if (data?.value) {
    cachedVapid = data.value as unknown as StoredVapid;
    return cachedVapid;
  }
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const stored: StoredVapid = {
    publicJwk: await crypto.subtle.exportKey("jwk", pair.publicKey),
    privateJwk: await crypto.subtle.exportKey("jwk", pair.privateKey),
  };
  // Another instance may have raced us; their keys win so subscriptions stay valid.
  const { error } = await supabaseAdmin
    .from("app_secrets")
    .insert({ key: VAPID_SECRET_KEY, value: stored as never });
  if (error) {
    const { data: again } = await supabaseAdmin
      .from("app_secrets")
      .select("value")
      .eq("key", VAPID_SECRET_KEY)
      .maybeSingle();
    if (again?.value) {
      cachedVapid = again.value as unknown as StoredVapid;
      return cachedVapid;
    }
    throw new Error(`Could not store VAPID keys: ${error.message}`);
  }
  cachedVapid = stored;
  return stored;
}

async function vapidAuthHeader(endpoint: string): Promise<string> {
  const { publicJwk, privateJwk } = await getVapidKeys();
  const aud = new URL(endpoint).origin;
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(
    enc.encode(
      JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT }),
    ),
  );
  const key = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(`${header}.${payload}`),
  );
  const jwt = `${header}.${payload}.${b64url(sig)}`;
  return `vapid t=${jwt}, k=${jwkToApplicationServerKey(publicJwk)}`;
}

/** Sends a payload-less push to every subscription the user has; prunes dead ones. */
export async function sendPushToUser(userId: string): Promise<void> {
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint")
    .eq("user_id", userId);
  if (!subs?.length) return;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        const res = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            TTL: "86400",
            Authorization: await vapidAuthHeader(sub.endpoint),
            "Content-Length": "0",
          },
        });
        if (res.status === 404 || res.status === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      } catch {
        // Push is best-effort; the in-app badge still shows the lead.
      }
    }),
  );
}

export type WebhookContact = {
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  note: string | null;
  source: string;
  card_label: string | null;
  created_at: string;
};

/** POSTs a new-contact event to the user's webhook URL, if one is configured. */
export async function postContactWebhook(
  userId: string,
  contacts: WebhookContact[],
): Promise<void> {
  if (!contacts.length) return;
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("webhook_url")
    .eq("id", userId)
    .maybeSingle();
  const url = prof?.webhook_url?.trim();
  if (
    !url ||
    !/^https:\/\//i.test(url) ||
    /^https:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url)
  )
    return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "contact.created", contacts }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best-effort delivery; the contact is already saved.
  }
}
