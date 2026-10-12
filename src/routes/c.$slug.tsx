import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CardView } from "@/components/card/CardView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { buildVCard, contrastText, type CardData } from "@/lib/card-model";
import { signPublicCardMedia, submitShareback } from "@/lib/capture.functions";

// Absolute URL so crawlers accept it from any serving domain.
const DEFAULT_OG_IMAGE = "https://contactkickstart.com/brand/og-default.png";

type PublicCardData = CardData & { og_path?: string | null };

async function loadCard(slug: string) {
  const { data, error } = await supabase.rpc("get_public_card", { _slug: slug });
  if (error) throw error;
  if (!data) throw notFound();
  const card = data as unknown as PublicCardData;
  const urls = await signPublicCardMedia({ data: { slug } });
  return {
    card,
    headshotUrl: card.headshot_path ? (urls[card.headshot_path] ?? null) : null,
    logoUrl: card.logo_path ? (urls[card.logo_path] ?? null) : null,
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
    return { meta };
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

function PublicCard() {
  const { card, headshotUrl, logoUrl } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const [open, setOpen] = useState(false);
  const accentText = contrastText(card.accent_color);

  useEffect(() => {
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
  }, [slug]);

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
    <div className="min-h-screen" style={{ background: card.background_color }}>
      <CardView
        card={card}
        headshotUrl={headshotUrl}
        logoUrl={logoUrl}
        onLinkClick={(label) => {
          supabase
            .rpc("log_card_event", { _slug: slug, _event: "click", _meta: label })
            .then(undefined, () => {});
        }}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={saveContact}
              className="flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: card.accent_color, color: accentText }}
            >
              <Download className="h-4 w-4" />
              Save contact
            </button>
            <button
              onClick={() => setOpen(true)}
              className="flex h-12 items-center justify-center gap-2 rounded-full border text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ borderColor: card.accent_color, color: contrastText(card.background_color) }}
            >
              <Send className="h-4 w-4" />
              Share yours
            </button>
          </div>
        }
      />
      <div className="pb-4 text-center">
        <button
          onClick={shareCard}
          className="inline-flex items-center gap-1.5 text-xs font-medium opacity-60 hover:opacity-100"
          style={{ color: contrastText(card.background_color) }}
        >
          <Share2 className="h-3.5 w-3.5" />
          Share this card
        </button>
      </div>
      <footer className="pb-10 text-center">
        <Link
          to="/"
          className="text-xs opacity-60 hover:opacity-100"
          style={{ color: contrastText(card.background_color) }}
        >
          Create your own card · ContactKickstart
        </Link>
      </footer>
      <ShareBack slug={slug} name={card.full_name} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function ShareBack({ slug, name, open, onOpenChange }: { slug: string; name: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", company: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.email.trim() && !f.phone.trim()) { toast.error("Add an email or phone number"); return; }
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
    } catch {
      toast.error("Couldn't send your details. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md px-6 pb-8">
          <DrawerHeader className="px-0"><DrawerTitle>{done ? "Sent!" : `Share your details with ${name.split(" ")[0] || "me"}`}</DrawerTitle></DrawerHeader>
          {done ? <p className="text-sm text-muted-foreground">Thanks — {name.split(" ")[0]} now has your details.</p> : (
            <form onSubmit={submit} className="space-y-3">
              <Input required maxLength={120} placeholder="Your name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              <Input type="email" maxLength={255} placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              <Input type="tel" maxLength={40} placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
              <Input maxLength={120} placeholder="Company" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
              <Textarea maxLength={1000} placeholder="Note (where we met, what you need…)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
              <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Sending…" : "Send my details"}</Button>
            </form>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
