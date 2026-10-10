import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth_/reset")({
  head: () => ({
    meta: [{ title: "Reset password — ContactKickstart" }, { name: "robots", content: "noindex" }],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  // The recovery link signs the user in via the URL hash; without that session
  // updateUser fails, so show a hint instead of a broken form.
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setHasSession(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/app" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <img
          src="/brand/logo-badge.webp"
          alt="ContactKickstart"
          className="mx-auto mb-10 h-24 w-24"
        />
        <h1 className="text-3xl font-bold">Set a new password</h1>
        {hasSession === false ? (
          <p className="mt-4 text-sm text-muted-foreground">
            This page only works from the link in your password reset email. Request a new link from
            the{" "}
            <Link
              to="/auth"
              className="font-semibold text-foreground underline-offset-4 hover:underline"
            >
              sign-in page
            </Link>
            .
          </p>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">New password</Label>
              <Input
                id="new-pw"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw">Confirm password</Label>
              <Input
                id="confirm-pw"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11"
              />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={busy || hasSession === null}>
              {busy ? "Saving…" : "Save new password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
