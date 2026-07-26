import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  ArrowRight,
  ChefHat,
  CircleDot,
  Clock,
  Github,
  LineChart,
  QrCode,
  Sparkles,
  Utensils,
  Zap,
} from "lucide-react";


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
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Ambient mesh */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "var(--gradient-mesh)" }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10 grid-pattern opacity-[0.15]" />

      <Nav />
      <Hero />
      <LogoStrip />
      <Features />
      <ProductPreview />
      <AISection />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/50 glass-panel">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">Occupancy</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {["Product", "Features", "Kitchen", "Analytics", "Pricing"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/book"
            className="hidden rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Reserve
          </Link>
          <Link
            to="/auth"
            className="hidden rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground shadow-glow transition-all hover:brightness-110"
          >
            Get started
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
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
    <section className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 sm:pt-28">
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
    <section id="features" className="mx-auto max-w-7xl px-6 py-24">
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
    <section id="kitchen" className="mx-auto max-w-7xl px-6 py-24">
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
    <section id="analytics" className="mx-auto max-w-7xl px-6 py-24">
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
