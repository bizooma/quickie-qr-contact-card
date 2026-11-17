import { BrandLogo } from "@/components/BrandLogo";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LiveCardButton, LiveCardDialog } from "@/components/LiveCardDialog";
import { useAuth } from "@/hooks/use-auth";
import { AUDIENCES } from "@/lib/audiences";
import { logSiteEvent } from "@/lib/site-events";
import { ProfileMenu } from "@/components/ProfileMenu";

export const Route = createFileRoute("/for/$audience")({
  loader: ({ params }) => {
    const audience = AUDIENCES[params.audience];
    if (!audience) throw notFound();
    return { audience };
  },
  head: ({ loaderData }) => {
    const a = loaderData?.audience;
    return {
      meta: a
        ? [
            { title: `QuickieQR for ${a.label}` },
            { name: "description", content: a.sub },
            { property: "og:title", content: `QuickieQR for ${a.label}` },
            { property: "og:description", content: a.sub },
          ]
        : [],
    };
  },
  component: AudiencePage,
});

function AudiencePage() {
  const { audience: a } = Route.useLoaderData();
  const { user } = useAuth();
  const to = user ? "/app" : "/auth";
  const from = `for-${a.slug}`;
  // Someone who signs up from the attorneys' page starts with that box ticked.
  useEffect(() => {
    if (a.slug !== "lawyers") return;
    try {
      localStorage.setItem("ck-profession", "attorney");
    } catch {
      // Storage blocked: they can tick it themselves during signup.
    }
  }, [a.slug]);
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
        <Link to="/">
          <BrandLogo className="text-[1.4rem] md:text-[2.1rem]" />
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link to={to}>{user ? "Open app" : "Sign in"}</Link>
          </Button>
          {user && <ProfileMenu />}
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-14 pt-8 text-center">
        <p className="mb-4 inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-accent-foreground">
          {a.eyebrow}
        </p>
        <h1 className="text-4xl font-extrabold leading-[1.05] md:text-5xl">
          {a.headline[0]}
          <span className="text-brand">{a.headline[1]}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">{a.sub}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link to={to} onClick={() => logSiteEvent("cta_click", from)}>
              {a.cta} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <LiveCardDialog from={from}>
            <LiveCardButton />
          </LiveCardDialog>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Free plan forever · No credit card · Ready in 2 minutes
        </p>
      </section>

      <section className="border-y bg-muted/40">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-14 md:grid-cols-3">
          {a.pains.map(({ t, d }) => (
            <div key={t}>
              <h2 className="text-base font-bold">{t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-2">
          {a.features.map(({ t, d }) => (
            <div key={t} className="surface p-6">
              <CheckCircle2 className="mb-3 h-5 w-5 text-brand" />
              <h2 className="text-lg font-bold">{t}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand">
        <div className="mx-auto max-w-5xl px-6 py-14 text-center">
          <h2 className="mx-auto max-w-2xl text-3xl font-extrabold text-white md:text-4xl">
            {a.closing}
          </h2>
          <div className="mt-7 flex justify-center">
            <Button asChild size="lg" variant="secondary">
              <Link to={to} onClick={() => logSiteEvent("cta_click", `${from}-final`)}>
                {a.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-white/80">Free plan forever · No credit card</p>
        </div>
      </section>

      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} QuickieQR</span>
        <nav className="flex gap-4">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <Link to="/help" className="hover:text-foreground">
            Help
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link to="/security" className="hover:text-foreground">
            Security
          </Link>
        </nav>
      </footer>
    </div>
  );
}
