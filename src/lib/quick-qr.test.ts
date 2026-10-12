import { describe, expect, it } from "vitest";
import { shouldOpenOnQr, WALLPAPER_H, WALLPAPER_W, wallpaperLayout } from "./quick-qr";

describe("shouldOpenOnQr", () => {
  const base = { enabled: true, standalone: true, pathname: "/app", firstLoad: true };
  it("jumps to the QR only on a fresh launch of the installed app", () => {
    expect(shouldOpenOnQr(base)).toBe(true);
    expect(shouldOpenOnQr({ ...base, pathname: "/app/" })).toBe(true);
  });
  it("leaves everything else alone", () => {
    expect(shouldOpenOnQr({ ...base, enabled: false })).toBe(false);
    expect(shouldOpenOnQr({ ...base, standalone: false })).toBe(false);
    expect(shouldOpenOnQr({ ...base, firstLoad: false })).toBe(false);
    expect(shouldOpenOnQr({ ...base, pathname: "/app/contacts" })).toBe(false);
  });
});

describe("wallpaperLayout", () => {
  it("keeps the code and caption on screen, below the lock-screen clock", () => {
    const { panel, qr, caption } = wallpaperLayout();
    expect(panel.x).toBeGreaterThan(0);
    expect(panel.x + panel.size).toBeLessThan(WALLPAPER_W);
    expect(panel.y).toBeGreaterThan(WALLPAPER_H * 0.3);
    expect(caption.y + caption.size).toBeLessThan(WALLPAPER_H * 0.88);
    expect(qr.size).toBeGreaterThan(WALLPAPER_W / 2);
  });
});
