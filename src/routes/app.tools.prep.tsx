import { appHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { Checklist, Openers, Sheet } from "@/components/prep/PrepPanels";
import {
  MAX_STARRED,
  emptySheet,
  emptyState,
  parseState,
  starredOpeners,
  toggleChecked,
  toggleStarred,
  type GoalSheet,
  type PrepContent,
  type PrepState,
} from "@/lib/event-prep";
import { getEventPrep } from "@/lib/event-prep.functions";

export const Route = createFileRoute("/app/tools/prep")({
  head: appHead("Event prep", "Your pre-event checklist, conversation openers and goal sheet."),
  component: PrepPage,
});

type Tab = "checklist" | "openers" | "sheet";

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked; the page still works for this visit.
  }
}

function isContent(v: unknown): v is PrepContent {
  const c = v as PrepContent | null;
  return (
    !!c && Array.isArray(c.checklist?.sections) && Array.isArray(c.openers?.groups) && !!c.goalSheet
  );
}

function PrepPage() {
  const { user } = useAuth();
  const uid = user?.id;
  const contentKey = `ck-event-prep-content:${uid}`;
  const stateKey = `ck-event-prep-state:${uid}`;

  // A copy is kept on the device, so the page opens at a venue with no signal.
  const [saved, setSaved] = useState<PrepContent | null>(null);
  const [state, setState] = useState<PrepState>(emptyState);
  const loaded = useRef(false);
  const [tab, setTab] = useState<Tab>("checklist");

  useEffect(() => {
    if (!uid) return;
    const cached = readJson(contentKey);
    setSaved(isContent(cached) ? cached : null);
    setState(parseState(readJson(stateKey)));
    loaded.current = true;
  }, [uid, contentKey, stateKey]);

  useEffect(() => {
    if (uid && loaded.current) writeJson(stateKey, state);
  }, [uid, stateKey, state]);

  const q = useQuery({
    queryKey: ["event-prep", uid],
    enabled: !!uid,
    retry: 1,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await getEventPrep();
      if (r.locked) {
        try {
          localStorage.removeItem(contentKey);
        } catch {
          // Nothing saved to clear.
        }
      } else {
        writeJson(contentKey, r.content);
      }
      return r;
    },
  });

  const locked = q.data?.locked === true;
  const content = q.data && !q.data.locked ? q.data.content : locked ? null : saved;

  const patch = (p: Partial<PrepState>) => setState((s) => ({ ...s, ...p }));
  const setSheet = (p: Partial<GoalSheet>) =>
    setState((s) => ({ ...s, sheet: { ...s.sheet, ...p } }));

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/app/tools"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Tools
      </Link>
      <h1 className="mb-1 text-2xl font-bold">Event prep</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Your checklist, openers and goal sheet, ready the moment you need them.
      </p>

      {locked ? (
        <div className="surface flex flex-col items-start gap-3 border-dashed p-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-foreground">
            <Lock className="h-3.5 w-3.5" />
            Included with any paid plan
          </span>
          <p className="text-sm text-muted-foreground">
            The pre-event checklist, 20 conversation openers and the "who I want to meet" goal
            sheet, on your phone at the event. It comes with Pro, Premium, a team seat, or any
            purchase on your account.
          </p>
          <Link
            to="/app/settings"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" />
            See plans
          </Link>
        </div>
      ) : !content ? (
        q.isError ? (
          <div className="surface space-y-3 p-5">
            <p className="text-sm">
              Event prep couldn't load. Check your connection and try again.
            </p>
            <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )
      ) : (
        <>
          {q.isError && (
            <p className="mb-4 text-xs text-muted-foreground" role="status">
              You're offline, so this is the copy saved on this device.
            </p>
          )}
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="mb-6 grid w-full grid-cols-3">
              <TabsTrigger value="checklist">Checklist</TabsTrigger>
              <TabsTrigger value="openers">Openers</TabsTrigger>
              <TabsTrigger value="sheet">Goal sheet</TabsTrigger>
            </TabsList>
            <TabsContent value="checklist">
              <Checklist
                content={content}
                checked={state.checked}
                onToggle={(id) => patch({ checked: toggleChecked(state.checked, id) })}
                onReset={() => patch({ checked: [], sheet: emptySheet() })}
              />
            </TabsContent>
            <TabsContent value="openers">
              <Openers
                content={content}
                starred={state.starred}
                onToggle={(n) => {
                  if (!state.starred.includes(n) && state.starred.length >= MAX_STARRED) {
                    toast.info("You've picked three. Unstar one to swap it.");
                    return;
                  }
                  patch({ starred: toggleStarred(state.starred, n) });
                }}
              />
            </TabsContent>
            <TabsContent value="sheet">
              <Sheet
                content={content}
                sheet={state.sheet}
                openers={starredOpeners(content, state.starred)}
                onChange={setSheet}
                onPickOpeners={() => setTab("openers")}
              />
            </TabsContent>
          </Tabs>
          <p className="mt-8 text-xs text-muted-foreground">
            Your ticks, stars and goal sheet are saved on this device.
          </p>
        </>
      )}
    </div>
  );
}
