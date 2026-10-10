import { describe, expect, it } from "vitest";
import { logoBox, qrViewBoxSize, svgWithLogo } from "./qr-logo";

const SAMPLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37 37"><path d="M0 0h37v37H0z" fill="#FFFFFF"/></svg>';

describe("qrViewBoxSize", () => {
  it("reads the square viewBox size", () => {
    expect(qrViewBoxSize(SAMPLE)).toBe(37);
  });
  it("returns null for non-square or missing viewBox", () => {
    expect(qrViewBoxSize('<svg viewBox="0 0 37 40"></svg>')).toBeNull();
    expect(qrViewBoxSize("<svg></svg>")).toBeNull();
  });
});

describe("logoBox", () => {
  it("centers the logo", () => {
    const b = logoBox(100, 0.2);
    expect(b.size).toBe(20);
    expect(b.x).toBe(40);
    expect(b.y).toBe(40);
    expect(b.pad).toBeGreaterThan(0);
  });
});

describe("svgWithLogo", () => {
  it("appends a white backing rect and the logo image before </svg>", () => {
    const out = svgWithLogo(SAMPLE, "data:image/png;base64,AAAA");
    expect(out).toContain('fill="#FFFFFF"/><image');
    expect(out).toContain('href="data:image/png;base64,AAAA"');
    expect(out.endsWith("</svg>")).toBe(true);
    // The original QR content is untouched.
    expect(out).toContain('<path d="M0 0h37v37H0z"');
  });
  it("returns the svg unchanged when the viewBox is unreadable", () => {
    expect(svgWithLogo("<svg></svg>", "x")).toBe("<svg></svg>");
  });
});
