import { appHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, subDays, startOfDay } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { listCards } from "@/lib/cards-api";
import { PremiumUpsell, usePlan } from "@/components/PremiumGate";
import { OS_LABELS, SOURCE_LABELS } from "@/lib/card-source";

export const Route = createFileRoute("/app/analytics")({
  head: appHead("Analytics", "Views, saves and share-backs for each of your cards."),
  component: Analytics,
});

const sinceIso = (days: number) => startOfDay(subDays(new Date(), days - 1)).toISOString();

type Series = {
  totals: { view: number; save: number; shareback: number; click: number };
  days: { day: string; view: number; save: number; shareback: number }[];
};

/** Totals and per-day counts, computed in the database (a plain select
 *  stops at 1,000 rows and would under-count). */
async function loadSeries(days: number, cardId: string): Promise<Series> {
  const { data, error } = await supabase.rpc("card_event_series", {
    p_since: sinceIso(days),
    ...(cardId === "all" ? {} : { p_card: cardId }),
  });
  if (error) throw error;
  return data as unknown as Series;
}

type Insights = {
  unique: number;
  devices: [string, number][];
  referrers: [string, number][];
  clicks: [string, number][];
  /** How they found the card (qr, email, link, nfc, web, direct). */
  sources?: [string, number][];
  /** "Jacksonville, FL"; city-level only. */
  places?: [string, number][];
  /** iphone, android, mac, ... */
  systems?: [string, number][];
};

const labelled = (rows: [string, number][] | undefined, labels: Record<string, string>) =>
  (rows ?? []).map(([k, n]) => [labels[k] ?? k, n] as [string, number]);

/** Premium breakdowns. The database checks the plan; visitor, device,
 *  referrer and link columns aren't readable any other way. */
async function loadInsights(days: number, cardId: string): Promise<Insights> {
  const { data, error } = await supabase.rpc("premium_card_insights", {
    p_since: sinceIso(days),
    ...(cardId === "all" ? {} : { p_card: cardId }),
  });
  if (error) throw error;
  return data as unknown as Insights;
}

