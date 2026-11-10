import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Pencil, QrCode, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CardView } from "@/components/card/CardView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { buildVCard, contrastText, type CardData } from "@/lib/card-model";
import { resolveTheme } from "@/lib/card-theme";
import { signPublicCardMedia, submitShareback } from "@/lib/capture.functions";

// Absolute URL so crawlers accept it from any serving domain.
const DEFAULT_OG_IMAGE = "https://contactkickstart.com/brand/og-default.png";

// shareback_open is false once a free owner has collected their share-backs (0032).
// verified is decided by get_public_card from the owner's profile (0034).
type PublicCardData = CardData & {
  og_path?: string | null;
  shareback_open?: boolean;
  verified?: boolean;
};

async function loadCard(slug: string) {
  const { data, error } = await supabase.rpc("get_public_card", { _slug: slug });
  if (error) throw error;
  if (!data) {
    // A renamed card's old address (e.g. on a printed QR code) forwards to its new one.
    const { data: current } = await supabase.rpc("resolve_card_slug", { _slug: slug });
    if (current && current !== slug) {
      throw redirect({ to: "/c/$slug", params: { slug: current }, statusCode: 301 });
    }
    throw notFound();
  }
  const card = data as unknown as PublicCardData;
  const urls = await signPublicCardMedia({ data: { slug } });
  return {
    card,
    headshotUrl: card.headshot_path ? (urls[card.headshot_path] ?? null) : null,
    logoUrl: card.logo_path ? (urls[card.logo_path] ?? null) : null,
    bannerUrl: card.banner_path ? (urls[card.banner_path] ?? null) : null,
    ogUrl: card.og_path ? (urls[card.og_path] ?? null) : null,
  };
}

export const Route = createFileRoute("/c/$slug")({
  loader: ({ params }) => loadCard(params.slug),
  staleTime: 0,
  head: ({ loaderData }) => {
    const c = loaderData?.card;
    const title = c ? `${c.full_name}${c.company ? ` · ${c.company}` : ""}` : "Digital business card";
    const desc = c ? [c.job_title, c.company].filter(Boolean).join(" at ") || "Save my contact details" : "Digital business card";
    const image = loaderData?.ogUrl ?? DEFAULT_OG_IMAGE;
    const meta = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "profile" },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: image },
    ];
    const scripts = c
      ? [{
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            mainEntity: {
              "@type": "Person",
              name: c.full_name,
              ...(c.job_title ? { jobTitle: c.job_title } : {}),
              ...(c.company ? { worksFor: { "@type": "Organization", name: c.company } } : {}),
            },
          }).replace(/</g, "\\u003c"),
        }]
      : [];
    return { meta, scripts };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">This card doesn't exist</h1>
      <Link to="/" className="text-sm text-brand underline">Create your own card</Link>
    </div>
  ),
  component: PublicCard,
});

async function toBase64(url: string): Promise<{ b64: string; type: string } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const type = blob.type.includes("png") ? "PNG" : "JPEG";
    const b64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return { b64, type };
  } catch { return null; }
}

/** The card's id when its signed-in owner opens it, so they get their QR code
 *  and editor instead of "Save contact" and "Share yours". RLS scopes the
 *  read; the user_id filter leaves out teammates' cards. */
