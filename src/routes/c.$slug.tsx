import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Download, Pencil, QrCode, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CardView } from "@/components/card/CardView";
import { ShareBack } from "@/components/card/ShareBack";
import { buildVCard, contrastText, type CardData, type LabeledValue } from "@/lib/card-model";
import { resolveTheme } from "@/lib/card-theme";
import { signPublicCardMedia, submitShareback } from "@/lib/capture.functions";
import {
  formFor,
  parseExchange,
  prefillSubmission,
  submissionProblem,
  vcardHidden,
  type ShareBackPrefill,
} from "@/lib/exchange";

// Absolute URL so crawlers accept it from any serving domain.
const DEFAULT_OG_IMAGE = "https://quickieqr.com/brand/og-default.png";

// shareback_open is false once a free owner has collected their share-backs (0032).
// verified is decided by get_public_card from the owner's profile (0034).
// exchange arrives without the owner's form when they are on the free plan (0035).
// hide_branding is true for a seated member of a team that turned branding off (0036).
type PublicCardData = CardData & {
  og_path?: string | null;
  shareback_open?: boolean;
  verified?: boolean;
  hide_branding?: boolean;
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
    const title = c
      ? `${c.full_name}${c.company ? ` · ${c.company}` : ""}`
      : "Digital business card";
    const desc = c
      ? [c.job_title, c.company].filter(Boolean).join(" at ") || "Save my contact details"
      : "Digital business card";
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
      ? [
          {
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
          },
        ]
      : [];
    return { meta, scripts };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">This card doesn't exist</h1>
      <Link to="/" className="text-sm text-brand underline">
        Create your own card
      </Link>
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
  } catch {
    return null;
  }
}

const firstValue = (list: unknown): string =>
  (Array.isArray(list) ? (list as LabeledValue[]) : [])
    .find((v) => v?.value?.trim())
    ?.value.trim() ?? "";

/** Who is looking, when they are signed in. `ownId` is the card's id when its
 *  owner opens it, so they get their QR code and editor instead of "Save
 *  contact" and "Share yours". `mine` is another member's own first card, so
 *  they can send their details back with one tap. RLS scopes the read; the
 *  user_id filter leaves out teammates' cards. */
async function whoIsLooking(
  slug: string,
): Promise<{ ownId: string | null; mine: ShareBackPrefill | null }> {
  const nobody = { ownId: null, mine: null };
  try {
    const { data: auth } = await supabase.auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return nobody;
    const { data } = await supabase
      .from("cards")
      .select("id, slug, full_name, company, phones, emails")
      .eq("user_id", uid)
      .order("created_at");
    const own = data?.find((c) => c.slug === slug);
    if (own) return { ownId: own.id, mine: null };
    const card = data?.find((c) => c.full_name.trim());
    if (!card) return nobody;
    return {
      ownId: null,
      mine: {
        name: card.full_name.trim(),
        email: firstValue(card.emails),
        phone: firstValue(card.phones),
        company: card.company?.trim() ?? "",
        cardUrl: `${window.location.origin}/c/${card.slug}`,
      },
    };
  } catch {
    return nobody;
  }
}

function PublicCard() {
  const { card, headshotUrl, logoUrl, bannerUrl } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const [open, setOpen] = useState(false);
  const [ownId, setOwnId] = useState<string | null>(null);
  const [mine, setMine] = useState<ShareBackPrefill | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const sentMine = sent && !!mine;
  const unbranded = card.hide_branding === true;
  const exchange = useMemo(() => parseExchange(card.exchange), [card.exchange]);
  const form = useMemo(() => formFor(exchange), [exchange]);
  const first = card.full_name.trim().split(/\s+/)[0] || "them";
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
    // A reload shouldn't invite a member to send the same card twice. (Only
    // members: the plain form stays open, since one phone or tablet is often
    // passed around for several people to fill in.)
    try {
      if (sessionStorage.getItem(`ck-sent-${slug}`)) setSent(true);
    } catch {
      // Storage can be blocked; the button just stays available.
    }
    void whoIsLooking(card.slug).then((who) => {
      if (!live) return;
      setMine(who.mine);
      // The owner checking their own card isn't a view.
      if (who.ownId) setOwnId(who.ownId);
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
    // The owner chooses what the saved contact holds (editor, Share tab).
    const hide = vcardHidden(exchange);
    const photo = headshotUrl && !hide.includes("photo") ? await toBase64(headshotUrl) : null;
    const vcf = buildVCard(card, {
      photoBase64: photo?.b64,
      photoType: photo?.type,
      cardUrl: window.location.href,
      hide,
    });
    const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(card.full_name || "contact").replace(/[^a-z0-9]+/gi, "-")}.vcf`;
    a.click();
    supabase.rpc("log_card_event", { _slug: slug, _event: "save" }).then(undefined, () => {});
  }

  function markSent() {
    setSent(true);
    try {
      sessionStorage.setItem(`ck-sent-${slug}`, "1");
    } catch {
      // Storage can be blocked; nothing depends on it.
    }
  }

  /** One tap for a signed-in member: their own card's details go straight to
   *  this card's owner. If the owner's form asks for something their card
   *  can't answer, the form opens with what we know filled in. */
  async function sendMine() {
    if (!mine || sending || sentMine) return;
    const details = prefillSubmission(form, mine);
    if (submissionProblem(form, { ...details, answers: [] }, first)) {
      setOpen(true);
      return;
    }
    setSending(true);
    try {
      await submitShareback({ data: { slug, ...details } });
      markSent();
      toast.success(`Sent. ${first} now has your details.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't send your details. Please try again.",
      );
    } finally {
      setSending(false);
    }
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
        unbranded={unbranded}
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
                  onClick={mine ? sendMine : () => setOpen(true)}
                  disabled={sending || sentMine}
                  className="flex h-12 items-center justify-center gap-2 rounded-full border text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-70"
                  style={{ borderColor: card.accent_color, color: inCardFg }}
                >
                  {sentMine ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {sentMine ? "Sent" : sending ? "Sending…" : mine ? "Send my card" : "Share yours"}
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
      {/* A team that removed our branding gets no invite under its cards. */}
      {unbranded ? (
        <div className="pb-10" />
      ) : (
        <footer className="pb-10 text-center">
          {/* Referral link: the landing page remembers the card, and a signup from
            it earns the owner bonus scans (record_signup_attribution). */}
          <a
            href={`/?ref=card&c=${encodeURIComponent(slug)}`}
            className="text-xs opacity-60 hover:opacity-100"
            style={{ color: fg }}
            onClick={() => {
              supabase
                .rpc("log_card_event", {
                  _slug: slug,
                  _event: "click",
                  _meta: "Create your own card",
                })
                .then(undefined, () => {});
            }}
          >
            Create your own card · QuickieQR
          </a>
        </footer>
      )}
      <ShareBack
        slug={slug}
        ownerName={card.full_name}
        form={form}
        prefill={mine}
        branded={!unbranded}
        open={open}
        onOpenChange={setOpen}
        onSent={mine ? markSent : undefined}
      />
    </div>
  );
}
