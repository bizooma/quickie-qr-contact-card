import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  autoTipFor,
  boldParts,
  detectPlatform,
  mergeDismissed,
  stepsFor,
  TIPS,
  tipIdForPath,
  withAnnouncements,
  type Platform,
  type TipId,
} from "@/lib/feature-tips";

// Per-screen "how this works" popups. A tip opens by itself the first time
// a screen is visited in a session, until the user ticks "Don't show this
// again" (saved on their profile, so it holds on every device). The Tips
// button, or openTip(id) from a page, reopens it any time.

const OPEN_EVENT = "ck:open-tip";
const SEEN_PREFIX = "ck-tip-seen:";
const localKey = (userId: string) => `ck-tips-dismissed:${userId}`;

/** Opens a tip from anywhere in the app (e.g. a "how do I…" link). */
export function openTip(id: TipId) {
  window.dispatchEvent(new CustomEvent<TipId>(OPEN_EVENT, { detail: id }));
}

function readLocal(userId: string): TipId[] {
  try {
    return mergeDismissed(JSON.parse(localStorage.getItem(localKey(userId)) ?? "[]"));
  } catch {
    return [];
  }
}

function writeLocal(userId: string, ids: TipId[]) {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(ids));
  } catch {
    // Cache only; the profile is the source of truth.
  }
}

function seenThisSession(id: TipId): boolean {
  try {
    return sessionStorage.getItem(SEEN_PREFIX + id) === "1";
  } catch {
    return false;
  }
}

function markSeen(id: TipId) {
  try {
    sessionStorage.setItem(SEEN_PREFIX + id, "1");
  } catch {
    // Worst case the tip shows again on the next visit this session.
  }
}

export function useDismissedTips() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["dismissed-tips", user?.id];
  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("dismissed_tips")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      const ids = mergeDismissed(data?.dismissed_tips);
      writeLocal(user!.id, ids);
      return ids;
    },
  });
  // Until the profile loads, the device cache avoids a flash of tips.
  const dismissed = query.data ?? (user ? readLocal(user.id) : []);

  async function save(next: TipId[]) {
    if (!user) return;
    writeLocal(user.id, next);
    qc.setQueryData(key, next);
    await supabase.from("profiles").update({ dismissed_tips: next }).eq("id", user.id);
  }

  return {
    dismissed,
    // Only auto-open once we know the real answer (or the fetch failed).
    ready: query.isSuccess || query.isError,
    setDismissed: (id: TipId, on: boolean) =>
      save(
        on ? withAnnouncements(mergeDismissed(dismissed, [id])) : dismissed.filter((d) => d !== id),
      ),
    resetAll: async () => {
      try {
        for (const id of Object.keys(TIPS)) sessionStorage.removeItem(SEEN_PREFIX + id);
      } catch {
        // Session flags only delay a tip; nothing to recover.
      }
      await save([]);
    },
  };
}

/** Mounted once in the app layout: the Tips button plus the popup. */
export function FeatureTips() {
  const { pathname } = useLocation();
  const pageTip = tipIdForPath(pathname);
  const { dismissed, ready, setDismissed } = useDismissedTips();
  const [open, setOpen] = useState<TipId | null>(null);

  // First visit this session → open by itself, unless turned off. Someone
  // who turned the screen tip off may still get its one-time "what's new".
  useEffect(() => {
    setOpen(null);
    const auto = ready ? autoTipFor(pathname, dismissed) : null;
    if (!auto || seenThisSession(auto)) return;
    const t = setTimeout(() => {
      markSeen(auto);
      setOpen(auto);
    }, 600);
    return () => clearTimeout(t);
    // Re-run on navigation and once loaded, not when the list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, ready]);

  useEffect(() => {
    const onOpen = (e: Event) => setOpen((e as CustomEvent<TipId>).detail);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  return (
    <>
      {pageTip && (
        <div className="-mt-2 mb-2 flex justify-end md:-mt-4">
          <button
            type="button"
            onClick={() => setOpen(pageTip)}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Tips
          </button>
        </div>
      )}
      {open && (
        <TipDialog
          key={open}
          id={open}
          dismissed={dismissed.includes(open)}
          onClose={(neverAgain) => {
            if (neverAgain !== dismissed.includes(open)) void setDismissed(open, neverAgain);
            setOpen(null);
          }}
        />
      )}
    </>
  );
}

function Bold({ text }: { text: string }) {
  return (
    <>
      {boldParts(text).map((p, i) =>
        p.bold ? (
          <strong key={i} className="font-semibold text-foreground">
            {p.text}
          </strong>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "ios", label: "iPhone" },
  { id: "android", label: "Android" },
  { id: "desktop", label: "Computer" },
];

function TipDialog({
  id,
  dismissed,
  onClose,
}: {
  id: TipId;
  dismissed: boolean;
  onClose: (neverAgain: boolean) => void;
}) {
  const tip = TIPS[id];
  const announcement = "announcement" in tip && tip.announcement === true;
  const [platform, setPlatform] = useState<Platform>(() =>
    detectPlatform(navigator.userAgent, navigator.maxTouchPoints),
  );
  // Announcements are one-time: closing one always turns it off.
  const [neverAgain, setNeverAgain] = useState(dismissed || announcement);
  const steps = stepsFor(tip, platform);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(neverAgain)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-brand" />
            {tip.title}
          </DialogTitle>
          <DialogDescription>{tip.intro}</DialogDescription>
        </DialogHeader>
        {"platformTabs" in tip && tip.platformTabs && (
          <div className="inline-flex self-start rounded-xl border p-0.5" role="tablist">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={platform === p.id}
                onClick={() => setPlatform(p.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${platform === p.id ? "bg-brand-soft text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        <ol className="space-y-3 text-sm text-muted-foreground">
          {steps.map((s, i) => (
            <li key={s.text} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-foreground">
                {i + 1}
              </span>
              <span className="pt-0.5 leading-relaxed">
                <Bold text={s.text} />
              </span>
            </li>
          ))}
        </ol>
        {"help" in tip && tip.help && (
          <a
            href={`/help#${tip.help}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground"
          >
            More in the Help Center <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <DialogFooter className="flex-row items-center justify-between gap-3 sm:justify-between">
          {announcement ? (
            <span />
          ) : (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={neverAgain} onCheckedChange={(v) => setNeverAgain(v === true)} />
              Don&apos;t show this again
            </label>
          )}
          <Button onClick={() => onClose(neverAgain)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
