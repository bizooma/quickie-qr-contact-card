import { describe, expect, it } from "vitest";
import {
  BRAND_QR_CENTER,
  logoBox,
  parseQrCenter,
  qrCenterAllowed,
  qrCenterSource,
  qrViewBoxSize,
  svgWithLogo,
} from "./qr-logo";

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

describe("svgWithLogo circle", () => {
  it("clips a photo to a circle on a white ring", () => {
    const out = svgWithLogo(SAMPLE, "data:image/jpeg;base64,BBBB", "circle");
    expect(out).toContain('<clipPath id="ck-qr-center"><circle');
    expect(out).toContain('clip-path="url(#ck-qr-center)"');
    expect(out).toContain('preserveAspectRatio="xMidYMid slice"');
    expect(out).toContain('href="data:image/jpeg;base64,BBBB"');
    expect(out.endsWith("</svg>")).toBe(true);
  });
});

describe("qrCenterAllowed", () => {
  it("is a Pro and Premium perk", () => {
    expect(qrCenterAllowed("pro")).toBe(true);
    expect(qrCenterAllowed("premium")).toBe(true);
    expect(qrCenterAllowed("free")).toBe(false);
    expect(qrCenterAllowed(undefined)).toBe(false);
  });
});

describe("parseQrCenter", () => {
  it("accepts photo/logo and treats anything else as none", () => {
    expect(parseQrCenter("photo")).toBe("photo");
    expect(parseQrCenter("logo")).toBe("logo");
    expect(parseQrCenter(null)).toBeNull();
    expect(parseQrCenter("banana")).toBeNull();
  });
});

describe("qrCenterSource", () => {
  const paths = { headshotPath: "u/face.webp", logoPath: "u/logo.png" };
  const brand = { kind: "brand", url: BRAND_QR_CENTER, shape: "rounded" };
  it("returns the photo as a circle and the logo as a rounded square", () => {
    expect(qrCenterSource("photo", paths, "pro")).toEqual({
      kind: "stored",
      path: "u/face.webp",
      shape: "circle",
    });
    expect(qrCenterSource("logo", paths, "premium")).toEqual({
      kind: "stored",
      path: "u/logo.png",
      shape: "rounded",
    });
  });
  it("defaults to the QuickieQR badge when nothing is chosen", () => {
    expect(qrCenterSource(null, paths, "pro")).toEqual(brand);
    expect(qrCenterSource(null, paths, "free")).toEqual(brand);
  });
  it("falls back to the badge for free plans or a missing image", () => {
    expect(qrCenterSource("photo", paths, "free")).toEqual(brand);
    expect(qrCenterSource("photo", paths, undefined)).toEqual(brand);
    expect(qrCenterSource("logo", { headshotPath: "u/face.webp", logoPath: null }, "pro")).toEqual(
      brand,
    );
  });
});
