import { describe, expect, it } from "vitest";
import {
  autoTipFor,
  boldParts,
  detectPlatform,
  mergeDismissed,
  stepsFor,
  TIP_IDS,
  TIPS,
  tipIdForPath,
  withAnnouncements,
} from "./feature-tips";

describe("tipIdForPath", () => {
  it("maps each app screen to its tip", () => {
    expect(tipIdForPath("/app")).toBe("cards");
    expect(tipIdForPath("/app/")).toBe("cards");
    expect(tipIdForPath("/app/cards/6680fa38-3e10-4766-8f55-4c89015682de")).toBe("editor");
    expect(tipIdForPath("/app/qr")).toBe("qr");
    expect(tipIdForPath("/app/tools/background")).toBe("background");
    expect(tipIdForPath("/app/org")).toBe("team");
    expect(tipIdForPath("/app/contacts/9a2ba320-72bb-4252-bbbf-6527199ca09f")).toBe("contact");
  });

  it("has no tip for screens without one", () => {
    expect(tipIdForPath("/app/onboarding")).toBeNull();
    expect(tipIdForPath("/app/admin")).toBeNull();
    expect(tipIdForPath("/")).toBeNull();
  });
});

describe("detectPlatform", () => {
  it("tells iPhone, iPad, Android and computers apart", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe("desktop");
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe("android");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
  });
});

describe("stepsFor", () => {
  it("shows each platform only its own QR shortcut steps", () => {
    const ios = stepsFor(TIPS.qr, "ios").map((s) => s.text);
    const android = stepsFor(TIPS.qr, "android").map((s) => s.text);
    const desktop = stepsFor(TIPS.qr, "desktop").map((s) => s.text);
    expect(ios.some((t) => t.includes("Add to Home Screen"))).toBe(true);
    expect(ios.some((t) => t.includes("drag **My QR code**"))).toBe(false);
    expect(android.some((t) => t.includes("**Add a My QR icon**"))).toBe(true);
    expect(desktop.some((t) => t.includes("Open the app on my QR code"))).toBe(false);
    // The shared "works offline" step shows everywhere.
    for (const list of [ios, android, desktop]) {
      expect(list.some((t) => t.includes("no signal"))).toBe(true);
    }
  });

  it("gives every tip at least one step on every platform", () => {
    for (const id of TIP_IDS) {
      for (const p of ["ios", "android", "desktop"] as const) {
        expect(stepsFor(TIPS[id], p).length, `${id} on ${p}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("boldParts", () => {
  it("splits out **bold** runs", () => {
    expect(boldParts("Tap **Share**, then **Add**.")).toEqual([
      { text: "Tap ", bold: false },
      { text: "Share", bold: true },
      { text: ", then ", bold: false },
      { text: "Add", bold: true },
      { text: ".", bold: false },
    ]);
  });
});

describe("mergeDismissed", () => {
  it("unions lists, drops unknown ids and duplicates", () => {
    expect(mergeDismissed(["qr", "nope"], ["qr", "scan"], null).sort()).toEqual(["qr", "scan"]);
  });
});

describe("autoTipFor", () => {
  it("opens the screen tip first", () => {
    expect(autoTipFor("/app/contacts", [])).toBe("contacts");
  });
  it("shows the what's-new note only to people who turned the screen tip off", () => {
    expect(autoTipFor("/app/contacts", ["contacts"])).toBe("new-events-reminders");
    expect(autoTipFor("/app/contacts", ["contacts", "new-events-reminders"])).toBeNull();
    expect(autoTipFor("/app/qr", ["qr"])).toBeNull();
    expect(autoTipFor("/app/admin", [])).toBeNull();
  });
  it("covers the note when the screen tip is turned off", () => {
    expect(withAnnouncements(["contacts"]).sort()).toEqual(["contacts", "new-events-reminders"]);
    expect(withAnnouncements(["qr"])).toEqual(["qr"]);
  });
  it("marks the note as an announcement", () => {
    expect(TIPS["new-events-reminders"].announcement).toBe(true);
  });
});
