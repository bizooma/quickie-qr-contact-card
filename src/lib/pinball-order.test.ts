import { describe, expect, it } from "vitest";
import {
  bearerMatches,
  entitlementsForItems,
  isTestOrder,
  normalizeEmail,
  parsePinballOrder,
  parsePinballRefund,
  signPinballBody,
  verifyPinballSignature,
  type PinballPayload,
} from "./pinball-order";

const LIFETIME_ID = "01m4gpdvhfqcsjj4m8re40t8r9";
const YEAR_ID = "01m4gpdx4b8ar3641cm3fwa3rd";

function payload(overrides: Partial<NonNullable<PinballPayload["data"]>> = {}): PinballPayload {
  return {
    event: "ck.app.lifetime",
    data: {
      order: { id: "ord_1", order_number: 42, status: "completed", total_amount: 5500 },
      customer: { email: "Buyer@Example.COM ", name: "Buyer" },
      items: [{ product_id: LIFETIME_ID, amount: 5500 }],
      ...overrides,
    },
  };
}

describe("entitlementsForItems", () => {
  it("maps only allowlisted products", () => {
    expect(
      entitlementsForItems([
        { product_id: LIFETIME_ID },
        { product_id: "01m4gpdrbtr88tr7yfd6myt22w" }, // $7 front end — starter pack
        { product_id: YEAR_ID },
        { product_id: "01m4hts98nyxs8k0cmw7gt10f5" }, // course bump — no app entitlement
      ]),
    ).toEqual(["lifetime", "starter", "year"]);
  });
  it("dedupes and handles empty", () => {
    expect(entitlementsForItems([{ product_id: YEAR_ID }, { product_id: YEAR_ID }])).toEqual([
      "year",
    ]);
    expect(entitlementsForItems(undefined)).toEqual([]);
  });
});

describe("parsePinballOrder", () => {
  it("parses a completed lifetime order", () => {
    const r = parsePinballOrder(payload());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.order.email).toBe("buyer@example.com");
    expect(r.order.entitlements).toEqual(["lifetime"]);
    expect(r.order.completed).toBe(true);
    expect(r.order.isTest).toBe(false);
  });
  it("rejects missing order id and missing email", () => {
    expect(parsePinballOrder({}).ok).toBe(false);
    expect(parsePinballOrder(payload({ customer: { email: "" } })).ok).toBe(false);
  });
  it("flags test-mode intents", () => {
    const p = payload({
      order: {
        id: "ord_2",
        status: "completed",
        payment_intent_id: "test_mode_abc",
        total_amount: 5500,
      },
    });
    expect(isTestOrder(p)).toBe(true);
    const r = parsePinballOrder(p);
    expect(r.ok && r.order.isTest).toBe(true);
  });
  it("marks incomplete orders", () => {
    const r = parsePinballOrder(
      payload({ order: { id: "ord_3", status: "pending", total_amount: 5500 } }),
    );
    expect(r.ok && !r.order.completed).toBe(true);
  });
});

describe("signature", () => {
  it("round-trips sign/verify and rejects tampering", async () => {
    const body = JSON.stringify(payload());
    const sig = await signPinballBody(body, "s3cret");
    expect(await verifyPinballSignature(body, sig, "s3cret")).toBe(true);
    expect(await verifyPinballSignature(body, sig.toUpperCase(), "s3cret")).toBe(true);
    expect(await verifyPinballSignature(body + " ", sig, "s3cret")).toBe(false);
    expect(await verifyPinballSignature(body, sig, "other")).toBe(false);
    expect(await verifyPinballSignature(body, null, "s3cret")).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  A@B.Co ")).toBe("a@b.co");
    expect(normalizeEmail(null)).toBe("");
  });
});

describe("parsePinballRefund", () => {
  it("maps a refunded app product to its entitlement", () => {
    expect(
      parsePinballRefund({
        event: "refund_issued",
        order_id: "ord_9",
        product_id: LIFETIME_ID,
        refunded_amount: 7500,
        email: " Buyer@Example.com",
      }),
    ).toEqual({
      ok: true,
      refund: { orderId: "ord_9", kind: "lifetime", email: "buyer@example.com" },
    });
  });
  it("falls back to the email when Pinball has no order id", () => {
    const r = parsePinballRefund({
      event: "refund_issued",
      order_id: null,
      product_id: YEAR_ID,
      email: "a@b.co",
    });
    expect(r).toEqual({ ok: true, refund: { orderId: null, kind: "year", email: "a@b.co" } });
  });
  it("ignores other products, other events and unusable payloads", () => {
    expect(
      parsePinballRefund({
        event: "refund_issued",
        product_id: "01m4hts98nyxs8k0cmw7gt10f5",
        email: "a@b.co",
      }).ok,
    ).toBe(false);
    expect(parsePinballRefund({ event: "purchase", product_id: YEAR_ID, email: "a@b.co" }).ok).toBe(
      false,
    );
    expect(parsePinballRefund({ event: "refund_issued", product_id: YEAR_ID }).ok).toBe(false);
  });
});

describe("bearerMatches", () => {
  it("accepts only the exact secret", () => {
    expect(bearerMatches("Bearer s3cret", "s3cret")).toBe(true);
    expect(bearerMatches("bearer  s3cret ", "s3cret")).toBe(true);
    expect(bearerMatches("Bearer s3cre", "s3cret")).toBe(false);
    expect(bearerMatches(null, "s3cret")).toBe(false);
    expect(bearerMatches("Bearer ", "")).toBe(false);
  });
});
