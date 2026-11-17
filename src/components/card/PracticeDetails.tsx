import { BadgeCheck } from "lucide-react";
import {
  DEDUCTIBLE_LINE,
  admissionsLine,
  nonprofitStatusLine,
  type CardPractice,
} from "@/lib/practice";

// A card's profession pack, in the card's own colors (passed in, since the
// classic layouts and Liquid Glass ink text differently). Renders nothing for
// a card without a pack.

/** Under the name: an attorney's practice areas and admissions, or a
 *  nonprofit's 501(c)(3) status and EIN. */
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
  const wrap = align === "left" ? "mt-3 text-left" : "mt-3 text-center";
  if (practice?.kind === "nonprofit") {
    const status = nonprofitStatusLine(practice);
    if (!status) return null;
    return (
      <div className={wrap}>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ background: chip }}
        >
          {practice.exempt && <BadgeCheck className="h-3.5 w-3.5" />}
          {status}
        </span>
      </div>
    );
  }
  if (practice?.kind !== "attorney") return null;
  const areas = (practice.areas ?? []).filter((a) => a.trim());
  const admitted = admissionsLine((practice.admissions ?? []).filter((a) => a.state.trim()));
  if (!areas.length && !admitted) return null;
  return (
    <div className={wrap}>
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

/** At the foot of the card: an attorney's disclaimer, or a nonprofit's
 *  deductibility line, solicitation disclosure and registration number. */
export function PracticeDisclaimer({
  practice,
  muted,
}: {
  practice: CardPractice | null | undefined;
  muted: string;
}) {
  const lines =
    practice?.kind === "attorney"
      ? [practice.disclaimer?.trim()]
      : practice?.kind === "nonprofit"
        ? [
            practice.exempt ? DEDUCTIBLE_LINE : "",
            practice.disclosure?.trim(),
            practice.stateReg?.trim() ? `Registration No. ${practice.stateReg.trim()}` : "",
          ]
        : [];
  const shown = lines.filter((l): l is string => !!l);
  if (!shown.length) return null;
  return (
    <div className="mt-6 space-y-2 text-[11px] leading-relaxed" style={{ color: muted }}>
      {shown.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
  );
}
