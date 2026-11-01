import { describe, expect, it } from "vitest";
import {
  cycleIndex,
  homeScreenAction,
  myQrIconHref,
  myQrSnapshot,
  shouldOpenOnQr,
  swipeStep,
  WALLPAPER_H,
  WALLPAPER_W,
  wallpaperLayout,
} from "./quick-qr";

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

  it("puts the home-screen code higher and smaller, still on screen", () => {
    const lock = wallpaperLayout();
    const home = wallpaperLayout(WALLPAPER_W, WALLPAPER_H, "home");
    expect(home.panel.size).toBeLessThan(lock.panel.size);
    expect(home.panel.y).toBeLessThan(lock.panel.y);
    expect(home.panel.y).toBeGreaterThan(WALLPAPER_H * 0.12);
    expect(home.caption.y + home.caption.size).toBeLessThan(WALLPAPER_H * 0.6);
  });
});

describe("card swiping", () => {
  it("reads a horizontal swipe and ignores taps and scrolls", () => {
    expect(swipeStep(-80, 5)).toBe(1);
    expect(swipeStep(80, 10)).toBe(-1);
    expect(swipeStep(-20, 0)).toBe(0);
    expect(swipeStep(-60, 90)).toBe(0);
  });
  it("wraps around the ends", () => {
    expect(cycleIndex(2, 1, 3)).toBe(0);
    expect(cycleIndex(0, -1, 3)).toBe(2);
    expect(cycleIndex(1, 1, 3)).toBe(2);
    expect(cycleIndex(0, 1, 0)).toBe(0);
  });
});

describe("homeScreenAction", () => {
  it("triggers the browser's install where it's offered", () => {
    expect(homeScreenAction({ platform: "android", standalone: false, canPrompt: true })).toEqual({
      kind: "install",
      label: "Add to home screen",
    });
    expect(homeScreenAction({ platform: "desktop", standalone: false, canPrompt: true })).toEqual({
      kind: "install",
      label: "Install app",
    });
  });

  it("shows the steps where the browser can't install for us", () => {
    expect(homeScreenAction({ platform: "ios", standalone: false, canPrompt: false })?.kind).toBe(
      "tip",
    );
    expect(
      homeScreenAction({ platform: "android", standalone: false, canPrompt: false })?.kind,
    ).toBe("tip");
    expect(
      homeScreenAction({ platform: "desktop", standalone: false, canPrompt: false }),
    ).toBeNull();
  });

  it("offers nothing more once the app is installed", () => {
    expect(
      homeScreenAction({ platform: "android", standalone: true, canPrompt: false }),
    ).toBeNull();
    expect(homeScreenAction({ platform: "ios", standalone: true, canPrompt: false })).toBeNull();
    expect(
      homeScreenAction({ platform: "desktop", standalone: true, canPrompt: false }),
    ).toBeNull();
  });
});

describe("myQrIconHref", () => {
  const base = { slug: "tamzyn", host: "contactkickstart.com" };
  it("opens the My QR page for the card in the Android browser", () => {
    expect(myQrIconHref({ ...base, platform: "android", standalone: false })).toBe(
      "/my-qr?card=tamzyn",
    );
  });
  it("leaves the installed app for Chrome, which can install My QR", () => {
    expect(myQrIconHref({ ...base, platform: "android", standalone: true })).toBe(
      "intent://contactkickstart.com/my-qr?card=tamzyn#Intent;scheme=https;package=com.android.chrome;end",
    );
  });
  it("is Android only", () => {
    expect(myQrIconHref({ ...base, platform: "ios", standalone: false })).toBeNull();
    expect(myQrIconHref({ ...base, platform: "desktop", standalone: true })).toBeNull();
  });
});

describe("myQrSnapshot", () => {
  const snap = (slug: string, accent = "#E8553D") => ({
    slug,
    label: "Work",
    full_name: "Tamzyn Williams",
    accent,
    bg: "#FFFFFF",
  });
  it("shows the card it was installed for, freshest copy first", () => {
    expect(myQrSnapshot("tamzyn", snap("tamzyn", "#000"), snap("tamzyn"))).toEqual(snap("tamzyn"));
    expect(myQrSnapshot(undefined, snap("tamzyn"), snap("other"))).toEqual(snap("tamzyn"));
  });
  it("falls back to the main app's last code, then a plain code for the card", () => {
    expect(myQrSnapshot(undefined, null, snap("other"))).toEqual(snap("other"));
    expect(myQrSnapshot("new-card", null, snap("other"))?.slug).toBe("new-card");
    expect(myQrSnapshot(undefined, null, null)).toBeNull();
  });
});