function Analytics() {
  const [days, setDays] = useState(30);
  const [cardId, setCardId] = useState("all");
  const { isPremium } = usePlan();
  const { data: cards = [] } = useQuery({ queryKey: ["cards"], queryFn: listCards });
  const { data: series_ } = useQuery({
    queryKey: ["events", days, cardId],
    queryFn: () => loadSeries(days, cardId),
  });
  const { data: insights } = useQuery({
    queryKey: ["insights", days, cardId],
    enabled: isPremium,
    queryFn: () => loadInsights(days, cardId),
  });

  const totals = (series_?.totals ?? { view: 0, save: 0, shareback: 0, click: 0 }) as Record<
    string,
    number
  >;

  // Premium: unique visitors, devices, referrers and most-tapped links come
  // from the server; conversion only needs the counts everyone can read.
  const views = totals["view"] ?? 0;
  const captures = (totals["save"] ?? 0) + (totals["shareback"] ?? 0);
  const depth = {
    unique: insights?.unique ?? 0,
    conversion: views ? Math.round((captures / views) * 100) : 0,
    devices: insights?.devices ?? [],
    referrers: insights?.referrers ?? [],
    sources: labelled(insights?.sources, SOURCE_LABELS),
    places: insights?.places ?? [],
    // What they were on: the operating system when we have it, else phone/desktop.
    systems: insights?.systems?.length ? labelled(insights.systems, OS_LABELS) : null,
  };
  const topClicks = insights?.clicks ?? [];

  const series = useMemo(() => {
    const map = new Map<string, { day: string; view: number; save: number; shareback: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM d");
      map.set(d, { day: d, view: 0, save: 0, shareback: 0 });
    }
    for (const d of series_?.days ?? []) {
      // Days are UTC dates; label them the same way the axis does.
      const r = map.get(format(new Date(`${d.day}T12:00:00Z`), "MMM d"));
      if (r) {
        r.view += d.view;
        r.save += d.save;
        r.shareback += d.shareback;
      }
    }
    return Array.from(map.values());
  }, [series_, days]);

  const tiles = [
    { k: "view", label: "Views", hint: "opened your card", color: "var(--series-view)" },
    { k: "save", label: "Saves", hint: "added you to contacts", color: "var(--series-save)" },
    {
      k: "shareback",
      label: "Share-backs",
      hint: "sent you their details",
      color: "var(--series-shareback)",
    },
    { k: "click", label: "Link clicks", hint: "tapped a link", color: null },
  ];
  const SERIES = tiles.filter((t) => t.color) as { k: string; label: string; color: string }[];
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const cardName =
    cardId === "all" ? "all cards" : (cards.find((c) => c.id === cardId)?.label ?? "");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last {days} days · {cardName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={cardId} onValueChange={setCardId}>
            <SelectTrigger className="w-36 rounded-full" aria-label="Card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cards</SelectItem>
              {cards.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div role="radiogroup" aria-label="Time range" className="flex rounded-full bg-muted p-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={days === d}
                onClick={() => setDays(d)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  days === d
                    ? "bg-surface text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <div
            key={t.k}
            className={
              i === 0
                ? "dark relative overflow-hidden rounded-3xl bg-[#0B0D1C] p-5 text-foreground"
                : "surface rounded-3xl p-5"
            }
          >
            {i === 0 && (
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand/40 blur-2xl" />
            )}
            <p className="relative flex items-center gap-2 text-xs font-bold text-muted-foreground">
              {t.color && (
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
              )}
              {t.label}
            </p>
            <p className="relative mt-2 font-display text-4xl font-extrabold tabular-nums tracking-tight">
              {(totals[t.k] ?? 0).toLocaleString()}
            </p>
            <p className="relative mt-0.5 text-xs text-muted-foreground">{t.hint}</p>
          </div>
        ))}
      </div>

      <section className="surface rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-extrabold">Activity</h2>
          {/* Legend doubles as a series toggle. */}
          <div className="flex flex-wrap gap-2">
            {SERIES.map((sr) => {
              const off = hidden.has(sr.k);
              return (
                <button
                  key={sr.k}
                  type="button"
                  aria-pressed={!off}
                  onClick={() => toggle(sr.k)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-opacity ${
                    off ? "opacity-45" : ""
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: sr.color }} />
                  {sr.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
              <defs>
                {SERIES.map((sr) => (
                  <linearGradient key={sr.k} id={`fill-${sr.k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sr.color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={sr.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.4 }}
                contentStyle={{
                  background: "var(--popover)",
                  color: "var(--popover-foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  fontSize: 12,
                  boxShadow: "var(--shadow-float)",
                }}
                itemStyle={{ color: "var(--popover-foreground)", padding: 0 }}
                labelStyle={{ fontWeight: 700, marginBottom: 2 }}
              />
              {SERIES.filter((sr) => !hidden.has(sr.k)).map((sr) => (
                <Area
                  key={sr.k}
                  type="monotone"
                  dataKey={sr.k}
                  name={sr.label}
                  stroke={sr.color}
                  fill={`url(#fill-${sr.k})`}
                  strokeWidth={2}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {!isPremium && (
        <div className="mt-6">
          <PremiumUpsell feature="Advanced analytics — unique visitors, view-to-capture conversion, how people found you, where they were, devices, referrers and most-tapped links —" />
        </div>
      )}
      {isPremium && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="surface rounded-3xl p-5">
            <p className="text-xs font-bold text-muted-foreground">Unique visitors</p>
            <p className="mt-2 font-display text-4xl font-extrabold tabular-nums tracking-tight">
              {depth.unique.toLocaleString()}
            </p>
          </div>
          <div className="rounded-3xl bg-pop-lime p-5 text-[#0E1230]">
            <p className="text-xs font-bold opacity-70">View → capture</p>
            <p className="mt-2 font-display text-4xl font-extrabold tabular-nums tracking-tight">
              {depth.conversion}%
            </p>
            <p className="mt-0.5 text-xs opacity-70">of views became a save or share-back</p>
          </div>
        </div>
      )}
      {isPremium && (depth.sources.length > 0 || depth.places.length > 0) && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {depth.sources.length > 0 && <BarList title="How they found you" rows={depth.sources} />}
          {depth.places.length > 0 && <BarList title="Where they were" rows={depth.places} />}
        </div>
      )}
      {isPremium && topClicks.length > 0 && (
        <BarList className="mt-6" title="Most-tapped links" rows={topClicks} />
      )}
      {isPremium && (depth.devices.length > 0 || depth.referrers.length > 0) && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {depth.systems ? (
            <BarList title="Devices" rows={depth.systems} />
          ) : (
            depth.devices.length > 0 && <BarList title="Devices" rows={depth.devices} capitalize />
          )}
          {depth.referrers.length > 0 && <BarList title="Top referrers" rows={depth.referrers} />}
        </div>
      )}
      {isPremium && (
        <p className="mt-6 text-xs text-muted-foreground">
          Your own visits aren't counted on any browser where you've opened QuickieQR. Locations are
          approximate (city level) and no IP addresses are stored.
        </p>
      )}
    </div>
  );
}

/** Ranked list with a proportional bar behind each row's label. */
function BarList({
  title,
  rows,
  capitalize,
  className = "",
}: {
  title: string;
  rows: [string, number][];
  capitalize?: boolean;
  className?: string;
}) {
  const max = rows[0]?.[1] || 1;
  return (
    <section className={`surface rounded-3xl p-5 ${className}`}>
      <h2 className="mb-3 font-display text-base font-extrabold">{title}</h2>
      <ul className="space-y-1.5">
        {rows.map(([label, count]) => (
          <li
            key={label}
            className="relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2 text-sm"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 rounded-xl bg-brand-soft"
              style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
            />
            <span
              className={`relative min-w-0 flex-1 truncate font-medium ${capitalize ? "capitalize" : ""}`}
            >
              {label}
            </span>
            <span className="relative tabular-nums font-semibold">{count.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