async function ownCardId(slug: string): Promise<string | null> {
  try {
    const { data: auth } = await supabase.auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return null;
    const { data } = await supabase
      .from("cards")
      .select("id")
      .eq("slug", slug)
      .eq("user_id", uid)
      .maybeSingle();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

function PublicCard() {
  const { card, headshotUrl, logoUrl, bannerUrl } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const [open, setOpen] = useState(false);
  const [ownId, setOwnId] = useState<string | null>(null);
  const accentText = contrastText(card.accent_color);
  // Liquid Glass paints its own backdrop: the page takes the mesh's base
  // colour, and text inside the card sits on glass, so it uses the glass text
  // colour the layout exposes.
  const glass = card.template === "glass" ? resolveTheme(card) : null;
  const pageBg = glass ? glass.mesh.base : card.background_color;
  const fg = contrastText(pageBg);
  const inCardFg = glass ? "var(--ck-fg)" : fg;

  useEffect(() => {
    let live = true;
    void ownCardId(card.slug).then((id) => {
      if (!live) return;
      // The owner checking their own card isn't a view.
      if (id) setOwnId(id);
      else logView();
    });
    return () => {
      live = false;
    };
  }, [slug]);

  function logView() {
    const key = `ss-view-${slug}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    // A stable per-browser id lets analytics count unique visitors without
    // any fingerprinting; referrer is reduced to a hostname.
    let visitor: string | null = null;
    try {
      visitor = localStorage.getItem("ck-visitor");
      if (!visitor) {
        visitor = crypto.randomUUID();
        localStorage.setItem("ck-visitor", visitor);
      }
    } catch {
      visitor = null;
    }
    let referrer: string | null = null;
    try {
      referrer = document.referrer ? new URL(document.referrer).hostname : null;
      if (referrer === window.location.hostname) referrer = null;
    } catch {
      referrer = null;
    }
    const device = /ipad|tablet/i.test(navigator.userAgent)
      ? "tablet"
      : /mobi|android|iphone/i.test(navigator.userAgent)
        ? "mobile"
        : "desktop";
    // supabase.rpc returns a lazy builder: it only sends the request once
    // awaited/then-ed, so fire-and-forget calls MUST end in .then().
    supabase
      .rpc("log_card_event", {
        _slug: slug,
        _event: "view",
        ...(referrer ? { _referrer: referrer } : {}),
        _device: device,
        ...(visitor ? { _visitor: visitor } : {}),
      })
      .then(undefined, () => {});
  }

  async function saveContact() {
    const photo = headshotUrl ? await toBase64(headshotUrl) : null;
    const vcf = buildVCard(card, { photoBase64: photo?.b64, photoType: photo?.type, cardUrl: window.location.href });
    const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(card.full_name || "contact").replace(/[^a-z0-9]+/gi, "-")}.vcf`;
    a.click();
    supabase.rpc("log_card_event", { _slug: slug, _event: "save" }).then(undefined, () => {});
  }

  async function shareCard() {
    const url = window.location.href;
    const title = `${card.full_name} — digital business card`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Cancelled or unsupported payload — fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy — use your browser's share menu");
    }
  }

  return (
    <div className="min-h-screen" style={{ background: pageBg }}>
      <CardView
        card={card}
        headshotUrl={headshotUrl}
        logoUrl={logoUrl}
        bannerUrl={bannerUrl}
        verified={card.verified === true}
        onLinkClick={(label) => {
          supabase
            .rpc("log_card_event", { _slug: slug, _event: "click", _meta: label })
            .then(undefined, () => {});
        }}
        actions={
          ownId ? (
            <div className="space-y-2">
              <p className="text-center text-xs opacity-60" style={{ color: inCardFg }}>
                This is your card, as people see it.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/app/qr"
                  search={{ card: card.slug }}
                  className="flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ background: card.accent_color, color: accentText }}
                >
                  <QrCode className="h-4 w-4" />
                  Show my QR code
                </Link>
                <Link
                  to="/app/cards/$id"
                  params={{ id: ownId }}
                  className="flex h-12 items-center justify-center gap-2 rounded-full border text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ borderColor: card.accent_color, color: inCardFg }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit card
                </Link>
              </div>
            </div>
          ) : (
            <div
              className={`grid gap-2 ${card.shareback_open === false ? "grid-cols-1" : "grid-cols-2"}`}
            >
              <button
                onClick={saveContact}
                className="flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: card.accent_color, color: accentText }}
              >
                <Download className="h-4 w-4" />
                Save contact
              </button>
              {card.shareback_open !== false && (
                <button
                  onClick={() => setOpen(true)}
                  className="flex h-12 items-center justify-center gap-2 rounded-full border text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ borderColor: card.accent_color, color: inCardFg }}
                >
                  <Send className="h-4 w-4" />
                  Share yours
                </button>
              )}
            </div>
          )
        }
      />
      <div className="pb-4 text-center">
        <button
          onClick={shareCard}
          className="inline-flex items-center gap-1.5 text-xs font-medium opacity-60 hover:opacity-100"
          style={{ color: fg }}
        >
          <Share2 className="h-3.5 w-3.5" />
          Share this card
        </button>
      </div>
      <footer className="pb-10 text-center">
        {/* Referral link: the landing page remembers the card, and a signup from
            it earns the owner bonus scans (record_signup_attribution). */}
        <a
          href={`/?ref=card&c=${encodeURIComponent(slug)}`}
          className="text-xs opacity-60 hover:opacity-100"
          style={{ color: fg }}
          onClick={() => {
            supabase
              .rpc("log_card_event", { _slug: slug, _event: "click", _meta: "Create your own card" })
              .then(undefined, () => {});
          }}
        >
          Create your own card · ContactKickstart
        </a>
      </footer>
      <ShareBack slug={slug} name={card.full_name} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function ShareBack({ slug, name, open, onOpenChange }: { slug: string; name: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", company: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const first = name.split(" ")[0] || "me";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.email.trim() && !f.phone.trim()) {
      toast.error(`Add an email or phone number so ${first} can reach you.`);
      return;
    }
    setBusy(true);
    try {
      // Server function: saves via the same RPC, then notifies the card owner.
      await submitShareback({
        data: {
          slug,
          name: f.name,
          email: f.email,
          phone: f.phone,
          company: f.company,
          note: f.note,
        },
      });
      setDone(true);
    } catch (err) {
      // Server function messages are already visitor-safe (sharebackErrorMessage).
      toast.error(err instanceof Error ? err.message : "Couldn't send your details. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md px-6 pb-8">
          <DrawerHeader className="px-0"><DrawerTitle>{done ? "Sent!" : `Share your details with ${first}`}</DrawerTitle></DrawerHeader>
          {done ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Thanks — {first} now has your details.</p>
              {/* The viral loop: the person who just shared is the next card owner. */}
              <Button asChild className="h-11 w-full">
                <a href={`/?ref=shareback&c=${encodeURIComponent(slug)}`}>Get your own free card</a>
              </Button>
              <p className="text-xs text-muted-foreground">
                A digital card like this one, with your own QR code and share-back form. Free, no credit card.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="sb-name">Your name</Label>
                <Input id="sb-name" required maxLength={120} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="sb-email">Email</Label>
                  <Input id="sb-email" type="email" inputMode="email" maxLength={255} autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sb-phone">Phone</Label>
                  <Input id="sb-phone" type="tel" inputMode="tel" maxLength={40} autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sb-company">Company <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="sb-company" maxLength={120} autoComplete="organization" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sb-note">Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Textarea id="sb-note" maxLength={1000} placeholder="Where we met, what you need…" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">An email or phone number is needed so {first} can reach you.</p>
              <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Sending…" : "Send my details"}</Button>
              <p className="text-center text-xs text-muted-foreground">
                Only {first} receives these details, to follow up with you. Delivered by ContactKickstart —{" "}
                <a href="/privacy" className="underline">privacy</a>.
              </p>
            </form>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
