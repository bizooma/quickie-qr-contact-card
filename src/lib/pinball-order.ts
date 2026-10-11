// Pinball funnel webhooks → app entitlements. Pure helpers, unit-tested.
//
// Pinball's `send_webhook` completion action POSTs JSON and signs it:
//   x-pinball-signature: hex HMAC-SHA256 of the raw request body, keyed with
//                        the secret set on the action.
//   x-pinball-event:     the event name set on the action.
//   x-pinball-delivery:  `<order id>-<random>`, one per delivery attempt.
// Body: { event, timestamp, data: { order, customer, items } }.
// Test-mode orders carry a `test_mode_…` payment intent id.

export type EntitlementKind = "lifetime" | "year";

/** Entitlement granted per Pinball product. The webhook NEVER trusts the
 *  payload for what was bought beyond these allowlisted product ids. */
export const ENTITLEMENT_BY_PINBALL_PRODUCT: Readonly<Record<string, EntitlementKind>> = {
  // "ContactKickstart App — Founding Lifetime" ($55 LTD upsell)
  "01m4gpdvhfqcsjj4m8re40t8r9": "lifetime",
  // "ContactKickstart App — Founding Year" (downsell)
  "01m4gpdx4b8ar3641cm3fwa3rd": "year",
};

export interface PinballItem {
  product_id?: string;
  product_name?: string;
  type?: string;
  amount?: number;
  payment_intent_id?: string | null;
}

export interface PinballPayload {
  event?: string;
  timestamp?: string;
  data?: {
    order?: {
      id?: string;
      order_number?: number;
      status?: string;
      payment_intent_id?: string | null;
      total_amount?: number;
      currency?: string;
    };
    customer?: { id?: string; email?: string | null; name?: string | null };
    items?: PinballItem[];
  };
}

export interface ParsedPinballOrder {
  orderId: string;
  orderNumber: number | null;
  event: string;
  email: string;
  entitlements: EntitlementKind[];
  amountCents: number;
  isTest: boolean;
  completed: boolean;
}

export type ParseResult = { ok: true; order: ParsedPinballOrder } | { ok: false; reason: string };

const TEST_INTENT = /^test_mode_/;

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** Entitlements an order earns, from its items and the allowlist only. */
export function entitlementsForItems(
  items: PinballItem[] | undefined,
  map: Readonly<Record<string, EntitlementKind>> = ENTITLEMENT_BY_PINBALL_PRODUCT,
): EntitlementKind[] {
  const out: EntitlementKind[] = [];
  for (const item of items ?? []) {
    const kind = item.product_id ? map[item.product_id] : undefined;
    if (kind && !out.includes(kind)) out.push(kind);
  }
  return out;
}

/** True for a Pinball test-mode order (no real money moved). */
export function isTestOrder(payload: PinballPayload): boolean {
  const intents = [
    payload.data?.order?.payment_intent_id,
    ...(payload.data?.items ?? []).map((i) => i.payment_intent_id),
  ];
  return intents.some((id) => typeof id === "string" && TEST_INTENT.test(id));
}

export function parsePinballOrder(payload: PinballPayload): ParseResult {
  const order = payload.data?.order;
  if (!order?.id) return { ok: false, reason: "missing order id" };
  const email = normalizeEmail(payload.data?.customer?.email);
  if (!email || !email.includes("@")) return { ok: false, reason: "missing customer email" };
  return {
    ok: true,
    order: {
      orderId: order.id,
      orderNumber: typeof order.order_number === "number" ? order.order_number : null,
      event: payload.event ?? "funnel.step.completed",
      email,
      entitlements: entitlementsForItems(payload.data?.items),
      amountCents: typeof order.total_amount === "number" ? order.total_amount : 0,
      isTest: isTestOrder(payload),
      completed: order.status === "completed",
    },
  };
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two hex strings. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Hex HMAC-SHA256 of the raw body, as Pinball computes it. */
export async function signPinballBody(rawBody: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(rawBody)));
}

/** Verify `x-pinball-signature` against the raw body. */
export async function verifyPinballSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;
  const expected = await signPinballBody(rawBody, secret);
  return timingSafeEqual(expected, signature.trim().toLowerCase());
}
