// Liquid Glass theming: the stored shape, its guard, and the custom
// properties the layout reads. Pure, so the editor preview and the public
// page share one implementation. The database enforces the same rules
// (valid_card_theme, migration 0034); this copy is for instant feedback.
import { contrastText, fontCss } from "./card-model";

export const MESH_PRESETS = ["brand", "sunset", "aurora", "ocean", "graphite", "pearl"] as const;
export const GLASS_TINTS = ["smoke", "frost", "clear"] as const;
export const GLASS_STRENGTHS = ["soft", "regular", "bold"] as const;
export const AVATAR_MASKS = ["circle", "squircle", "hexagon", "blob"] as const;
export const BODY_FONTS = ["sans", "display", "serif", "mono"] as const;

export type MeshPreset = (typeof MESH_PRESETS)[number];
export type GlassTint = (typeof GLASS_TINTS)[number];
export type GlassStrength = (typeof GLASS_STRENGTHS)[number];
export type AvatarMask = (typeof AVATAR_MASKS)[number];
export type BodyFont = (typeof BODY_FONTS)[number];

export const STATUS_MAX = 24;
export const MESH_COLORS_MIN = 2;
export const MESH_COLORS_MAX = 4;
/** WCAG AA for body text. */
export const MIN_CONTRAST = 4.5;

export type CardTheme = {
  mesh: MeshPreset | "custom";
  /** Premium. Used when mesh is "custom". */
  meshColors?: string[] | undefined;
  tint: GlassTint;
  strength: GlassStrength;
  avatar: AvatarMask;
  bodyFont?: BodyFont | undefined;
  /** Shown as text on the status chip. */
  status?: string | undefined;
};

export const DEFAULT_THEME: CardTheme = {
  mesh: "brand",
  tint: "smoke",
  strength: "regular",
  avatar: "circle",
};

/** Premium (mirrors theme_needs_premium in 0034). */
export const PREMIUM_AVATAR_MASKS: readonly AvatarMask[] = ["hexagon", "blob"];

const HEX = /^#[0-9A-Fa-f]{6}$/;
const FALLBACK_ACCENT = "#E8553D";

