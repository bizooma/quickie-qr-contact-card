import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/lib/org.functions";

export const Route = createFileRoute("/app/join/$token")({ component: JoinPage });

function JoinPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function join() {
    setBusy(true);
    try {
      const { orgName } = await acceptInvite({ data: { token } });
      toast.success(`Welcome to ${orgName}!`);
      navigate({ to: "/app/org" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join this team");
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
      <Button className="w-full" disabled={busy} onClick={join}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
        Accept invite
      </Button>
    </div>
  );
}
