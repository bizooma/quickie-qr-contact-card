import { describe, expect, it } from "vitest";
import { osFrom, parseVia, withVia, withoutVia } from "./card-source";

describe("via tags", () => {
  it("adds the tag to a card link", () => {
    expect(withVia("https://quickieqr.com/c/joe", "qr")).toBe("https://quickieqr.com/c/joe?via=qr");
    expect(withVia("/c/joe?x=1", "link")).toBe("/c/joe?x=1&via=link");
  });

  it("reads only known tags", () => {
    expect(parseVia("?via=qr")).toBe("qr");
    expect(parseVia("?via=EMAIL")).toBe("email");
    expect(parseVia("?via=lexguild")).toBe("lexguild");
    expect(parseVia("?via=evil")).toBeNull();
    expect(parseVia("")).toBeNull();
  });

  it("drops the tag and keeps everything else", () => {
    expect(withoutVia("?via=qr")).toBe("");
    expect(withoutVia("?ref=card&via=qr&c=joe")).toBe("?ref=card&c=joe");
  });
});

describe("osFrom", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
  it("tells devices apart", () => {
    expect(osFrom(iphone)).toBe("iphone");
    expect(osFrom(mac, 0)).toBe("mac");
    expect(osFrom(mac, 5)).toBe("ipad");
    expect(osFrom("Mozilla/5.0 (Linux; Android 15; Pixel 9)")).toBe("android");
    expect(osFrom("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(osFrom("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
    expect(osFrom("curl/8")).toBe("other");
  });
});
