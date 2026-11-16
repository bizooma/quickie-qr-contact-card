import { appHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Check, MessageSquarePlus, Rocket, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  cleanRequest,
  itemsForStage,
  REQUEST_MAX,
  requestStatusLabel,
  ROADMAP_STAGES,
  type RoadmapStage,
} from "@/lib/roadmap";
import { submitFeatureRequest } from "@/lib/roadmap.functions";

export const Route = createFileRoute("/app/roadmap")({
  head: appHead("Roadmap & requests", "What's coming next, and a place to ask for what you need."),
  component: RoadmapPage,
});

function RoadmapPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: counts = {} } = useQuery({
    queryKey: ["roadmap-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("roadmap_vote_counts");
      if (error) throw error;
      return (data ?? {}) as Record<string, number>;
    },
  });
  const { data: mine = [] } = useQuery({
    queryKey: ["roadmap-votes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("roadmap_votes").select("item_key");
      if (error) throw error;
      return (data ?? []).map((v) => v.item_key);
    },
  });
  const { data: requests = [] } = useQuery({
    queryKey: ["feature-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_requests")
        .select("id, body, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [voting, setVoting] = useState<string | null>(null);
  async function toggleVote(key: string) {
    if (!user) return;
    setVoting(key);
    const has = mine.includes(key);
    const { error } = has
      ? await supabase.from("roadmap_votes").delete().eq("user_id", user.id).eq("item_key", key)
      : await supabase.from("roadmap_votes").insert({ user_id: user.id, item_key: key });
    setVoting(null);
    if (error) {
      toast.error("Couldn't save that. Please try again.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["roadmap-votes"] });
    qc.invalidateQueries({ queryKey: ["roadmap-counts"] });
  }

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    // Same check the server makes, so a too-short note gets a helpful answer at once.
    const cleaned = cleanRequest(text);
    if (!cleaned.ok) {
      toast.error(cleaned.error);
      return;
    }
    setSending(true);
    try {
      await submitFeatureRequest({ data: { text } });
      setText("");
      toast.success("Thanks — your request is in. We read every one.");
      qc.invalidateQueries({ queryKey: ["feature-requests"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send your request.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-10 pb-10">
      <div>
        <Link
          to="/app/settings"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Settings
        </Link>
        <h1 className="text-3xl font-bold">Roadmap & requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What we're building next. Tap “I want this” on the ones you'd use — the most-wanted get
          built first.
        </p>
      </div>

      {(Object.keys(ROADMAP_STAGES) as RoadmapStage[]).map((stage) => (
        <section key={stage} className="space-y-3">
          <h2 className="text-lg font-bold">{ROADMAP_STAGES[stage]}</h2>
          <ul className="surface divide-y">
            {itemsForStage(stage, counts).map((item) => {
              const voted = mine.includes(item.key);
              const n = counts[item.key] ?? 0;
              return (
                <li key={item.key} className="flex items-start gap-3 px-4 py-3">
                  <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {item.title}
                      {item.plans && (
                        <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-brand-soft px-2 py-0.5 align-middle text-[10px] font-bold text-foreground">
                          {item.plans}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={voted ? "default" : "outline"}
                    className="shrink-0"
                    disabled={voting === item.key}
                    aria-pressed={voted}
                    aria-label={`${voted ? "Remove your vote for" : "I want"} ${item.title}`}
                    onClick={() => void toggleVote(item.key)}
                  >
                    {voted ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <ThumbsUp className="h-3.5 w-3.5" />
                    )}
                    {voted ? "Wanted" : "I want this"}
                    {n > 0 && <span className="tabular-nums opacity-70">· {n}</span>}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Request a feature</h2>
        <form onSubmit={sendRequest} className="surface space-y-3 p-4">
          <Label htmlFor="feature-request">
            What would make QuickieQR more useful to you?
          </Label>
          <Textarea
            id="feature-request"
            value={text}
            maxLength={REQUEST_MAX}
            rows={4}
            placeholder="e.g. Let me tag everyone I scanned at one event in one go."
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">
              {text.length}/{REQUEST_MAX}
            </span>
            <Button type="submit" disabled={sending || text.trim().length === 0}>
              <MessageSquarePlus className="h-4 w-4" />
              {sending ? "Sending…" : "Send request"}
            </Button>
          </div>
        </form>
      </section>

      {requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Your requests</h2>
          <ul className="surface divide-y">
            {requests.map((r) => (
              <li key={r.id} className="space-y-1 px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{format(new Date(r.created_at), "MMM d, yyyy")}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-foreground">
                    {requestStatusLabel(r.status)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{r.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
