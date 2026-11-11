import { describe, expect, it } from "vitest";
import {
  LINK_GROUPS,
  LINK_PLATFORMS,
  displayUrl,
  guessPlatform,
  isBareEmail,
  isBarePhone,
  linkHost,
  linkKind,
  linkLabel,
  phoneDigits,
  tidyWebAddress,
} from "./link-catalog";

describe("the platform catalog", () => {
  it("has unique ids and a known group for every platform", () => {
    const ids = LINK_PLATFORMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of LINK_PLATFORMS) expect(LINK_GROUPS).toContain(p.group);
  });

  it("keeps every id that existing cards already use", () => {
    const ids = LINK_PLATFORMS.map((p) => p.id);
    for (const id of [
      "link",
      "linkedin",
      "x",
      "instagram",
      "youtube",
      "tiktok",
      "facebook",
      "github",
      "calendar",
      "payment",
      "website",
      "message",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("never lists the same host under two platforms", () => {
    const hosts = LINK_PLATFORMS.flatMap((p) => ("hosts" in p ? [...p.hosts] : []));
    expect(new Set(hosts).size).toBe(hosts.length);
  });
});

describe("guessPlatform", () => {
  it.each([
    ["https://www.linkedin.com/in/kale", "linkedin"],
    ["https://x.com/kale", "x"],
    ["twitter.com/kale", "x"],
    ["https://youtu.be/abc123", "youtube"],
    ["https://m.youtube.com/watch?v=abc", "youtube"],
    ["wa.me/15305551234", "whatsapp"],
    ["https://t.me/kale", "telegram"],
    ["https://bsky.app/profile/kale.bsky.social", "bluesky"],
    ["https://www.threads.net/@kale", "threads"],
    ["https://open.spotify.com/show/1", "spotify"],
    ["https://podcasts.apple.com/us/podcast/x/id1", "podcast"],
    ["https://kale.substack.com", "substack"],
    ["https://calendly.com/kale", "calendar"],
    ["cal.com/kale/intro", "calendar"],
    ["https://buy.stripe.com/abc", "payment"],
    ["https://www.paypal.me/kale", "payment"],
    ["https://g.page/r/abc/review", "reviews"],
    ["https://kale.myshopify.com", "shop"],
    ["https://zoom.us/j/123", "videocall"],
    ["mailto:kale@example.com", "email"],
    ["tel:+15305551234", "phone"],
  ])("%s is %s", (url, id) => {
    expect(guessPlatform(url)).toBe(id);
  });

  it("falls back to a plain link", () => {
    for (const url of ["", "   ", "https://northwind.co/about", "not a url at all", "sms:+1530"]) {
      expect(guessPlatform(url)).toBe("link");
    }
  });

  it("matches on the host, not on a mention in the path", () => {
    expect(guessPlatform("https://northwind.co/blog/why-we-left-linkedin.com")).toBe("link");
    expect(guessPlatform("https://notlinkedin.com/in/kale")).toBe("link");
  });
});

describe("link details", () => {
  it("sorts platforms into compact and wide tiles", () => {
    expect(linkKind("instagram")).toBe("social");
    expect(linkKind("whatsapp")).toBe("social");
    expect(linkKind("calendar")).toBe("link");
    expect(linkKind("website")).toBe("link");
    expect(linkKind("something-unknown")).toBe("link");
  });

  it("labels a platform, and an unknown one as a link", () => {
    expect(linkLabel("applepodcasts")).toBe("Link");
    expect(linkLabel("podcast")).toBe("Podcast");
  });

  it("shortens an address for display", () => {
    expect(linkHost("https://www.cal.com/kale/intro?x=1")).toBe("cal.com");
    expect(linkHost("northwind.co/case-studies")).toBe("northwind.co");
    expect(linkHost("mailto:kale@example.com?subject=Hi")).toBe("kale@example.com");
    expect(linkHost("tel:+15305551234")).toBe("+15305551234");
    expect(linkHost("")).toBe("");
  });
});

describe("addresses typed on a phone", () => {
  it("takes the spaces and trailing dot out of a host", () => {
    expect(tidyWebAddress("MyAI summit.dev")).toBe("MyAIsummit.dev");
    expect(tidyWebAddress("Cal Farley. Org")).toBe("CalFarley.Org");
    expect(tidyWebAddress("Topropesolutionz.com.")).toBe("Topropesolutionz.com");
    expect(tidyWebAddress("  Https://rkingdesigngroup.com ")).toBe("https://rkingdesigngroup.com");
  });

  it("leaves a good address, and anything after the host, as it was", () => {
    const linkedin =
      "https://www.linkedin.com/in/kale-lincoln-47402244?utm_source=share_via&utm_medium=member_android";
    expect(tidyWebAddress(linkedin)).toBe(linkedin);
    expect(tidyWebAddress("example.com/My Menu.pdf")).toBe("example.com/My%20Menu.pdf");
    expect(tidyWebAddress("example.com./a.b.")).toBe("example.com/a.b.");
    expect(tidyWebAddress("mailto:kale@example.com")).toBe("mailto:kale@example.com");
    expect(tidyWebAddress("tel:+1 530 555 1234")).toBe("tel:+1 530 555 1234");
    expect(tidyWebAddress("")).toBe("");
  });

  it("never shows %20 under a link, and still recognises the platform", () => {
    expect(linkHost("MyAI summit.dev")).toBe("myaisummit.dev");
    expect(linkHost("Cal Farley. Org")).toBe("calfarley.org");
    expect(linkHost("Topropesolutionz.com.")).toBe("topropesolutionz.com");
    expect(guessPlatform("Linked In.com/in/kale")).toBe("linkedin");
  });

  it("shows a website the way its owner wrote it, minus the clutter", () => {
    expect(displayUrl("www.MyAiSummit.dev")).toBe("www.MyAiSummit.dev");
    expect(displayUrl("Https://rkingdesigngroup.com/")).toBe("rkingdesigngroup.com");
    expect(displayUrl("Belay Reports. com")).toBe("BelayReports.com");
    expect(displayUrl("https://example.com/shop/")).toBe("example.com/shop");
  });
});

describe("bare email and phone values", () => {
  it("recognises an address or a number typed without its scheme", () => {
    expect(isBareEmail("jane@acme.com")).toBe(true);
    expect(isBarePhone("+1 555 0100")).toBe(true);
    expect(isBarePhone("(555) 010-0100")).toBe(true);
    // a web address that merely carries an address is not an email
    expect(isBareEmail("https://acme.com?to=jane@acme.com")).toBe(false);
    expect(isBareEmail("mailto:jane@acme.com")).toBe(false);
    // …and text or a short number is not a phone number
    expect(isBarePhone("Call me")).toBe(false);
    expect(isBarePhone("555 010")).toBe(false);
  });

  it("picks the Email or Phone icon when a bare value is pasted", () => {
    expect(guessPlatform("jane@acme.com")).toBe("email");
    expect(guessPlatform("+1 555 0100")).toBe("phone");
    expect(guessPlatform("acme.com")).toBe("link");
  });

  it("shows a bare address or number whole under the link", () => {
    expect(linkHost("jane@acme.com")).toBe("jane@acme.com");
    expect(linkHost("+1 555 0100")).toBe("+1 555 0100");
    expect(linkHost("mailto:jane@acme.com")).toBe("jane@acme.com");
  });

  it("keeps the digits a dialer needs", () => {
    expect(phoneDigits("+1 (555) 010-0100")).toBe("+15550100100");
  });
});
