import { admissionsLine, type CardPractice } from "@/lib/practice";

// The attorney pack on a card, in the card's own colors (passed in, since the
// classic layouts and Liquid Glass ink text differently). Renders nothing for
// a card without a pack.

/** Practice areas and admissions, under the name. */
export function PracticeSummary({
  practice,
  align = "center",
  muted,
  chip,
}: {
  practice: CardPractice | null | undefined;
  align?: "center" | "left";
  muted: string;
  chip: string;
}) {
  if (practice?.kind !== "attorney") return null;
  const areas = (practice.areas ?? []).filter((a) => a.trim());
  const admitted = admissionsLine((practice.admissions ?? []).filter((a) => a.state.trim()));
  if (!areas.length && !admitted) return null;
  return (
    <div className={align === "left" ? "mt-3 text-left" : "mt-3 text-center"}>
      {areas.length > 0 && (
        <ul
          aria-label="Practice areas"
          className={`flex flex-wrap gap-1.5 ${align === "left" ? "" : "justify-center"}`}
        >
          {areas.map((a) => (
            <li
              key={a}
              className="rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: chip }}
            >
              {a}
            </li>
          ))}
        </ul>
      )}
      {admitted && (
        <p className="mt-2 text-xs" style={{ color: muted }}>
          {admitted}
        </p>
      )}
    </div>
  );
}

/** The disclaimer, at the foot of the card. */
export function PracticeDisclaimer({
  practice,
  muted,
}: {
  practice: CardPractice | null | undefined;
  muted: string;
}) {
  const text = practice?.kind === "attorney" ? practice.disclaimer?.trim() : "";
  if (!text) return null;
  return (
    <p className="mt-6 text-[11px] leading-relaxed" style={{ color: muted }}>
      {text}
    </p>
  );
}
