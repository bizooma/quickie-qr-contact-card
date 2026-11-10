import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression: a reserved allowance must be given back when an AI action fails
// for any reason (AI outage, missing contact/note), not only on handled refusals.

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  parse: vi.fn(),
  reserveUsage: vi.fn(),
  contactLookup: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      middleware: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
  createMiddleware: () => ({ middleware: () => ({ server: () => ({}) }) }),
}));
vi.mock("@/lib/auth-guard", () => ({ requireActiveAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: mocks.rpc, from: vi.fn() },
}));
vi.mock("./usage.server", async (importActual) => ({
  ...(await importActual<typeof import("./usage.server")>()),
  reserveUsage: mocks.reserveUsage,
  logAiCall: vi.fn(),
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { parse: mocks.parse };
  },
}));
vi.mock("@anthropic-ai/sdk/helpers/zod", () => ({ zodOutputFormat: () => ({}) }));

import { draftFollowUp, enrichContact, scanCards, summarizeNote } from "./ai.functions";

type Handler = (args: { data: unknown; context: unknown }) => Promise<unknown>;
const call = (fn: unknown, data: unknown, context: unknown) => (fn as Handler)({ data, context });

const ID = "00000000-0000-4000-8000-000000000001";

/** Chainable RLS client stub: every query resolves to `result`. */
function supabaseReturning(result: () => unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) q[m] = () => q;
  q["maybeSingle"] = async () => result();
  q["then"] = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
  return { from: () => q };
}

function settleCalls() {
  return mocks.rpc.mock.calls.filter(([name]) => name === "settle_ai_usage").map(([, a]) => a);
}

describe("AI actions give back reserved usage when they fail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["ANTHROPIC_API_KEY"] = "test";
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.reserveUsage.mockImplementation(async (_u: string, kind: string, units = 1) => ({
      id: "res-1",
      kind,
      limit: Infinity,
      usedBefore: 0,
      units,
    }));
  });

  it("scan: an AI service error releases all reserved scans", async () => {
    mocks.parse.mockRejectedValue(new Error("529 overloaded"));
    await expect(
      call(
        scanCards,
        { images: [{ data: "x", media_type: "image/jpeg" }] },
        { userId: "u1", supabase: supabaseReturning(() => ({ data: null, error: null })) },
      ),
    ).rejects.toThrow("529 overloaded");
    expect(settleCalls()).toEqual([{ _reservation: "res-1", _actual: 0 }]);
  });

  it("follow-up: a missing contact releases the reserved draft", async () => {
    await expect(
      call(
        draftFollowUp,
        { contactId: ID },
        { userId: "u1", supabase: supabaseReturning(() => ({ data: null, error: null })) },
      ),
    ).rejects.toThrow("Contact not found");
    expect(settleCalls()).toEqual([{ _reservation: "res-1", _actual: 0 }]);
    expect(mocks.parse).not.toHaveBeenCalled();
  });

  it("enrich: a contact without company or email releases the reservation", async () => {
    mocks.contactLookup.mockReturnValue({
      data: { full_name: "Ann", email: null, company: null },
      error: null,
    });
    await expect(
      call(
        enrichContact,
        { contactId: ID },
        { userId: "u1", supabase: supabaseReturning(mocks.contactLookup) },
      ),
    ).rejects.toThrow("Add a company or an email");
    expect(settleCalls()).toEqual([{ _reservation: "res-1", _actual: 0 }]);
  });

  it("summarize: a timeout from the AI service releases the reservation", async () => {
    mocks.parse.mockRejectedValue(new Error("Request timed out"));
    await expect(
      call(
        summarizeNote,
        { noteId: ID },
        {
          userId: "u1",
          supabase: supabaseReturning(() => ({ data: { body: "note" }, error: null })),
        },
      ),
    ).rejects.toThrow("Request timed out");
    expect(settleCalls()).toEqual([{ _reservation: "res-1", _actual: 0 }]);
  });

  it("summarize: a successful call keeps exactly one unit", async () => {
    mocks.parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: { key_points: ["a"], next_steps: [] },
    });
    await call(
      summarizeNote,
      { noteId: ID },
      {
        userId: "u1",
        supabase: supabaseReturning(() => ({ data: { body: "note" }, error: null })),
      },
    );
    expect(settleCalls()).toEqual([{ _reservation: "res-1", _actual: 1 }]);
  });
});
