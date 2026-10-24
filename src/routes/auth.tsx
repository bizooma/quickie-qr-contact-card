import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AB_STORAGE_KEY, variantMeta, type HeadlineVariant } from "@/lib/ab";
import { logSiteEvent } from "@/lib/site-events";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthSearch = { mode?: "signin" | "signup"; email?: string };

export const Route = createFileRoute("/auth")({
  // Buyers arrive from the welcome email as /auth?mode=signup&email=… so the
  // form is already in signup mode with the email that unlocks their purchase.
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    ...(s["mode"] === "signup" || s["mode"] === "signin" ? { mode: s["mode"] } : {}),
    ...(typeof s["email"] === "string" && s["email"].includes("@") ? { email: s["email"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Sign in — ContactKickstart" },
      { name: "description", content: "Sign in or create your ContactKickstart account." },
      { property: "og:title", content: "Sign in — ContactKickstart" },
      { property: "og:description", content: "Sign in or create your ContactKickstart account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/app" });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/app` },
        });
        if (error) throw error;
        // Attribute the signup to the landing headline variant (A/B test);
        // visitors who never saw the landing page stay unattributed.
        let ab: HeadlineVariant | null = null;
        try {
          const stored = localStorage.getItem(AB_STORAGE_KEY);
          if (stored === "a" || stored === "c") ab = stored;
        } catch {
          // storage blocked — leave unattributed
        }
        logSiteEvent("signup", variantMeta("auth", ab));
        if (!data.session) toast.success("Check your inbox to confirm your email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (busy) return;
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error(result.error.message ?? "Google sign-in failed");
    setBusy(false);
  }

  async function forgotPassword() {
    const addr = email.trim();
    if (!addr) {
      toast.error("Enter your email above first");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(addr, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    if (error) toast.error(error.message);
    else toast.success("Check your inbox for a password reset link.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <img
          src="/brand/logo-badge.webp"
          alt="ContactKickstart"
          className="mx-auto mb-10 h-24 w-24"
        />
        <h1 className="text-3xl font-bold">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in to manage your cards."
            : search.email
              ? "Use this email and your purchase unlocks the moment you're in."
              : "Your first card is one minute away."}
        </p>
        <Button variant="outline" className="mt-8 h-11 w-full" onClick={google}>
          Continue with Google
        </Button>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pw">Password</Label>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={forgotPassword}
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <Input
              id="pw"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            className="font-semibold text-foreground underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
