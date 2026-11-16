// The main app's web manifest. It is served by a route (not a static file)
// because its scope depends on the phone.
//
// On Android an installed app claims every page in its scope, and Chrome then
// treats any other manifest whose start page falls inside that scope as
// "already installed": no install offer, just "Open in QuickieQR". With
// the scope at "/", that swallowed the My QR app (/my-qr). So on Android the
// main app's scope is /app, which leaves /my-qr free to install as its own
// icon. Elsewhere it stays "/": iPhone doesn't use the My QR install, and
// there a narrower scope would send sign-in (/auth) out of the app.

export function isAndroidUserAgent(ua: string | null | undefined): boolean {
  return /\bandroid\b/i.test(ua ?? "");
}

export function appManifest(userAgent: string | null | undefined) {
  return {
    name: "QuickieQR",
    short_name: "QuickieQR",
    description:
      "Digital business cards: share by QR, capture every contact you meet, and send follow-ups that get replies.",
    id: "/app",
    start_url: "/app",
    scope: isAndroidUserAgent(userAgent) ? "/app" : "/",
    display: "standalone",
    background_color: "#F9F9FD",
    theme_color: "#4B3BFF",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/brand/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "My QR code",
        short_name: "My QR",
        description: "Show your card's QR code, ready to scan",
        url: "/app/qr",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Scan a card",
        short_name: "Scan",
        description: "Scan a paper business card into your contacts",
        url: "/app/scan",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Event prep",
        short_name: "Prep",
        description: "Your checklist, openers and goal sheet for the event",
        url: "/app/tools/prep",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