export function isHex(v: unknown): v is string {
  return typeof v === "string" && HEX.test(v);
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

/** Anything unrecognised falls back to the default, so a bad value can never
 *  reach a style attribute. */
export function parseTheme(input: unknown): CardTheme {
  const t = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const colors = Array.isArray(t["meshColors"])
    ? t["meshColors"].filter(isHex).slice(0, MESH_COLORS_MAX)
    : [];
  const custom = t["mesh"] === "custom" && colors.length >= MESH_COLORS_MIN;
  const status = typeof t["status"] === "string" ? t["status"].trim().slice(0, STATUS_MAX) : "";
  const bodyFont = BODY_FONTS.includes(t["bodyFont"] as BodyFont)
    ? (t["bodyFont"] as BodyFont)
    : undefined;
  return {
    mesh: custom ? "custom" : pick(t["mesh"], MESH_PRESETS, DEFAULT_THEME.mesh),
    ...(custom ? { meshColors: colors.map((c) => c.toUpperCase()) } : {}),
    tint: pick(t["tint"], GLASS_TINTS, DEFAULT_THEME.tint),
    strength: pick(t["strength"], GLASS_STRENGTHS, DEFAULT_THEME.strength),
    avatar: pick(t["avatar"], AVATAR_MASKS, DEFAULT_THEME.avatar),
    ...(bodyFont ? { bodyFont } : {}),
    ...(status ? { status } : {}),
  };
}

export function themeNeedsPremium(theme: CardTheme): boolean {
  return (
    theme.mesh === "custom" ||
    theme.meshColors !== undefined ||
    PREMIUM_AVATAR_MASKS.includes(theme.avatar)
  );
}

/** What an account without Premium may save: the same theme with the Premium
 *  settings swapped for their free equivalents (mirrors public_card_theme). */
export function stripPremium(theme: CardTheme): CardTheme {
  const { meshColors: _dropped, ...rest } = theme;
  return {
    ...rest,
    mesh: theme.mesh === "custom" ? "brand" : theme.mesh,
    avatar: PREMIUM_AVATAR_MASKS.includes(theme.avatar) ? "circle" : theme.avatar,
  };
}

// ---------- Colour maths ----------

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function toHex(c: Rgb): string {
  return (
    "#" +
    c
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()
  );
}

/** `a` moved `t` of the way toward `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return toHex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t) as Rgb);
}

function luminance(c: Rgb): number {
  const [r, g, b] = c.map((n) => {
    const v = n / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: Rgb, b: Rgb): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ---------- Meshes ----------

export type Mesh = { base: string; blobs: [string, string, string, string] };

const MESHES: Record<Exclude<MeshPreset, "brand">, Mesh> = {
  sunset: { base: "#1B1340", blobs: ["#FF6B4A", "#7C3AED", "#2563EB", "#F59E0B"] },
  aurora: { base: "#06202B", blobs: ["#10B981", "#06B6D4", "#6366F1", "#65A30D"] },
  ocean: { base: "#071A3A", blobs: ["#2563EB", "#0EA5E9", "#1E40AF", "#0891B2"] },
  graphite: { base: "#0F1218", blobs: ["#334155", "#1F2937", "#3B4658", "#273142"] },
  pearl: { base: "#F3EEE8", blobs: ["#FBCFE8", "#BFDBFE", "#FDE68A", "#DDD6FE"] },
};

export const MESH_NAMES: Record<MeshPreset | "custom", string> = {
  brand: "Brand",
  sunset: "Sunset",
  aurora: "Aurora",
  ocean: "Ocean",
  graphite: "Graphite",
  pearl: "Pearl",
  custom: "Custom",
};

/** The colours behind the glass. "brand" is derived from the card's accent,
 *  so a new Liquid Glass card is on-brand before anything is chosen. */
export function meshFor(theme: CardTheme, accent: string): Mesh {
  if (theme.mesh === "custom" && theme.meshColors && theme.meshColors.length >= MESH_COLORS_MIN) {
    const c = theme.meshColors;
    return {
      base: mixHex(c[0]!, "#05060A", 0.82),
      blobs: [c[0]!, c[1]!, c[2] ?? c[0]!, c[3] ?? c[1]!],
    };
  }
  if (theme.mesh === "brand" || theme.mesh === "custom") {
    return {
      base: mixHex(accent, "#05060A", 0.82),
      blobs: [
        accent,
        mixHex(accent, "#FFFFFF", 0.35),
        mixHex(accent, "#1E1B4B", 0.6),
        mixHex(accent, "#000000", 0.35),
      ],
    };
  }
  return MESHES[theme.mesh];
}

// ---------- Glass ----------

type Glass = { rgb: string; alpha: number; fg: string; muted: string };

const GLASS: Record<GlassTint, Glass> = {
  smoke: { rgb: "12, 16, 28", alpha: 0.42, fg: "#FFFFFF", muted: "rgba(255, 255, 255, 0.74)" },
  frost: { rgb: "255, 255, 255", alpha: 0.62, fg: "#101422", muted: "rgba(16, 20, 34, 0.68)" },
  clear: { rgb: "255, 255, 255", alpha: 0.16, fg: "#FFFFFF", muted: "rgba(255, 255, 255, 0.74)" },
};

const STRENGTH: Record<GlassStrength, { blur: number; shift: number }> = {
  soft: { blur: 10, shift: -0.04 },
  regular: { blur: 16, shift: 0 },
  bold: { blur: 24, shift: 0.08 },
};

const AVATAR: Record<AvatarMask, { radius: string; clip: string }> = {
  circle: { radius: "50%", clip: "none" },
  squircle: { radius: "30%", clip: "none" },
  hexagon: { radius: "0", clip: "polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)" },
  blob: { radius: "42% 58% 55% 45% / 48% 44% 56% 52%", clip: "none" },
};

function glassAlpha(tint: GlassTint, strength: GlassStrength): number {
  return Math.max(0.08, Math.min(0.9, GLASS[tint].alpha + STRENGTH[strength].shift));
}

/** Worst-case text contrast for a tint: the text colour against every mesh
 *  colour as seen through the glass. A blob can sit right behind the text,
 *  so the lowest figure is the honest one. */
export function worstContrast(mesh: Mesh, tint: GlassTint, strength: GlassStrength): number {
  const glass = GLASS[tint];
  const g = glass.rgb.split(",").map(Number) as Rgb;
  const a = glassAlpha(tint, strength);
  const fg = rgb(glass.fg);
  let worst = Infinity;
  for (const c of [mesh.base, ...mesh.blobs]) {
    const b = rgb(c);
    const seen = [0, 1, 2].map((i) => g[i]! * a + b[i]! * (1 - a)) as Rgb;
    worst = Math.min(worst, ratio(fg, seen));
  }
  return worst;
}

/** The chosen tint if its text stays readable on this mesh, otherwise the
 *  first tint that is. Frost passes on every mesh, so there is always one. */
export function readableTint(mesh: Mesh, theme: CardTheme): GlassTint {
  if (worstContrast(mesh, theme.tint, theme.strength) >= MIN_CONTRAST) return theme.tint;
  for (const t of ["smoke", "frost"] as const) {
    if (t !== theme.tint && worstContrast(mesh, t, theme.strength) >= MIN_CONTRAST) return t;
  }
  return "frost";
}

// ---------- The engine ----------

export type CssVars = Record<`--ck-${string}`, string>;

export type ResolvedTheme = {
  theme: CardTheme;
  /** The card's accent, or the house accent if the stored value is malformed. */
  accent: string;
  mesh: Mesh;
  /** The tint actually shown; differs from theme.tint when the guard stepped in. */
  tint: GlassTint;
  /** The shown glass, for surfaces drawn without CSS (the share image). */
  glass: { rgb: string; alpha: number; fg: string; muted: string };
  vars: CssVars;
};

/** Turns a card's saved settings into the custom properties the Liquid Glass
 *  layout reads. Pure: the same input always gives the same output. */
export function resolveTheme(card: {
  accent_color: string;
  font: string;
  theme?: unknown;
}): ResolvedTheme {
  const theme = parseTheme(card.theme);
  const accent = isHex(card.accent_color) ? card.accent_color : FALLBACK_ACCENT;
  const mesh = meshFor(theme, accent);
  const tint = readableTint(mesh, theme);
  const glass = GLASS[tint];
  const avatar = AVATAR[theme.avatar];
  const vars: CssVars = {
    "--ck-accent": accent,
    "--ck-on-accent": contrastText(accent),
    "--ck-mesh-base": mesh.base,
    "--ck-mesh-1": mesh.blobs[0],
    "--ck-mesh-2": mesh.blobs[1],
    "--ck-mesh-3": mesh.blobs[2],
    "--ck-mesh-4": mesh.blobs[3],
    "--ck-glass-rgb": glass.rgb,
    "--ck-glass-alpha": glassAlpha(tint, theme.strength).toFixed(2),
    "--ck-blur": `${STRENGTH[theme.strength].blur}px`,
    "--ck-fg": glass.fg,
    "--ck-muted": glass.muted,
    "--ck-avatar-radius": avatar.radius,
    "--ck-avatar-clip": avatar.clip,
    "--ck-font-heading": fontCss(card.font),
    "--ck-font-body": fontCss(theme.bodyFont ?? "sans"),
  };
  return {
    theme,
    accent,
    mesh,
    tint,
    glass: { ...glass, alpha: glassAlpha(tint, theme.strength) },
    vars,
  };
}
