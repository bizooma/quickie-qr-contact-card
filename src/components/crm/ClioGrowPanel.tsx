import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CLIO_REGIONS, CLIO_REGION_NAMES, type ClioRegion } from "@/lib/crm";
import {
  connectClioGrow,
  disconnectClioGrow,
  getCrmState,
  sendContactToClio,
} from "@/lib/crm.functions";
import { PRO_PRICE_LABEL } from "@/lib/plans";

const CRM_STATE_KEY = ["crm-state"];

function useCrmState() {
  return useQuery({ queryKey: CRM_STATE_KEY, queryFn: () => getCrmState(), staleTime: 60_000 });
}

/** Settings: connect Clio Grow. Shown only on accounts with an attorney card;
 *  the token goes straight to the server and only its last 4 come back. */
export function ClioGrowPanel() {
  const qc = useQueryClient();
  const { data: state } = useCrmState();
  const [token, setToken] = useState("");
  const [region, setRegion] = useState<ClioRegion>("us");
  const [busy, setBusy] = useState(false);
  if (!state?.eligible) return null;

  async function connect() {
    setBusy(true);
    try {
      await connectClioGrow({ data: { token, region } });
      setToken("");
      toast.success(
        "Clio Grow connected. New share-backs from your attorney cards go to your Lead Inbox.",
      );
      await qc.invalidateQueries({ queryKey: CRM_STATE_KEY });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't connect Clio Grow");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await disconnectClioGrow();
      toast.success("Clio Grow disconnected");
      await qc.invalidateQueries({ queryKey: CRM_STATE_KEY });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center gap-2">
        <Scale className="h-4 w-4 text-brand" />
        <h3 className="text-sm font-semibold">Clio Grow</h3>
      </div>

      {!state.paid ? (
        <p className="text-sm text-muted-foreground">
          Send every share-back from your attorney cards straight into your Clio Grow Lead Inbox.
          Comes with Pro ({PRO_PRICE_LABEL}).
        </p>
      ) : state.clio ? (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Connected ({CLIO_REGION_NAMES[state.clio.region as ClioRegion] ?? state.clio.region}
            {state.clio.hint ? `, token ending ${state.clio.hint}` : ""})
          </p>
          {state.clio.lastError && (
            <p className="flex gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Last send failed: {state.clio.lastError}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Share-backs from your attorney cards go to your Lead Inbox automatically. To send
            someone you scanned or added, open the contact and tap Send to Clio Grow.
          </p>
          <Button variant="outline" size="sm" disabled={busy} onClick={disconnect}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Send every share-back from your attorney cards straight into your Clio Grow Lead Inbox.
            In Clio Grow, open <b>Settings → Integrations</b> and copy the <b>Lead capture token</b>
            .
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <Label htmlFor="clio-token">Lead capture token</Label>
              <Input
                id="clio-token"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="clio-region">Clio region</Label>
              <select
                id="clio-region"
                value={region}
                onChange={(e) => setRegion(e.target.value as ClioRegion)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                {CLIO_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {CLIO_REGION_NAMES[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button size="sm" disabled={busy || token.trim().length < 8} onClick={connect}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Connect Clio Grow
          </Button>
          <p className="text-xs text-muted-foreground">
            We check the token with Clio without creating a test lead. It's stored on our servers
            only and never shown again.
          </p>
        </div>
      )}
    </div>
  );
}

/** On a contact: whether it reached Clio Grow, with Send / Resend. Shown only
 *  when Clio Grow is connected, and only on the user's own contacts. */
export function ClioContactRow({ contactId, own }: { contactId: string; own: boolean }) {
  const { data: state } = useCrmState();
  const connected = !!state?.paid && !!state.clio && own;
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data: last } = useQuery({
    queryKey: ["crm-delivery", contactId],
    enabled: connected,
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("crm_deliveries")
        .select("ok, error, created_at")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  if (!connected) return null;

  async function send() {
    setBusy(true);
    try {
      await sendContactToClio({ data: { contactId } });
      toast.success("Sent to your Clio Grow Lead Inbox");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send to Clio Grow");
    } finally {
      setBusy(false);
      await qc.invalidateQueries({ queryKey: ["crm-delivery", contactId] });
      await qc.invalidateQueries({ queryKey: CRM_STATE_KEY });
    }
  }

  const when = last ? new Date(last.created_at).toLocaleDateString() : "";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3">
      <div className="min-w-0 text-sm">
        <p className="flex items-center gap-1.5 font-semibold">
          <Scale className="h-4 w-4 text-brand" /> Clio Grow
        </p>
        <p className="text-xs text-muted-foreground">
          {!last
            ? "Not sent yet."
            : last.ok
              ? `In your Lead Inbox (sent ${when}).`
              : `Last try failed ${when}: ${last.error ?? "unknown error"}`}
        </p>
      </div>
      <Button variant="outline" size="sm" disabled={busy} onClick={send}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {!last ? "Send to Clio Grow" : last.ok ? "Send again" : "Resend"}
      </Button>
    </div>
  );
}
