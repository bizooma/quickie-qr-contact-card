import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: new Headers(),
  rpc: vi.fn(),
  setHeader: vi.fn(),
  from: vi.fn(),
  getPlan: vi.fn(),
  sendPush: vi.fn(),
  webhook: vi.fn(),
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

vi.mock("./usage.server", () => ({ getPlan: mocks.getPlan }));
vi.mock("./notify.server", () => ({
  sendPushToUser: mocks.sendPush,
  postContactWebhook: mocks.webhook,
}));

import { sharebackErrorMessage, submitShareback } from "./capture.functions";

/** The card row submitShareback reads before it saves anything. */
function cardRow(card: unknown) {
  mocks.from.mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: card }) }) }),
  });
}
const OWNER_CARD = { user_id: "owner-1", label: "Work", full_name: "Sam Lee", exchange: null };

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
    cardRow(null);
    mocks.getPlan.mockResolvedValue("free");
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
    cardRow(OWNER_CARD);
    mocks.getPlan.mockResolvedValue("pro");
    mocks.setHeader.mockResolvedValue({ error: { message: "private database detail" } });
    await expect(submitShareback({ data: input })).rejects.toThrow(
      "Couldn't send your details. Please try again.",
    );
    expect(mocks.sendPush).not.toHaveBeenCalled();
    expect(mocks.webhook).not.toHaveBeenCalled();
  });
});

describe("the owner's own share-back form", () => {
  const exchange = {
    form: {
      require: "both",
      company: false,
      note: true,
      questions: [{ label: "What are you working on?", required: true }, { label: "Budget" }],
    },
  };
  const filled = { ...input, phone: "555 0100", company: "Acme", note: "Met at the expo" };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers = new Headers();
    mocks.rpc.mockReturnValue({ setHeader: mocks.setHeader });
    mocks.setHeader.mockResolvedValue({ error: null });
    cardRow({ ...OWNER_CARD, exchange });
    mocks.getPlan.mockResolvedValue("pro");
  });

  it("refuses a submission that breaks the owner's rules, before anything is saved", async () => {
    await expect(submitShareback({ data: { ...input, answers: ["A CRM"] } })).rejects.toThrow(
      "Add your email and phone number so Sam can reach you.",
    );
    await expect(submitShareback({ data: { ...filled, answers: ["  "] } })).rejects.toThrow(
      'Please answer "What are you working on?".',
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("folds answers into the note and drops a field the owner turned off", async () => {
    await submitShareback({ data: { ...filled, answers: ["A CRM", "10k"] } });
    const note = "What are you working on? A CRM\nBudget: 10k\n\nMet at the expo";
    expect(mocks.rpc).toHaveBeenCalledWith(
      "submit_shareback",
      expect.objectContaining({ _company: "", _note: note }),
    );
    expect(mocks.webhook).toHaveBeenCalledWith("owner-1", [
      expect.objectContaining({ company: null, note }),
    ]);
  });

  it("ignores the form, and any answers, when the owner is on the free plan", async () => {
    mocks.getPlan.mockResolvedValue("free");
    await submitShareback({ data: { ...input, answers: ["A CRM"] } });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "submit_shareback",
      expect.objectContaining({ _company: "", _note: "" }),
    );
    expect(mocks.sendPush).not.toHaveBeenCalled();
  });

  it("ignores answers on a card with no form of its own", async () => {
    cardRow(OWNER_CARD);
    await submitShareback({ data: { ...filled, answers: ["A CRM"] } });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "submit_shareback",
      expect.objectContaining({ _company: "Acme", _note: "Met at the expo" }),
    );
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
