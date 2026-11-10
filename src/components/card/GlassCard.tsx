import { ChevronDown, Globe, Mail, MapPin, Phone } from "lucide-react";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { initials, normalizeUrl, type CardData } from "@/lib/card-model";
import { resolveTheme } from "@/lib/card-theme";
import { ICON_LABELS, LinkIcon } from "./LinkIcon";

// Links that read as an icon become compact tiles; everything else is a
// wide tile with its label.
const SOCIAL_ICONS = new Set([
  "linkedin",
  "x",
  "instagram",
  "youtube",
  "tiktok",
  "facebook",
  "github",
]);

type Row = { kind: string; verb: string; icon: ReactNode; text: string; sub: string; href: string };

function contactRows(card: CardData): Row[] {
  return [
    ...card.phones
      .filter((p) => p.value)
      .map((p) => ({
        kind: "phone",
        verb: "Call",
        icon: <Phone aria-hidden />,
        text: p.value,
        sub: p.label || "Phone",
        href: `tel:${p.value.replace(/\s/g, "")}`,
      })),
    ...card.emails
      .filter((e) => e.value)
      .map((e) => ({
        kind: "email",
        verb: "Email",
        icon: <Mail aria-hidden />,
        text: e.value,
        sub: e.label || "Email",
        href: `mailto:${e.value}`,
      })),
    ...(card.website
      ? [
          {
            kind: "website",
            verb: "Open",
            icon: <Globe aria-hidden />,
            text: card.website.replace(/^https?:\/\//, ""),
            sub: "Website",
            href: normalizeUrl(card.website),
          },
        ]
      : []),
    ...(card.location
      ? [
          {
            kind: "location",
            verb: "Map",
            icon: <MapPin aria-hidden />,
            text: card.location,
            sub: "Location",
            href: `https://maps.google.com/?q=${encodeURIComponent(card.location)}`,
          },
        ]
      : []),
  ];
}

const external = (href: string) =>
  href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {};

/** The Liquid Glass layout. All of its look comes from the custom properties
 *  resolveTheme() derives from the card, so the editor preview and the public
 *  page cannot drift apart. */
export function GlassCard({
  card,
  headshotUrl,
  logoUrl,
  verified,
  actions,
  onLinkClick,
}: {
  card: CardData;
  headshotUrl?: string | null | undefined;
  logoUrl?: string | null | undefined;
  /** Decided by the server (get_public_card); never by the card owner. */
  verified?: boolean | undefined;
  actions?: ReactNode;
  onLinkClick?: ((label: string) => void) | undefined;
}) {
  const { theme, vars } = resolveTheme(card);
  const [open, setOpen] = useState(false);
  const detailsId = useId();

  const rows = contactRows(card);
  // One quick button per kind (the first phone, the first email, …).
  const quick = rows.filter((r, i) => rows.findIndex((x) => x.kind === r.kind) === i);
  const links = card.links.filter((l) => l.url);
  const social = links.filter((l) => SOCIAL_ICONS.has(l.icon));
  const portfolio = links.filter((l) => !SOCIAL_ICONS.has(l.icon));
  const logo = logoUrl || "/brand/logo-badge.webp";
  const logoHeight = logoUrl ? (card.logo_size === "large" ? 56 : 40) : 28;

  return (
    <div className="ck-glass-card" style={vars as CSSProperties}>
      <div className="ck-mesh" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <svg key={n} className={`ck-blob ck-blob-${n}`} viewBox="0 0 200 200" focusable="false">
            <ellipse
              cx="100"
              cy="100"
              rx={n % 2 ? 96 : 84}
              ry={n % 2 ? 80 : 96}
              transform={`rotate(${n * 37} 100 100)`}
              fill={`var(--ck-mesh-${n})`}
            />
          </svg>
        ))}
      </div>

      <div className="ck-glass-body">
        <header className="ck-glass ck-head">
          <div className="ck-avatar-wrap">
            <div className="ck-avatar-ring">
              <div className="ck-avatar">
                {headshotUrl ? (
                  <img src={headshotUrl} alt={card.full_name} />
                ) : (
                  initials(card.full_name || "?")
                )}
              </div>
            </div>
            {theme.status && (
              <span className="ck-status">
                <i aria-hidden />
                <span>{theme.status}</span>
              </span>
            )}
          </div>
          <h1 className="ck-name">
            {card.full_name || "Your name"}
            {verified && (
              <span className="ck-verified" title="Verified">
                <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Verified">
                  <path d="M12 2l2.4 1.8 3-.2 1 2.8 2.5 1.6-.8 2.9.8 2.9-2.5 1.6-1 2.8-3-.2L12 22l-2.4-1.8-3 .2-1-2.8-2.5-1.6.8-2.9-.8-2.9 2.5-1.6 1-2.8 3 .2z" />
                  <path
                    d="M8.5 12.2l2.4 2.4 4.6-4.9"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}
          </h1>
          {(card.job_title || card.company) && (
            <p className="ck-role">
              {card.job_title}
              {card.job_title && card.company ? " · " : ""}
              {card.company && <b>{card.company}</b>}
            </p>
          )}
          {card.bio && <p className="ck-bio">{card.bio}</p>}
          <img
            className="ck-logo"
            src={logo}
            alt={card.company ? `${card.company} logo` : "Company logo"}
            style={{ height: logoHeight }}
          />
        </header>

        {actions && <div className="ck-glass ck-actions">{actions}</div>}

        {rows.length > 0 && (
          <section className="ck-glass ck-contact" aria-label="Contact">
            <div className="ck-quick">
              {quick.map((r) => (
                <a
                  key={r.kind}
                  className="ck-quick-btn"
                  href={r.href}
                  {...external(r.href)}
                  aria-label={`${r.verb} ${r.text}`}
                  onClick={() => onLinkClick?.(r.kind)}
                >
                  {r.icon}
                </a>
              ))}
              <button
                type="button"
                className="ck-toggle"
                aria-expanded={open}
                aria-controls={detailsId}
                onClick={() => setOpen((o) => !o)}
              >
                Details
                <ChevronDown aria-hidden />
              </button>
            </div>
            <div className="ck-details" id={detailsId} hidden={!open}>
              {rows.map((r, i) => (
                <a
                  key={i}
                  className="ck-row"
                  href={r.href}
                  {...external(r.href)}
                  onClick={() => onLinkClick?.(r.kind)}
                >
                  <span className="ck-row-icon">{r.icon}</span>
                  <span className="ck-row-text">
                    <b>{r.text}</b>
                    <small>{r.sub}</small>
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {links.length > 0 && (
          <section className="ck-glass ck-links" aria-label="Links">
            {social.length > 0 && (
              <div className="ck-social">
                {social.map((l, i) => (
                  <a
                    key={l.id ?? i}
                    className="ck-tile"
                    href={normalizeUrl(l.url)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => onLinkClick?.(l.label || l.icon)}
                  >
                    <LinkIcon icon={l.icon} />
                    <span>{l.label || ICON_LABELS[l.icon] || "Link"}</span>
                  </a>
                ))}
              </div>
            )}
            {portfolio.length > 0 && (
              <div className="ck-portfolio">
                {portfolio.map((l, i) => (
                  <a
                    key={l.id ?? i}
                    className="ck-wide"
                    href={normalizeUrl(l.url)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => onLinkClick?.(l.label || l.icon)}
                  >
                    <LinkIcon icon={l.icon} />
                    <span>{l.label || l.url}</span>
                  </a>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
