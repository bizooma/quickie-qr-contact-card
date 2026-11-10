import { Link } from "@tanstack/react-router";
import { Lock, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FONTS, type CardData } from "@/lib/card-model";
import {
  AVATAR_MASKS,
  GLASS_STRENGTHS,
  GLASS_TINTS,
  MESH_COLORS_MAX,
  MESH_COLORS_MIN,
  MESH_NAMES,
  MESH_PRESETS,
  PREMIUM_AVATAR_MASKS,
  STATUS_MAX,
  meshFor,
  parseTheme,
  resolveTheme,
  stripPremium,
  type CardTheme,
} from "@/lib/card-theme";
import { cn } from "@/lib/utils";

const TINT_NAMES = { smoke: "Smoke", frost: "Frost", clear: "Clear" } as const;
const STRENGTH_NAMES = { soft: "Soft", regular: "Regular", bold: "Bold" } as const;
const MASK_NAMES = {
  circle: "Circle",
  squircle: "Squircle",
  hexagon: "Hexagon",
  blob: "Blob",
} as const;

function Segment<T extends string>({
  label,
  options,
  names,
  value,
  locked = [],
  onChange,
}: {
  label: string;
  options: readonly T[];
  names: Record<T, string>;
  value: T;
  locked?: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <Label className="mb-3 block">{label}</Label>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const isLocked = locked.includes(o);
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={value === o}
              disabled={isLocked}
              title={isLocked ? "Premium" : undefined}
              onClick={() => onChange(o)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                value === o ? "border-brand bg-brand text-white" : "hover:bg-muted",
                isLocked && "cursor-not-allowed opacity-60 hover:bg-transparent",
              )}
            >
              {isLocked && <Lock className="h-3 w-3" aria-hidden />}
              {names[o]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Editor controls for the Liquid Glass layout. Every change goes back out
 *  through parseTheme (and stripPremium on other plans), so the editor can
 *  only ever save a theme the database will accept. */
export function BrandPanel({
  card,
  isPremium,
  onChange,
}: {
  card: CardData;
  isPremium: boolean;
  onChange: (theme: CardTheme) => void;
}) {
  const theme = parseTheme(card.theme);
  const resolved = resolveTheme(card);
  // The raw value, so a space typed mid-phrase isn't trimmed away under the cursor.
  const rawStatus = typeof card.theme?.status === "string" ? card.theme.status : "";
  const update = (patch: Partial<CardTheme>) => {
    const next = parseTheme({ ...theme, ...patch });
    const status = (typeof patch.status === "string" ? patch.status : rawStatus).slice(
      0,
      STATUS_MAX,
    );
    if (status) next.status = status;
    else delete next.status;
    onChange(isPremium ? next : stripPremium(next));
  };
  const swatch = (mesh: CardTheme["mesh"]) => {
    const m = meshFor({ ...theme, mesh }, resolved.accent);
    return `linear-gradient(120deg, ${m.blobs[0]}, ${m.blobs[1]}, ${m.blobs[2]})`;
  };
  const colors = theme.meshColors ?? [];
  const setColor = (i: number, v: string) =>
    update({ mesh: "custom", meshColors: colors.map((c, j) => (j === i ? v.toUpperCase() : c)) });

  return (
    <div className="space-y-8 rounded-2xl border bg-muted/40 p-4">
      <div>
        <Label className="mb-3 block">Background</Label>
        <div className="flex flex-wrap gap-3">
          {MESH_PRESETS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => update({ mesh: id, meshColors: undefined })}
              aria-pressed={theme.mesh === id}
              className="flex flex-col items-center gap-1 text-xs text-muted-foreground"
            >
              <span
                className={cn(
                  "block h-10 w-14 rounded-lg border",
                  theme.mesh === id && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                )}
                style={{ background: swatch(id) }}
              />
              {MESH_NAMES[id]}
            </button>
          ))}
          <button
            type="button"
            disabled={!isPremium}
            title={isPremium ? undefined : "Premium"}
            onClick={() =>
              update({
                mesh: "custom",
                meshColors:
                  colors.length >= MESH_COLORS_MIN ? colors : resolved.mesh.blobs.slice(0, 3),
              })
            }
            aria-pressed={theme.mesh === "custom"}
            className={cn(
              "flex flex-col items-center gap-1 text-xs text-muted-foreground",
              !isPremium && "cursor-not-allowed opacity-60",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-14 items-center justify-center rounded-lg border border-dashed",
                theme.mesh === "custom" && "ring-2 ring-ring ring-offset-2 ring-offset-background",
              )}
            >
              {isPremium ? <Plus className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
            </span>
            Custom
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Brand follows your accent color, so it always matches.
        </p>
        {theme.mesh === "custom" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {colors.map((c, i) => (
              <span key={i} className="relative">
                <input
                  type="color"
                  value={c}
                  aria-label={`Background color ${i + 1}`}
                  onChange={(e) => setColor(i, e.target.value)}
                  className="h-9 w-9 cursor-pointer rounded-full border bg-transparent p-0"
                />
                {colors.length > MESH_COLORS_MIN && (
                  <button
                    type="button"
                    aria-label={`Remove background color ${i + 1}`}
                    onClick={() =>
                      update({ mesh: "custom", meshColors: colors.filter((_, j) => j !== i) })
                    }
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
            {colors.length < MESH_COLORS_MAX && (
              <button
                type="button"
                aria-label="Add a background color"
                onClick={() => update({ mesh: "custom", meshColors: [...colors, resolved.accent] })}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed text-muted-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        <Segment
          label="Glass"
          options={GLASS_TINTS}
          names={TINT_NAMES}
          value={theme.tint}
          onChange={(tint) => update({ tint })}
        />
        {resolved.tint !== theme.tint && (
          <p className="mt-2 text-xs text-muted-foreground" role="status">
            {TINT_NAMES[theme.tint]} glass would make your text hard to read on this background, so
            your card shows {TINT_NAMES[resolved.tint]} glass instead.
          </p>
        )}
      </div>

      <Segment
        label="Glass strength"
        options={GLASS_STRENGTHS}
        names={STRENGTH_NAMES}
        value={theme.strength}
        onChange={(strength) => update({ strength })}
      />

      <Segment
        label="Photo shape"
        options={AVATAR_MASKS}
        names={MASK_NAMES}
        value={theme.avatar}
        locked={isPremium ? [] : PREMIUM_AVATAR_MASKS}
        onChange={(avatar) => update({ avatar })}
      />

      <div>
        <Label htmlFor="brand-status" className="mb-3 block">
          Status
        </Label>
        <Input
          id="brand-status"
          value={rawStatus}
          maxLength={STATUS_MAX}
          placeholder="Open to intros"
          onChange={(e) => update({ status: e.target.value })}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          A short note under your photo, up to {STATUS_MAX} characters. Leave it empty to hide it.
        </p>
      </div>

      <div>
        <Label className="mb-3 block">Body text</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Body text">
          {FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={(theme.bodyFont ?? "sans") === f.id}
              onClick={() => update({ bodyFont: f.id })}
              style={{ fontFamily: f.css }}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm",
                (theme.bodyFont ?? "sans") === f.id
                  ? "border-brand ring-2 ring-ring/30"
                  : "hover:bg-muted",
              )}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {!isPremium && (
        <p className="text-xs text-muted-foreground">
          Custom background colors and the hexagon and blob photo shapes come with Premium.{" "}
          <Link to="/app/settings" className="font-semibold text-brand underline">
            See plans
          </Link>
        </p>
      )}
    </div>
  );
}
