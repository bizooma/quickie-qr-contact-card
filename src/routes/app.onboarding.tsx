import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { createCard } from "@/lib/cards-api";

export const Route = createFileRoute("/app/onboarding")({ component: Onboarding });

function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const meta = user?.user_metadata ?? {};
  const [f, setF] = useState({ full_name: (meta["full_name"] as string) ?? (meta["name"] as string) ?? "", job_title: "", company: "", label: "Work" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const card = await createCard(user.id, { ...f, email: user.email ?? undefined });
      await supabase.from("profiles").update({ onboarded: true, display_name: f.full_name }).eq("id", user.id);
      await qc.invalidateQueries({ queryKey: ["cards"] });
      navigate({ to: "/app/cards/$id", params: { id: card.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create card");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md pt-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand">Step 1 of 1</p>
      <h1 className="mt-2 text-3xl font-bold">Let's make your first card</h1>
      <p className="mt-2 text-sm text-muted-foreground">Just the basics — you can add photos, links and style next.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {([["full_name", "Your name", true], ["job_title", "Job title", false], ["company", "Company", false], ["label", "Card name (e.g. Work)", true]] as const).map(([k, l, req]) => (
          <div key={k} className="space-y-1.5">
            <Label htmlFor={k}>{l}</Label>
            <Input id={k} required={req} className="h-11" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </div>
        ))}
        <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Creating…" : "Create my card"}</Button>
      </form>
    </div>
  );
}
