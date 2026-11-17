import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/hooks/use-auth";
import { initMonitoring } from "@/lib/monitoring";
import { captureAttribution } from "@/lib/attribution";
import { initMetaPixel } from "@/lib/meta-pixel";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // The My QR page links its own manifest, so it installs as a separate
  // "My QR" home-screen icon rather than a second copy of the app.
  head: ({ matches }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#4B3BFF" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { title: "QuickieQR — Digital business cards" },
      { name: "description", content: "Share your digital business card and capture contacts." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico?v=2", type: "image/x-icon" },
      { rel: "icon", href: "/brand/icon-192.png", type: "image/png", sizes: "192x192" },
      {
        rel: "apple-touch-icon",
        href: matches.some((m) => (m.routeId as string) === "/my-qr")
          ? "/brand/my-qr-180.png"
          : "/brand/apple-touch-icon.png",
      },
      {
        rel: "manifest",
        href: matches.some((m) => (m.routeId as string) === "/my-qr")
          ? "/my-qr.webmanifest"
          : "/manifest.webmanifest",
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Fraunces:opsz,wght@9..144,500..700&family=JetBrains+Mono:wght@400;600&family=Manrope:wght@400..700&display=swap",
      },
    ],
    scripts: [
      {
        src: "https://datarightsos.com/functions/widgetJs",
        "data-tessera-site": "sk_u40a2360dhmdu9th52lzvqqy",
        defer: true,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// Apply the saved theme (ck-theme: light/dark; absent = follow the device)
// before first paint so there is no flash; 'ck-theme-change' re-applies live.
const THEME_SCRIPT = `(function(){try{var m=window.matchMedia('(prefers-color-scheme: dark)');var a=function(){var t=null;try{t=localStorage.getItem('ck-theme')}catch(e){}document.documentElement.classList.toggle('dark',t==='dark'||(t!=='light'&&m.matches))};a();m.addEventListener('change',a);window.addEventListener('ck-theme-change',a)}catch(e){}})();`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Register the PWA service worker (production only — it would fight Vite's
  // dev server and HMR otherwise).
  useEffect(() => {
    initMonitoring();
    // Remember what brought this browser here (UTM, Facebook click, a card's
    // referral link) for the signup that may follow; load the Meta pixel.
    try {
      captureAttribution(localStorage, new URL(window.location.href), document.referrer);
    } catch {
      // storage blocked — the signup stays unattributed
    }
    initMetaPixel(window.location.pathname);
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is progressive enhancement; the app works without it.
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
