import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  GLASS_STRENGTHS,
  MESH_PRESETS,
  MIN_CONTRAST,
  meshFor,
  parseTheme,
  readableTint,
  resolveTheme,
  stripPremium,
  themeNeedsPremium,
  worstContrast,
} from "./card-theme";

const ACCENT = "#E8553D";

describe("parseTheme", () => {
  it("falls back to the defaults for missing or non-object input", () => {
    for (const input of [null, undefined, "sunset", 42, []]) {
      expect(parseTheme(input)).toEqual(DEFAULT_THEME);
    }
  });

  it("keeps recognised values", () => {
    expect(
      parseTheme({
        mesh: "aurora",
        tint: "frost",
        strength: "bold",
        avatar: "squircle",
        bodyFont: "serif",
        status: "  Open to intros  ",
      }),
    ).toEqual({
      mesh: "aurora",
      tint: "frost",
      strength: "bold",
      avatar: "squircle",
      bodyFont: "serif",
      status: "Open to intros",
    });
  });

  it("replaces unknown names with the defaults", () => {
    const t = parseTheme({
      mesh: "neon",
      tint: "url(x)",
      strength: 9,
      avatar: "star",
      bodyFont: "x",
    });
    expect(t).toEqual(DEFAULT_THEME);
  });

  it("never lets a non-hex colour through", () => {
    const t = parseTheme({
      mesh: "custom",
      meshColors: ["red; background:url(https://evil.example/x)", "#7C3AED", "#12345", "#abcdef"],
    });
    expect(t.mesh).toBe("custom");
    expect(t.meshColors).toEqual(["#7C3AED", "#ABCDEF"]);
  });

  it("drops a custom mesh that has fewer than two valid colours", () => {
    const t = parseTheme({ mesh: "custom", meshColors: ["#7C3AED", "nope"] });
    expect(t.mesh).toBe("brand");
    expect(t.meshColors).toBeUndefined();
  });

  it("caps custom colours at four and the status at 24 characters", () => {
    const t = parseTheme({
      mesh: "custom",
      meshColors: ["#111111", "#222222", "#333333", "#444444", "#555555"],
      status: "x".repeat(40),
    });
    expect(t.meshColors).toHaveLength(4);
    expect(t.status).toHaveLength(24);
  });

  it("ignores keys it does not know", () => {
    expect(parseTheme({ mesh: "ocean", evil: "<script>" })).toEqual({
      ...DEFAULT_THEME,
      mesh: "ocean",
    });
  });
});

describe("premium settings", () => {
  it("flags custom colours and the extra photo shapes", () => {
    expect(themeNeedsPremium(DEFAULT_THEME)).toBe(false);
    expect(themeNeedsPremium({ ...DEFAULT_THEME, avatar: "squircle" })).toBe(false);
    expect(themeNeedsPremium({ ...DEFAULT_THEME, avatar: "hexagon" })).toBe(true);
    expect(themeNeedsPremium({ ...DEFAULT_THEME, avatar: "blob" })).toBe(true);
    expect(
      themeNeedsPremium({ ...DEFAULT_THEME, mesh: "custom", meshColors: ["#111111", "#222222"] }),
    ).toBe(true);
  });

  it("stripPremium leaves a theme any plan may save", () => {
    const stripped = stripPremium({
      mesh: "custom",
      meshColors: ["#111111", "#222222"],
      tint: "frost",
      strength: "soft",
      avatar: "blob",
      status: "Hiring",
    });
    expect(stripped).toEqual({
      mesh: "brand",
      tint: "frost",
      strength: "soft",
      avatar: "circle",
      status: "Hiring",
    });
    expect(themeNeedsPremium(stripped)).toBe(false);
  });
});

describe("contrast guard", () => {
  it("frost stays readable on every preset at every strength", () => {
    for (const mesh of MESH_PRESETS) {
      for (const strength of GLASS_STRENGTHS) {
        const m = meshFor({ ...DEFAULT_THEME, mesh }, ACCENT);
        expect(worstContrast(m, "frost", strength)).toBeGreaterThanOrEqual(MIN_CONTRAST);
      }
    }
  });

  it("keeps a tint that passes", () => {
    const theme = { ...DEFAULT_THEME, mesh: "graphite" as const, tint: "clear" as const };
    expect(readableTint(meshFor(theme, ACCENT), theme)).toBe("clear");
  });

  it("swaps clear glass for a readable tint on a bright mesh", () => {
    const theme = { ...DEFAULT_THEME, mesh: "sunset" as const, tint: "clear" as const };
    const mesh = meshFor(theme, ACCENT);
    expect(worstContrast(mesh, "clear", "regular")).toBeLessThan(MIN_CONTRAST);
    expect(readableTint(mesh, theme)).toBe("smoke");
  });

  it("swaps smoke for frost on the pale mesh", () => {
    const theme = { ...DEFAULT_THEME, mesh: "pearl" as const };
    expect(readableTint(meshFor(theme, ACCENT), theme)).toBe("frost");
  });

  it("whatever is chosen, the resolved card passes", () => {
    for (const mesh of MESH_PRESETS) {
      for (const tint of ["smoke", "frost", "clear"] as const) {
        for (const strength of GLASS_STRENGTHS) {
          for (const accent of [ACCENT, "#FFFFFF", "#000000", "#CA8A04", "#FDE68A"]) {
            const r = resolveTheme({
              accent_color: accent,
              font: "sans",
              theme: { mesh, tint, strength },
            });
            expect(worstContrast(r.mesh, r.tint, strength)).toBeGreaterThanOrEqual(MIN_CONTRAST);
          }
        }
      }
    }
  });
});

describe("resolveTheme", () => {
  it("derives the brand mesh from the accent", () => {
    const r = resolveTheme({ accent_color: "#2563EB", font: "display", theme: null });
    expect(r.vars["--ck-accent"]).toBe("#2563EB");
    expect(r.vars["--ck-mesh-1"]).toBe("#2563EB");
    expect(r.vars["--ck-blur"]).toBe("16px");
  });

  it("falls back to the house accent for a malformed colour", () => {
    const r = resolveTheme({ accent_color: "red;}", font: "sans", theme: null });
    expect(r.vars["--ck-accent"]).toBe("#4B3BFF");
  });

  it("only ever emits hex colours, known names and plain numbers", () => {
    const r = resolveTheme({
      accent_color: "#E8553D",
      font: "nope",
      theme: { mesh: "custom", meshColors: ["#111111", "javascript:alert(1)", "#222222"] },
    });
    for (const key of [
      "--ck-mesh-base",
      "--ck-mesh-1",
      "--ck-mesh-2",
      "--ck-mesh-3",
      "--ck-mesh-4",
    ] as const) {
      expect(r.vars[key]).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(Object.values(r.vars).join(" ")).not.toMatch(/javascript|url\(|;|<|>/i);
  });
});
