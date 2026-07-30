import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { Toaster, toast } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { consumeIntentionalSignOut } from "@/hooks/use-auth";
import { logAuthEvent } from "@/lib/auth-log";
import { AuthDebugPanel } from "@/components/AuthDebugPanel";
import { StatusScreen } from "@/components/StatusScreen";

function NotFoundComponent() {
  return <StatusScreen kind="404" />;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const msg = String(error?.message ?? "");
  const session = /jwt|unauthor|session|401/i.test(msg);
  const network = offline || /failed to fetch|network|econnrefused/i.test(msg);

  return (
    <StatusScreen
      kind={session ? "session" : network ? "offline" : "500"}
      onRetry={() => {
        router.invalidate();
        reset();
      }}
      primaryHref={session ? "/auth" : "/"}
      primaryLabel={session ? "Sign in again" : "Back to home"}
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Occupancy — Live Kitchen-to-Table Intelligence" },
      {
        name: "description",
        content:
          "Occupancy is the shared real-time state of your restaurant — connecting front-of-house, kitchen, and back office with live menu sync, smart queues, and AI-powered ops insights.",
      },
      { name: "author", content: "Occupancy" },
      { property: "og:title", content: "Occupancy — Live Kitchen-to-Table Intelligence" },
      {
        property: "og:description",
        content:
          "The operating system for modern restaurants. Real-time menu availability, smart queueing, kitchen display, and AI forecasting — in one platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#07100c" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const hadSessionRef = useRef<boolean>(false);

  // Prime "had a session" from persisted state so a page load into a stale
  // localStorage token still triggers the expired-session UX when Supabase
  // fails to refresh and emits SIGNED_OUT.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      hadSessionRef.current = !!data.session;
      logAuthEvent("INITIAL_SESSION", {
        email: data.session?.user?.email,
        detail: data.session ? "hydrated existing session" : "no session",
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Single global auth listener. Keeps router route-context and cached queries
  // in sync with real session state, and turns unexpected SIGNED_OUT events
  // (refresh_token expired, revoked, tab woke past expiry) into a friendly
  // "session expired" prompt instead of a silent state wipe.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") {
        hadSessionRef.current = !!session;
        logAuthEvent("TOKEN_REFRESHED", { email: session?.user?.email });
        return;
      }
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED"
      ) {
        return;
      }

      if (event === "SIGNED_OUT") {
        const wasSignedIn = hadSessionRef.current;
        hadSessionRef.current = false;
        const intentional = consumeIntentionalSignOut();

        // Always drop cached protected data so a re-login can't flash the
        // prior tenant.
        void queryClient.cancelQueries();
        queryClient.clear();
        router.invalidate();

        if (wasSignedIn && !intentional) {
          logAuthEvent("AUTH_EXPIRED", {
            detail: "SIGNED_OUT without intentional flag — treating as expired",
          });
        } else {
          logAuthEvent("SIGNED_OUT", {
            detail: intentional ? "intentional" : wasSignedIn ? "expired" : "no prior session",
          });
        }

        if (wasSignedIn && !intentional) {
          const here =
            typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
          const isPublic =
            here === "/" ||
            here.startsWith("/auth") ||
            here.startsWith("/t/") ||
            here.startsWith("/book") ||
            here.startsWith("/health");

          toast.error("Session expired", {
            description: "Please sign in again to continue.",
            duration: 6000,
          });

          if (!isPublic) {
            router.navigate({
              to: "/auth",
              search: { redirect: here },
              replace: true,
            } as never);
          }
        }
        return;
      }

      // SIGNED_IN / USER_UPDATED
      hadSessionRef.current = !!session;
      logAuthEvent(event === "SIGNED_IN" ? "SIGNED_IN" : "USER_UPDATED", {
        email: session?.user?.email,
      });
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster theme="dark" position="top-right" richColors />
      <AuthDebugPanel />
    </QueryClientProvider>
  );
}
