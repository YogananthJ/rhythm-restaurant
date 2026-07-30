import { Link } from "@tanstack/react-router";
import { AlertTriangle, Compass, ServerCrash, WifiOff, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

type Kind = "404" | "500" | "offline" | "session";

const CONFIG: Record<Kind, { icon: typeof AlertTriangle; code: string; title: string; message: string }> = {
  "404": {
    icon: Compass,
    code: "404",
    title: "This table doesn't exist",
    message: "The page you're looking for has moved or was never on the menu.",
  },
  "500": {
    icon: ServerCrash,
    code: "500",
    title: "Something burned in the kitchen",
    message: "An unexpected error occurred on our side. The team has been notified — try again in a moment.",
  },
  offline: {
    icon: WifiOff,
    code: "Offline",
    title: "You're not connected",
    message: "We couldn't reach the live service. Check your connection and retry — nothing you did was lost.",
  },
  session: {
    icon: LockKeyhole,
    code: "Session expired",
    title: "You've been signed out",
    message: "For your security we ended the session after inactivity. Sign in again to pick up where you left off.",
  },
};

export function StatusScreen({
  kind,
  onRetry,
  title,
  message,
  primaryHref = "/",
  primaryLabel = "Back to home",
}: {
  kind: Kind;
  onRetry?: () => void;
  title?: string;
  message?: string;
  primaryHref?: string;
  primaryLabel?: string;
}) {
  const cfg = CONFIG[kind];
  const Icon = cfg.icon;

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-6 text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70" style={{ background: "var(--gradient-mesh)" }} aria-hidden="true" />
      <div className="rise-in w-full max-w-md text-center">
        <div className="float-slow mx-auto grid h-20 w-20 place-items-center rounded-3xl border border-white/10 bg-primary/10 text-primary">
          <Icon className="h-9 w-9" />
        </div>
        <div className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{cfg.code}</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title ?? cfg.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message ?? cfg.message}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {onRetry && (
            <Button className="press" onClick={onRetry}>
              Try again
            </Button>
          )}
          <Button asChild variant={onRetry ? "outline" : "default"} className="press">
            <Link to={primaryHref}>{primaryLabel}</Link>
          </Button>
          <Button asChild variant="ghost" className="press">
            <Link to="/our-menu">Browse the menu</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
