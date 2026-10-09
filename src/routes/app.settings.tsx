import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listCards } from "@/lib/cards-api";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/app/settings")({ component: Settings });

function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const del = useServerFn(deleteMyAccount);
  const { data: cards = [] } = useQuery({ queryKey: ["cards"], queryFn: listCards });
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (profile) setName(profile.display_name ?? ""); }, [profile]);

  async function saveProfile() {
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() || null }).eq("id", user!.id);
    if (error) toast.error(error.message); else toast.success("Profile saved");
  }
  async function signOut() { await supabase.auth.signOut(); navigate({ to: "/" }); }
  async function deleteAccount() {
    setBusy(true);
    try { await del(); await supabase.auth.signOut(); navigate({ to: "/" }); toast.success("Your account and data were deleted"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Could not delete account"); setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <h1 className="text-3xl font-bold">Settings</h1>
      <section className="space-y-3"><h2 className="text-lg font-bold">Profile</h2>
        <div className="space-y-1"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
        <div className="space-y-1"><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <Button onClick={saveProfile}>Save</Button>
      </section>
      <section><h2 className="mb-3 text-lg font-bold">Cards</h2>
        <ul className="surface divide-y">{cards.map((c) => (
          <li key={c.id}><Link to="/app/cards/$id" params={{ id: c.id }} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
            <span className="h-3 w-3 rounded-full" style={{ background: c.accent_color }} /><span className="flex-1 font-medium">{c.label}</span><span className="text-xs text-muted-foreground">/c/{c.slug}</span><ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link></li>))}</ul>
      </section>
      <section className="space-y-3"><Button variant="outline" onClick={signOut}><LogOut className="h-4 w-4" />Sign out</Button></section>
      <section className="rounded-xl border border-destructive/40 p-5"><h2 className="text-lg font-bold text-destructive">Delete account</h2>
        <p className="mt-1 text-sm text-muted-foreground">Permanently deletes your cards, contacts, notes, analytics, photos and login.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" className="mt-4">Delete my account</Button></AlertDialogTrigger>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete everything?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone. Type DELETE to confirm.</AlertDialogDescription></AlertDialogHeader>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={confirm !== "DELETE" || busy} onClick={(e) => { e.preventDefault(); deleteAccount(); }}>{busy ? "Deleting…" : "Delete forever"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
