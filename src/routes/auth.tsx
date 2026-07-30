import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ChefHat, Loader2, Sparkles, MailCheck } from "lucide-react";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Occupancy" },
      { name: "description", content: "Sign in to the Occupancy restaurant operations dashboard." },
      { property: "og:title", content: "Sign in — Occupancy" },
      { property: "og:description", content: "Access your live kitchen-to-table dashboard." },
    ],
  }),
  component: AuthPage,
});

const RESEND_COOLDOWN_SECONDS = 60;

function friendlyOAuthError(code: string, description?: string | null): string {
  const c = code.toLowerCase();
  const d = (description ?? "").toLowerCase();
  if (c === "access_denied" || d.includes("cancel")) return "Google sign-in was cancelled.";
  if (c === "server_error" || d.includes("provider is not enabled"))
    return "Google sign-in isn't fully configured yet. Try again in a moment or use email.";
  if (c === "unauthorized_client" || d.includes("redirect")) return "This site isn't authorized for Google sign-in yet. Contact the admin.";
  if (c === "invalid_request") return "Malformed Google sign-in request. Please retry.";
  if (c === "temporarily_unavailable") return "Google sign-in is temporarily unavailable. Try again shortly.";
  if (d.includes("email")) return "Google returned an issue with the account email.";
  return `Google sign-in failed (${code}).`;
}


function AuthPage() {
  const navigate = useNavigate();
  const initialMode: "signin" | "signup" =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mode") === "signup"
      ? "signup"
      : "signin";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [lastSignupEmail, setLastSignupEmail] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);


  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });

    // Surface OAuth errors that come back in the URL (query or hash fragment).
    // Google/Supabase append ?error=... or #error=... on failure.
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const err = url.searchParams.get("error") ?? hashParams.get("error");
    const errDesc =
      url.searchParams.get("error_description") ?? hashParams.get("error_description");
    if (err) {
      const pretty = friendlyOAuthError(err, errDesc);
      // Log the raw provider response for debugging.
      // eslint-disable-next-line no-console
      console.error("[oauth] provider returned error", { error: err, description: errDesc });
      toast.error(pretty, { description: errDesc ?? undefined, duration: 8000 });
      // Clean the URL so a refresh doesn't re-toast.
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [navigate]);


  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      cooldownRef.current = null;
      return;
    }
    if (!cooldownRef.current) {
      cooldownRef.current = setInterval(() => {
        setCooldown((c) => (c <= 1 ? 0 : c - 1));
      }, 1000);
    }
    return () => {
      if (cooldownRef.current && cooldown <= 1) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
    };
  }, [cooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        // With auto-confirm on, session exists immediately → straight to dashboard.
        if (data.session) {
          toast.success("Account created. Redirecting…");
          navigate({ to: "/dashboard" });
          return;
        }
        // Fallback: confirmation required — show resend UI.
        setLastSignupEmail(email);
        setCooldown(RESEND_COOLDOWN_SECONDS);
        toast.success("Check your inbox to confirm your email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!lastSignupEmail || cooldown > 0) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: lastSignupEmail,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      toast.success(`New code sent to ${lastSignupEmail}`);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend");
    } finally {
      setResending(false);
    }
  }

  async function handleDemoLogin() {
    setDemoLoading(true);
    try {
      const rand = Math.random().toString(36).slice(2, 10);
      const demoEmail = `guest_${rand}@occupancy.demo`;
      const demoPassword = `Demo!${rand}${Math.random().toString(36).slice(2, 8)}`;
      const { data, error } = await supabase.auth.signUp({
        email: demoEmail,
        password: demoPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: "Demo Guest" },
        },
      });
      if (error) throw error;
      if (!data.session) {
        // Auto-confirm not on — try password sign-in anyway (in case it's confirmed elsewhere).
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
        });
        if (signInError) throw signInError;
      }
      toast.success("Signed in as demo guest");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setDemoLoading(false);
    }
  }
  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      // eslint-disable-next-line no-console
      console.info("[oauth] starting Google sign-in", { redirect_uri: window.location.origin });
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) {
        // eslint-disable-next-line no-console
        console.info("[oauth] redirecting to Google…");
        return;
      }
      // eslint-disable-next-line no-console
      console.info("[oauth] popup flow completed — session set");
      toast.success("Signed in with Google");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error("[oauth] Google sign-in failed", err);
      toast.error(friendlyOAuthError("server_error", raw), {
        description: raw,
        duration: 8000,
      });
    } finally {
      setGoogleLoading(false);
    }
  }



  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-mesh)" }} />
      <div className="pointer-events-none absolute inset-0 -z-10 grid-pattern opacity-[0.15]" />
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 py-16">
        <Link to="/" className="mb-8 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ChefHat className="h-4 w-4 text-primary" /> Occupancy
        </Link>
        <Card className="w-full border-white/10 bg-card/80 p-8 backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your workspace"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to your live restaurant dashboard."
              : "New accounts are provisioned as manager by default."}
          </p>

          <Button
            type="button"
            variant="secondary"
            className="mt-5 w-full"
            onClick={handleDemoLogin}
            disabled={demoLoading || loading || googleLoading}
          >
            {demoLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            One-tap demo login
          </Button>
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full border-white/15 bg-white/5 hover:bg-white/10"
            onClick={handleGoogle}
            disabled={googleLoading || loading || demoLoading}
          >
            {googleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c6.9 0 11.5-4.9 11.5-11.7 0-.8-.1-1.4-.2-2H12z" />
              </svg>
            )}
            Continue with Google
          </Button>
          <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            <div className="h-px flex-1 bg-white/10" /> or email <div className="h-px flex-1 bg-white/10" />
          </div>


          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} minLength={6} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading || demoLoading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          {lastSignupEmail && (
            <div className="mt-5 rounded-lg border border-white/10 bg-background/50 p-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MailCheck className="h-4 w-4 text-primary" />
                Confirmation sent to <span className="text-foreground">{lastSignupEmail}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {cooldown > 0 ? `You can request a new code in ${cooldown}s` : "Didn't get it?"}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleResend}
                  disabled={cooldown > 0 || resending}
                >
                  {resending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  {cooldown > 0 ? `Resend (${cooldown}s)` : "Resend code"}
                </Button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>

          <div className="mt-4 text-center">
            <Link to="/health" className="text-xs text-muted-foreground hover:text-foreground">
              Backend status →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
