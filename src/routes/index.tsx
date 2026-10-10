import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, QrCode, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardView } from "@/components/card/CardView";
import { useAuth } from "@/hooks/use-auth";
import type { CardData } from "@/lib/card-model";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ContactKickstart — Your digital business card" },
      { name: "description", content: "Create a beautiful digital business card, share it by QR code or link, and capture every contact you meet." },
      { property: "og:title", content: "ContactKickstart — Your digital business card" },
      { property: "og:description", content: "Share by QR or link. Capture every contact you meet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const DEMO: CardData = {
  slug: "demo",
  label: "Work",
  full_name: "Tamzyn Williams",
  job_title: "Head of Partnerships",
  company: "Northwind",
  phones: [{ label: "Mobile", value: "+1 530-867-5309" }],
  emails: [{ label: "Work", value: "TWilliams@contactkickstart.com" }],
  website: "anywebsite.com",
  location: null,
  bio: null,
  headshot_path: null,
  logo_path: null,
  accent_color: "#E8553D",
  background_color: "#FFFFFF",
  font: "display",
  template: "banner",
  links: [
    { label: "LinkedIn", url: "x", icon: "linkedin" },
    { label: "Book a call", url: "x", icon: "calendar" },
  ],
};

function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <img
          src="/brand/logo-wordmark.webp"
          alt="ContactKickstart"
          className="h-20 w-auto md:h-28"
        />
        <Button asChild size="sm" variant={user ? "default" : "ghost"}>
          <Link to={user ? "/app" : "/auth"}>{user ? "Open app" : "Sign in"}</Link>
        </Button>
      </header>
      <main className="mx-auto grid max-w-6xl items-center gap-16 px-6 pb-24 pt-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="mb-4 inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-accent-foreground">
            Digital business cards
          </p>
          <h1 className="text-5xl font-extrabold leading-[1.02] md:text-6xl">
            One tap.
            <br />
            They have you.
            <br />
            <span className="text-brand">You have them.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">
            Build a card in two minutes, share it with a QR code, and collect the details of
            everyone you meet.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/app" : "/auth"}>
                Create your card <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-12 grid max-w-md grid-cols-3 gap-6 text-sm">
            {[
              { i: QrCode, t: "QR sharing" },
              { i: Users, t: "Contact capture" },
              { i: BarChart3, t: "Analytics" },
            ].map(({ i: I, t }) => (
              <div key={t}>
                <I className="mb-2 h-5 w-5 text-brand" />
                <span className="font-medium">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-center">
          <div className="phone-frame rotate-2">
            <div className="h-full overflow-hidden rounded-[38px]">
              <CardView card={DEMO} headshotUrl="/demo/maya.webp" logoUrl="/demo/logo.webp" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
