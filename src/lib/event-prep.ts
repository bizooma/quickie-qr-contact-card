// Event prep: the pre-event checklist, 20 openers and the goal sheet from
// the Event Prep Pack, kept in the app for use at the event itself.
// Pure and client-safe. The content itself lives on the server
// (event-prep-content.server.ts) and is only sent to paid accounts.

export type PrepContent = {
  checklist: {
    intro: string;
    sections: { id: string; title: string; items: { id: string; text: string }[] }[];
    closing: string;
  };
  openers: {
    intro: string;
    groups: { title: string; items: { n: number; text: string; note?: string }[] }[];
    rules: { title: string; text: string }[];
  };
  goalSheet: {
    intro: string;
    categories: { name: string; text: string }[];
    because: string;
    exitLine: string;
    after: string;
  };
};

export type PrepResult = { locked: true } | { locked: false; content: PrepContent };

export const MAX_STARRED = 3;

export type GoalSheet = {
  event: string;
  date: string;
  why: string;
  who: { role: string; because: string }[];
  names: { name: string; opener: string }[];
  target: string;
  scanSlot: string;
};

/** What one person has filled in for the event they're preparing for. Kept
 *  on the device, so it works with no signal. */
export type PrepState = { checked: string[]; starred: number[]; sheet: GoalSheet };

export function emptySheet(): GoalSheet {
  return {
    event: "",
    date: "",
    why: "",
    who: [0, 1, 2].map(() => ({ role: "", because: "" })),
    names: [0, 1].map(() => ({ name: "", opener: "" })),
    target: "",
    scanSlot: "",
  };
}

export function emptyState(): PrepState {
  return { checked: [], starred: [], sheet: emptySheet() };
}

const text = (v: unknown, max = 200): string => (typeof v === "string" ? v.slice(0, max) : "");

/** Rebuilds a saved state defensively: storage can hold anything (an older
 *  shape, a hand-edited value), and a bad value must never break the page. */
export function parseState(raw: unknown): PrepState {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const s = (r["sheet"] && typeof r["sheet"] === "object" ? r["sheet"] : {}) as Record<
    string,
    unknown
  >;
  const rows = <T>(v: unknown, n: number, make: (o: Record<string, unknown>) => T): T[] => {
    const list = Array.isArray(v) ? v : [];
    return Array.from({ length: n }, (_, i) =>
      make((list[i] && typeof list[i] === "object" ? list[i] : {}) as Record<string, unknown>),
    );
  };
  return {
    checked: Array.isArray(r["checked"])
      ? [...new Set(r["checked"].filter((x): x is string => typeof x === "string"))].slice(0, 100)
      : [],
    starred: Array.isArray(r["starred"])
      ? [...new Set(r["starred"].filter((x): x is number => Number.isInteger(x)))].slice(
          0,
          MAX_STARRED,
        )
      : [],
    sheet: {
      event: text(s["event"]),
      date: text(s["date"], 40),
      why: text(s["why"], 400),
      who: rows(s["who"], 3, (o) => ({ role: text(o["role"]), because: text(o["because"]) })),
      names: rows(s["names"], 2, (o) => ({ name: text(o["name"]), opener: text(o["opener"]) })),
      target: text(s["target"], 10),
      scanSlot: text(s["scanSlot"], 20),
    },
  };
}

export function toggleChecked(checked: readonly string[], id: string): string[] {
  return checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id];
}

/** Stars an opener, up to MAX_STARRED. A fourth star is refused, not swapped
 *  in, so nobody loses a pick by accident. */
export function toggleStarred(starred: readonly number[], n: number): number[] {
  if (starred.includes(n)) return starred.filter((x) => x !== n);
  return starred.length >= MAX_STARRED ? [...starred] : [...starred, n];
}

export function checklistProgress(
  content: PrepContent,
  checked: readonly string[],
): { done: number; total: number } {
  const ids = content.checklist.sections.flatMap((s) => s.items.map((i) => i.id));
  return { done: ids.filter((id) => checked.includes(id)).length, total: ids.length };
}

/** The starred openers' text, in the order they appear in the list. */
export function starredOpeners(content: PrepContent, starred: readonly number[]): string[] {
  return content.openers.groups
    .flatMap((g) => g.items)
    .filter((i) => starred.includes(i.n))
    .map((i) => i.text);
}
