import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: new Headers(),
  rpc: vi.fn(),
  setHeader: vi.fn(),
  from: vi.fn(),
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
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeaders: () => mocks.headers }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: mocks.rpc, from: mocks.from },
}));

import { sharebackErrorMessage, submitShareback } from "./capture.functions";

const input = {
  slug: "test-card",
  name: "Test visitor",
  email: "test@example.com",
  phone: "",
  company: "",
  note: "",
};

describe("share-back request-scoped forwarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers = new Headers();
    mocks.rpc.mockReturnValue({ setHeader: mocks.setHeader });
    mocks.setHeader.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    });
  });

  it("keeps different visitors separate without reusing a previous request's IP", async () => {
    mocks.headers = new Headers({ "cf-connecting-ip": "203.0.113.1" });
    await submitShareback({ data: input });
    mocks.headers = new Headers({ "cf-connecting-ip": "203.0.113.2" });
    await submitShareback({ data: input });
    expect(mocks.setHeader.mock.calls).toEqual([
      ["x-contactkickstart-visitor-ip", "203.0.113.1"],
      ["x-contactkickstart-visitor-ip", "203.0.113.2"],
    ]);
    expect(mocks.rpc).toHaveBeenCalledWith("submit_shareback", {
      _slug: "test-card",
      _name: "Test visitor",
      _email: "test@example.com",
      _phone: "",
      _company: "",
      _note: "",
    });
  });

  it("explicitly sends empty identity when visitor headers are missing", async () => {
    await submitShareback({ data: input });
    expect(mocks.setHeader).toHaveBeenCalledWith("x-contactkickstart-visitor-ip", "");
  });

  it("still reports a generic error and skips notifications for rejected submissions", async () => {
    mocks.setHeader.mockResolvedValue({ error: { message: "private database detail" } });
    await expect(submitShareback({ data: input })).rejects.toThrow(
      "Couldn't send your details. Please try again.",
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
describe("sharebackErrorMessage", () => {
  it("turns the RPC's reasons into visitor-facing text", () => {
    expect(
      sharebackErrorMessage("Too many submissions for this card right now — try again soon"),
    ).toMatch(/lot of submissions/);
    expect(sharebackErrorMessage("card not found")).toBe("This card no longer exists.");
    expect(sharebackErrorMessage("email or phone required")).toMatch(/email or phone/);
    expect(sharebackErrorMessage("shareback closed")).toMatch(/save their contact instead/);
  });
  it("never leaks unexpected database errors", () => {
    expect(sharebackErrorMessage('relation "contacts" does not exist')).toBe(
      "Couldn't send your details. Please try again.",
    );
  });
});
