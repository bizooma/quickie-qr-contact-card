import { appHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, subDays, startOfDay } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { listCards } from "@/lib/cards-api";
import { PremiumUpsell, usePlan } from "@/components/PremiumGate";

export const Route = createFileRoute("/app/analytics")({ head: appHead('Analytics', 'Views, saves and share-backs for each of your cards.'), component: Analytics });

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
};

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
    { k: "view", label: "Views" },
    { k: "save", label: "Contact saves" },
    { k: "shareback", label: "Share-backs" },
    { k: "click", label: "Link clicks" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <div className="flex gap-2">
          <Select value={cardId} onValueChange={setCardId}>
            <SelectTrigger className="w-36">
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
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.k} className="surface p-4">
            <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{totals[t.k] ?? 0}</p>
          </div>
        ))}
        {isPremium && (
          <>
            <div className="surface p-4">
              <p className="text-xs font-medium text-muted-foreground">Unique visitors</p>
              <p className="mt-1 font-display text-3xl font-bold">{depth.unique}</p>
            </div>
            <div className="surface p-4">
              <p className="text-xs font-medium text-muted-foreground">View → capture</p>
              <p className="mt-1 font-display text-3xl font-bold">{depth.conversion}%</p>
            </div>
          </>
        )}
      </div>
      <div className="surface p-4">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="view"
                name="Views"
                stroke="var(--chart-1)"
                fill="var(--chart-1)"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="save"
                name="Saves"
                stroke="var(--chart-3)"
                fill="var(--chart-3)"
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="shareback"
                name="Share-backs"
                stroke="var(--chart-2)"
                fill="var(--chart-2)"
                fillOpacity={0.05}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      {!isPremium && (
        <div className="mt-6">
          <PremiumUpsell feature="Advanced analytics — unique visitors, view-to-capture conversion, devices, referrers and most-tapped links —" />
        </div>
      )}
      {isPremium && topClicks.length > 0 && (
        <div className="surface mt-6 p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Most-tapped links</p>
          <ul className="space-y-2">
            {topClicks.map(([label, count]) => (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
                <span
                  className="h-1.5 rounded-full bg-brand/70"
                  style={{ width: `${Math.max(8, (count / (topClicks[0]?.[1] ?? 1)) * 160)}px` }}
                />
                <span className="w-8 text-right tabular-nums text-muted-foreground">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {isPremium && (depth.devices.length > 0 || depth.referrers.length > 0) && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {depth.devices.length > 0 && (
            <div className="surface p-4">
              <p className="mb-3 text-xs font-medium text-muted-foreground">Devices</p>
              <ul className="space-y-2">
                {depth.devices.map(([device, count]) => (
                  <li key={device} className="flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium capitalize">{device}</span>
                    <span
                      className="h-1.5 rounded-full bg-brand/70"
                      style={{
                        width: `${Math.max(8, (count / (depth.devices[0]?.[1] ?? 1)) * 120)}px`,
                      }}
                    />
                    <span className="w-8 text-right tabular-nums text-muted-foreground">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {depth.referrers.length > 0 && (
            <div className="surface p-4">
              <p className="mb-3 text-xs font-medium text-muted-foreground">Top referrers</p>
              <ul className="space-y-2">
                {depth.referrers.map(([ref, count]) => (
                  <li key={ref} className="flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{ref}</span>
                    <span className="w-8 text-right tabular-nums text-muted-foreground">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
