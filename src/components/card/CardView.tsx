import { Globe, Mail, MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { contrastText, fontCss, initials, normalizeUrl, type CardData } from "@/lib/card-model";
import { LinkIcon } from "./LinkIcon";

// Card colors are user-chosen data, so they are applied as inline styles
// rather than design tokens.
export function CardView({
  card,
  headshotUrl,
  logoUrl,
  actions,
  onLinkClick,
}: {
  card: CardData;
  headshotUrl?: string | null | undefined;
  logoUrl?: string | null | undefined;
  actions?: ReactNode;
  onLinkClick?: ((label: string) => void) | undefined;
}) {
  const bg = card.background_color;
  const fg = contrastText(bg);
  const accent = card.accent_color;
  const onAccent = contrastText(accent);
  const muted = fg === "#FFFFFF" ? "rgba(255,255,255,0.65)" : "rgba(17,17,17,0.6)";
  const tile = fg === "#FFFFFF" ? "rgba(255,255,255,0.08)" : "rgba(17,17,17,0.04)";
  const t = card.template;
  // Cards without an uploaded logo carry the ContactKickstart badge until
  // the owner replaces it in the editor.
  const logo = logoUrl || "/brand/logo-badge.webp";

  const avatar = (size: number, ring = false) => (
    <div
      className="shrink-0 overflow-hidden rounded-full flex items-center justify-center font-semibold"
      style={{
        width: size,
        height: size,
        background: accent,
        color: onAccent,
        fontSize: size / 3,
        boxShadow: ring ? `0 0 0 5px ${bg}` : undefined,
      }}
    >
      {headshotUrl ? (
        <img src={headshotUrl} alt={card.full_name} className="h-full w-full object-cover" />
      ) : (
        initials(card.full_name || "?")
      )}
    </div>
  );

  const rows: { icon: ReactNode; text: string; href: string; sub?: string; kind: string }[] = [
    ...card.phones
      .filter((p) => p.value)
      .map((p) => ({
        icon: <Phone className="h-4 w-4" />,
        text: p.value,
        sub: p.label,
        href: `tel:${p.value.replace(/\s/g, "")}`,
        kind: "phone",
      })),
    ...card.emails
      .filter((e) => e.value)
      .map((e) => ({
        icon: <Mail className="h-4 w-4" />,
        text: e.value,
        sub: e.label,
        href: `mailto:${e.value}`,
        kind: "email",
      })),
    ...(card.website
      ? [
          {
            icon: <Globe className="h-4 w-4" />,
            text: card.website.replace(/^https?:\/\//, ""),
            href: normalizeUrl(card.website),
            kind: "website",
          },
        ]
      : []),
    ...(card.location
      ? [
          {
            icon: <MapPin className="h-4 w-4" />,
            text: card.location,
            href: `https://maps.google.com/?q=${encodeURIComponent(card.location)}`,
            kind: "location",
          },
        ]
      : []),
  ];

  const header = (
    <div className={t === "minimal" ? "text-left" : "text-center"}>
      <h1
        className="text-2xl font-bold leading-tight"
        style={{ fontFamily: fontCss(card.font), letterSpacing: "-0.02em" }}
      >
        {card.full_name || "Your name"}
      </h1>
      {(card.job_title || card.company) && (
        <p className="mt-1 text-sm" style={{ color: muted }}>
          {card.job_title}
          {card.job_title && card.company ? " · " : ""}
          {card.company && <span style={{ color: fg, fontWeight: 600 }}>{card.company}</span>}
        </p>
      )}
      {card.bio && (
        <p className="mt-3 text-sm leading-relaxed" style={{ color: muted }}>
          {card.bio}
        </p>
      )}
    </div>
  );

  return (
    <div
      className="min-h-full w-full"
      style={{ background: bg, color: fg, fontFamily: fontCss(card.font) }}
    >
      {t === "banner" && (
        <div className="relative h-36" style={{ background: accent }}>
          <img
            src={logo}
            alt=""
            className="absolute right-4 top-4 h-9 max-w-[96px] rounded-md object-contain"
          />
        </div>
      )}
      <div className="mx-auto max-w-md px-6 pb-10">
        {t === "banner" ? (
          <div className="relative z-10 -mt-14 flex flex-col items-center gap-4">
            {avatar(112, true)}
            {header}
          </div>
        ) : t === "minimal" ? (
          <div className="flex flex-col gap-5 pt-10">
            <div className="flex items-center justify-between">
              {avatar(72)}
              <img src={logo} alt="" className="h-9 max-w-[110px] object-contain" />
            </div>
            <div className="h-1 w-10 rounded-full" style={{ background: accent }} />
            {header}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 pt-10">
            {avatar(112)}
            {header}
            <img src={logo} alt="" className="h-8 max-w-[120px] object-contain" />
          </div>
        )}

        {actions && <div className="mt-6">{actions}</div>}

        {rows.length > 0 && (
          <div className="mt-6 space-y-2">
            {rows.map((r, i) => (
              <a
                key={i}
                href={r.href}
                target={r.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                onClick={() => onLinkClick?.(r.kind)}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-opacity hover:opacity-80"
                style={{ background: tile }}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: accent, color: onAccent }}
                >
                  {r.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.text}</span>
                  {r.sub && (
                    <span className="block text-xs" style={{ color: muted }}>
                      {r.sub}
                    </span>
                  )}
                </span>
              </a>
            ))}
          </div>
        )}

        {card.links.filter((l) => l.url).length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-2">
            {card.links
              .filter((l) => l.url)
              .map((l, i) => (
                <a
                  key={l.id ?? i}
                  href={normalizeUrl(l.url)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onLinkClick?.(l.label || l.icon)}
                  className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-opacity hover:opacity-80"
                  style={{
                    borderColor: fg === "#FFFFFF" ? "rgba(255,255,255,0.14)" : "rgba(17,17,17,0.1)",
                  }}
                >
                  <LinkIcon icon={l.icon} className="h-4 w-4" />
                  <span className="truncate">{l.label || l.url}</span>
                </a>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
