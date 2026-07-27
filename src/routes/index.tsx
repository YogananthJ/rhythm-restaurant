import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useAuth, signOutEverywhere } from "@/hooks/use-auth";
import {
  Activity,
  ArrowRight,
  ChefHat,
  CircleDot,
  Clock,
  Github,
  LayoutDashboard,
  LineChart,
  LogOut,
  QrCode,
  Sparkles,
  Utensils,
  Zap,
} from "lucide-react";

const NAV_OFFSET = 72;
const NAV_ITEMS = [
  { id: "product", label: "Product" },
  { id: "features", label: "Features" },
  { id: "kitchen", label: "Kitchen" },
  { id: "analytics", label: "Analytics" },
  { id: "pricing", label: "Pricing" },
] as const;

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
  window.scrollTo({ top, behavior: "smooth" });
  if (typeof history !== "undefined") {
    history.replaceState(null, "", `#${id}`);
  }
}


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Occupancy — The Operating System for Modern Restaurants" },
      {
        name: "description",
        content:
          "Live menu sync, smart queueing, kitchen display, and AI forecasting — one real-time platform connecting your floor, kitchen, and back office.",
      },
      { property: "og:title", content: "Occupancy — The Operating System for Modern Restaurants" },
      {
        property: "og:description",
        content:
          "Stop stitching together three disconnected systems. Occupancy is the shared real-time state of your restaurant.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { status, user } = useAuth();
  const signedIn = status === "authenticated" && !!user;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {signedIn && (
        <div className="sticky top-0 z-50 border-b border-primary/30 bg-primary/10 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-2.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="text-foreground">
                Signed in as <span className="font-medium">{user?.email ?? "your account"}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Open dashboard
              </Link>
              <button
                type="button"
                onClick={() => {
                  void signOutEverywhere();
                }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-3 w-3" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Ambient mesh */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "var(--gradient-mesh)" }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 grid-pattern opacity-[0.15]" />

      <Nav signedIn={signedIn} />
      <Hero />
      <LogoStrip />
      <Features />
      <ProductPreview />
      <AISection />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}


function Nav({ signedIn }: { signedIn: boolean }) {
  const [active, setActive] = useState<string>("product");

  useEffect(() => {
    const els = NAV_ITEMS
      .map((n) => document.getElementById(n.id))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      {
        rootMargin: `-${NAV_OFFSET + 8}px 0px -55% 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 glass-panel">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">Occupancy</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(item.id);
                }}
                aria-current={isActive ? "true" : undefined}
                className={`relative text-sm transition-colors ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
                <span
                  className={`pointer-events-none absolute -bottom-[22px] left-0 right-0 mx-auto h-0.5 rounded-full bg-primary transition-all ${
                    isActive ? "w-6 opacity-100" : "w-0 opacity-0"
                  }`}
                />
              </a>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/book"
            className="hidden rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Reserve
          </Link>
          {signedIn ? (
            <>
              <button
                type="button"
                onClick={() => {
                  void signOutEverywhere();
                }}
                className="hidden rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              >
                Sign out
              </button>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground shadow-glow transition-all hover:brightness-110"
              >
                Open dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <>
              <a
                href="/auth"
                className="hidden rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              >
                Sign in
              </a>
              <a
                href="/auth?mode=signup"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground shadow-glow transition-all hover:brightness-110"
              >
                Get started
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <div className="relative grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-primary to-accent shadow-glow">
      <CircleDot className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
    </div>
  );
}

function Hero() {
  return (
    <section id="product" className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 sm:pt-28 scroll-mt-20">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          Live at VibeAthon 6.0
          <span className="text-border">·</span>
          <span className="text-foreground/70">v0.1 preview</span>
        </div>

        <h1 className="mt-6 text-balance text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
          The operating system for{" "}
          <span className="text-gradient-primary">modern restaurants</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
          Every restaurant runs three disconnected systems — floor, kitchen, back office.
          Occupancy replaces them with one real-time source of truth.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/auth"
            className="group inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110"
          >
            Start free trial
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/t/$token"
            params={{ token: "c55585185c03e23f" }}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-5 py-2.5 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-surface-elevated"
          >
            <QrCode className="h-4 w-4" />
            View live demo
          </Link>
        </div>


        <p className="mt-4 text-xs text-muted-foreground">
          No credit card · Deploy in under 10 minutes
        </p>
      </div>

      {/* Hero preview card */}
      <div className="relative mx-auto mt-16 max-w-6xl">
        <div
          className="absolute -inset-x-20 -inset-y-10 -z-10 rounded-[3rem] opacity-60 blur-3xl"
          style={{ background: "var(--gradient-primary)" }}
        />
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-elegant">
          <DashboardMock />
        </div>
      </div>
    </section>
  );
}

function DashboardMock() {
  return (
    <div className="grid grid-cols-[220px_1fr] min-h-[440px]">
      {/* Sidebar */}
      <div className="border-r border-border/60 bg-background/40 p-4">
        <div className="flex items-center gap-2 pb-4">
          <Logo />
          <span className="text-sm font-semibold">Occupancy</span>
        </div>
        <div className="space-y-1">
          {[
            { icon: Activity, label: "Live floor", active: true },
            { icon: ChefHat, label: "Kitchen" },
            { icon: Utensils, label: "Orders" },
            { icon: LineChart, label: "Analytics" },
            { icon: Sparkles, label: "AI insights" },
          ].map((it) => (
            <div
              key={it.label}
              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm ${
                it.active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <it.icon className="h-3.5 w-3.5" />
              {it.label}
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Friday · Dinner service</div>
            <div className="mt-0.5 text-lg font-semibold">Live floor</div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface-elevated px-2.5 py-1 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            All systems live
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: "Tables occupied", value: "18/24", accent: "text-primary" },
            { label: "Avg wait", value: "12m", accent: "text-accent" },
            { label: "Covers tonight", value: "142", accent: "text-warning" },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-lg border border-border/60 bg-surface-elevated p-3"
            >
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {k.label}
              </div>
              <div className={`mt-1 text-2xl font-semibold ${k.accent}`}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Table grid */}
        <div className="mt-5 grid grid-cols-6 gap-2">
          {Array.from({ length: 24 }).map((_, i) => {
            const state = i % 5 === 0 ? "free" : i % 3 === 0 ? "cooking" : "seated";
            const color =
              state === "free"
                ? "bg-muted/40 text-muted-foreground border-border/50"
                : state === "cooking"
                  ? "bg-warning/10 text-warning border-warning/30"
                  : "bg-primary/10 text-primary border-primary/30";
            return (
              <div
                key={i}
                className={`aspect-square rounded-md border ${color} grid place-items-center text-[11px] font-medium`}
              >
                T{i + 1}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LogoStrip() {
  return (
    <section className="border-y border-border/50 bg-surface/30 py-8">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">
          Built for restaurants that treat operations as a product
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 opacity-60">
          {["Aureole", "Kōji", "Terra", "Meridian", "Fold", "Halcyon"].map((n) => (
            <span
              key={n}
              className="text-lg font-semibold tracking-tight text-muted-foreground"
            >
              {n}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: Zap,
      title: "Live menu sync",
      body: "Mark an item 86'd in the kitchen — every open customer menu updates in under a second. Bidirectional realtime, not another static QR menu.",
    },
    {
      icon: Clock,
      title: "Smart virtual queue",
      body: "Weighted wait-time estimates from real turn-times, not LLM guesses. Customers get accurate ETAs; hosts stop juggling paper lists.",
    },
    {
      icon: ChefHat,
      title: "Kitchen display system",
      body: "Kanban-style order board with color-coded status. Large touch controls built for a rushed line, not a marketing screenshot.",
    },
    {
      icon: LineChart,
      title: "Sales & inventory analytics",
      body: "Dashboards for revenue, covers, top items, low-stock alerts. Every number is grounded in your actual orders.",
    },
    {
      icon: Sparkles,
      title: "AI demand forecasting",
      body: "Predict tomorrow's prep quantities from your own order history. Stop over-ordering perishables. Fallbacks when the model is uncertain.",
    },
    {
      icon: QrCode,
      title: "QR + RBAC out of the box",
      body: "Table-scoped QR ordering, email OTP and Google OAuth, role-based access for owner, manager, kitchen, and waiter — all in one flow.",
    },
  ];

  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-24 scroll-mt-20">
      <div className="mx-auto max-w-2xl text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/60 px-2.5 py-0.5 text-xs text-muted-foreground">
          Platform
        </div>
        <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          One nervous system for the whole restaurant
        </h2>
        <p className="mt-4 text-balance text-lg text-muted-foreground">
          Every feature runs on the same live state — no syncing, no polling, no stitched-together tools.
        </p>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="group relative overflow-hidden rounded-xl border border-border/70 bg-surface/60 p-6 backdrop-blur transition-all hover:border-primary/50 hover:bg-surface-elevated"
          >
            <div className="mb-4 grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-background/60 text-primary transition-colors group-hover:border-primary/40">
              <f.icon className="h-4 w-4" />
            </div>
            <h3 className="text-[15px] font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductPreview() {
  return (
    <section id="kitchen" className="mx-auto max-w-7xl px-6 py-24 scroll-mt-20">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/60 px-2.5 py-0.5 text-xs text-muted-foreground">
            Kitchen display
          </div>
          <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Built for the pass, not the pitch deck
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Every ticket arrives with the same latency as a paper docket, and every status
            change ripples instantly back to the customer. No refreshing, no missed orders,
            no crossed wires between line and floor.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              "Sub-second realtime via Postgres change streams",
              "One-tap 86 that broadcasts to every open menu",
              "Role-scoped views — kitchen sees tickets, waiters see tables",
              "Offline-aware retries so bad venue wifi never loses an order",
            ].map((li) => (
              <li key={li} className="flex items-start gap-2 text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {li}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div
            className="absolute -inset-6 -z-10 rounded-3xl opacity-40 blur-3xl"
            style={{ background: "var(--gradient-primary)" }}
          />
          <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-elegant">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="text-sm font-semibold">Kitchen board</div>
              <div className="text-xs text-muted-foreground">7 active · 2 ready</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { title: "Placed", color: "border-info/40 bg-info/5", count: 3 },
                { title: "Preparing", color: "border-warning/40 bg-warning/5", count: 2 },
                { title: "Ready", color: "border-primary/40 bg-primary/5", count: 2 },
              ].map((col, idx) => (
                <div key={col.title} className={`rounded-lg border ${col.color} p-2`}>
                  <div className="mb-2 flex items-center justify-between px-1 text-xs">
                    <span className="font-semibold">{col.title}</span>
                    <span className="text-muted-foreground">{col.count}</span>
                  </div>
                  <div className="space-y-2">
                    {Array.from({ length: col.count }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-md border border-border/60 bg-background/70 p-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold">T{4 + idx * 3 + i}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {2 + i}m
                          </div>
                        </div>
                        <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                          <div>· Chicken biryani</div>
                          <div>· Paneer tikka</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AISection() {
  return (
    <section id="analytics" className="mx-auto max-w-7xl px-6 py-24 scroll-mt-20">
      <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-surface via-surface/60 to-background p-10 sm:p-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
            <Sparkles className="h-3 w-3" /> AI, grounded in your data
          </div>
          <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            An assistant that reads your restaurant, not the internet
          </h2>
          <p className="mt-4 text-balance text-lg text-muted-foreground">
            Ask a question in plain English. We pull the relevant aggregates, hand only that
            to the model, and return a grounded answer with the numbers behind it.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-xl border border-border/70 bg-background/60 shadow-elegant">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
            <div className="h-2 w-2 rounded-full bg-destructive/70" />
            <div className="h-2 w-2 rounded-full bg-warning/70" />
            <div className="h-2 w-2 rounded-full bg-success/70" />
            <div className="ml-3 text-xs text-muted-foreground">occupancy · assistant</div>
          </div>
          <div className="space-y-4 p-5 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">You</div>
              <div className="mt-1 text-foreground">
                What sold worst this week and should I 86 anything on Saturday?
              </div>
            </div>
            <div>
              <div className="text-xs text-primary">Occupancy</div>
              <div className="mt-1 leading-relaxed text-foreground">
                Your bottom three by cover-adjusted revenue this week were{" "}
                <span className="font-medium">Fish curry</span> (−38% vs last week),{" "}
                <span className="font-medium">Beetroot salad</span>, and{" "}
                <span className="font-medium">Mushroom risotto</span>. Fish curry has also
                been 86'd twice — I'd cut Saturday's prep by ~40% and reallocate to Chicken
                biryani, which is trending +22%.
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {["forecast_confidence: 0.81", "based on 14 days", "gemini-2.0"].map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-border/60 bg-surface px-2 py-0.5 font-mono text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-surface p-12 text-center shadow-elegant sm:p-16">
        <div
          className="absolute inset-0 -z-10 opacity-70"
          style={{ background: "var(--gradient-mesh)" }}
        />
        <h2 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Ship your live restaurant OS this week
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-balance text-lg text-muted-foreground">
          One platform. Live sync, kitchen display, virtual queue, and AI insights — running
          on your data in minutes.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:brightness-110"
          >
            Start free trial
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/book"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/60 px-5 py-2.5 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-surface-elevated"
          >
            Talk to the team
          </Link>
        </div>

      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    {
      name: "Starter",
      price: "$0",
      period: "/mo",
      tag: "Free during VibeAthon",
      description: "For single-location cafés getting a feel for live ops.",
      features: [
        "Up to 15 tables",
        "Guest QR menu + order tracker",
        "Kitchen Display System",
        "Live floor dashboard",
      ],
      cta: "Start free",
      to: "/auth",
      highlight: false,
    },
    {
      name: "Growth",
      price: "$149",
      period: "/mo",
      tag: "Most popular",
      description: "Full nervous system for busy restaurants that need AI ops.",
      features: [
        "Unlimited tables & staff",
        "AI Ops Copilot + Autopilot",
        "Reservations & waitlist",
        "Sales analytics + CSV export",
      ],
      cta: "Start 14-day trial",
      to: "/auth",
      highlight: true,
    },
    {
      name: "Scale",
      price: "Custom",
      period: "",
      tag: "Multi-location",
      description: "For groups running multiple venues on shared intelligence.",
      features: [
        "Multi-restaurant tenancy",
        "SLA + priority support",
        "Custom integrations",
        "Dedicated success partner",
      ],
      cta: "Talk to the team",
      to: "/book",
      highlight: false,
    },
  ] as const;

  return (
    <section id="pricing" className="mx-auto max-w-7xl px-6 py-24 scroll-mt-20">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Pricing
        </div>
        <h2 className="mt-3 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Simple pricing. Real-time value.
        </h2>
        <p className="mt-4 text-balance text-lg text-muted-foreground">
          Start free during VibeAthon. Upgrade when your kitchen is ready to run on live data.
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`glass-panel relative flex flex-col rounded-2xl border p-6 ${
              t.highlight
                ? "border-primary/60 shadow-glow"
                : "border-border/60"
            }`}
          >
            {t.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground shadow-glow">
                {t.tag}
              </div>
            )}
            <div className="text-sm font-semibold text-foreground">{t.name}</div>
            {!t.highlight && (
              <div className="mt-1 text-xs text-muted-foreground">{t.tag}</div>
            )}
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">{t.price}</span>
              {t.period && (
                <span className="text-sm text-muted-foreground">{t.period}</span>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t.description}</p>
            <ul className="mt-6 space-y-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-foreground/85">
                  <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link
                to={t.to}
                className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                  t.highlight
                    ? "bg-primary text-primary-foreground shadow-glow hover:brightness-110"
                    : "border border-border bg-background/60 text-foreground hover:bg-surface-elevated"
                }`}
              >
                {t.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-surface/30">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="text-sm font-semibold">Occupancy</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            The operating system for modern restaurants. Built for VibeAthon 6.0 — real
            product, real data, real time.
          </p>
        </div>
        {[
          { title: "Product", items: ["Live floor", "Kitchen", "Analytics", "AI insights"] },
          { title: "Company", items: ["About", "Careers", "Contact", "Changelog"] },
        ].map((col) => (
          <div key={col.title}>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {col.title}
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {col.items.map((it) => (
                <li key={it}>
                  <a href="#" className="text-foreground/80 hover:text-foreground">
                    {it}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4 text-xs text-muted-foreground">
          <div>© 2026 Occupancy · Made for VibeAthon 6.0</div>
          <a
            href="#"
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <Github className="h-3.5 w-3.5" /> View on GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
