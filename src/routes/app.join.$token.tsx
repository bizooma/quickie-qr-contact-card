import { appHead } from "@/lib/seo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/lib/org.functions";

export const Route = createFileRoute("/app/join/$token")({ head: appHead('Join team', 'Accept an invitation to join a team.'), component: JoinPage });

function JoinPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setProblem(null);
    try {
      const result = await acceptInvite({ data: { token } });
      if (!result.ok) {
        // Seats full, expired, already used…: say so on the page, not just a toast.
        setProblem(result.message);
        setBusy(false);
        return;
      }
      toast.success(`Welcome to ${result.orgName}!`);
      navigate({ to: "/app/org" });
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not join this team. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pt-10 text-center">
      <Users className="mx-auto h-10 w-10 text-brand" />
      <h1 className="text-2xl font-bold">Join the team</h1>
      <p className="text-sm text-muted-foreground">
        You've been invited to a ContactKickstart team. Joining lets the team admins provision
        branded cards for you and see team-level analytics.
      </p>
      {problem && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          {problem}
        </p>
      )}
      <Button className="w-full" disabled={busy} onClick={join}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
        Accept invite
      </Button>
    </div>
  );
}
