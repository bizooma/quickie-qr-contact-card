import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, subDays, startOfDay } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { listCards } from "@/lib/cards-api";

export const Route = createFileRoute("/app/analytics")({ component: Analytics });

async function loadEvents(days: number) {
  const since = startOfDay(subDays(new Date(), days - 1)).toISOString();
  const { data, error } = await supabase.from("card_views").select("card_id, event_type, created_at").gte("created_at", since).limit(10000);
  if (error) throw error;
  return data;
}

function Analytics() {
  const [days, setDays] = useState(30);
  const [cardId, setCardId] = useState("all");
  const { data: cards = [] } = useQuery({ queryKey: ["cards"], queryFn: listCards });
  const { data: events = [] } = useQuery({ queryKey: ["events", days], queryFn: () => loadEvents(days) });

  const filtered = cardId === "all" ? events : events.filter((e) => e.card_id === cardId);
  const totals = { view: 0, save: 0, shareback: 0 } as Record<string, number>;
  for (const e of filtered) totals[e.event_type] = (totals[e.event_type] ?? 0) + 1;

  const series = useMemo(() => {
    const map = new Map<string, { day: string; view: number; save: number; shareback: number }>();
    for (let i = days - 1; i >= 0; i--) { const d = format(subDays(new Date(), i), "MMM d"); map.set(d, { day: d, view: 0, save: 0, shareback: 0 }); }
    for (const e of filtered) { const r = map.get(format(new Date(e.created_at), "MMM d")); if (r) r[e.event_type as "view"]++; }
    return Array.from(map.values());
  }, [filtered, days]);

  const tiles = [
    { k: "view", label: "Views" }, { k: "save", label: "Contact saves" }, { k: "shareback", label: "Share-backs" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <div className="flex gap-2">
          <Select value={cardId} onValueChange={setCardId}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All cards</SelectItem>{cards.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">7 days</SelectItem><SelectItem value="30">30 days</SelectItem><SelectItem value="90">90 days</SelectItem></SelectContent></Select>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-3 gap-3">
        {tiles.map((t) => (
          <div key={t.k} className="surface p-4"><p className="text-xs font-medium text-muted-foreground">{t.label}</p><p className="mt-1 font-display text-3xl font-bold">{totals[t.k] ?? 0}</p></div>
        ))}
      </div>
      <div className="surface p-4">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="view" name="Views" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="save" name="Saves" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.1} strokeWidth={2} />
              <Area type="monotone" dataKey="shareback" name="Share-backs" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.05} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
