import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarCheck,
  ChevronDown,
  Clock,
  Coins,
  Flame,
  Gift,
  History as HistoryIcon,
  HelpCircle,
  LayoutDashboard,
  Lock,
  Medal,
  Sparkles,
  Store,
  Ticket,
  Trophy,
  Wallet,
} from "lucide-react";

import { motion } from "framer-motion";

import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Reveal } from "@/components/Reveal";
import { RewardModule, RewardModuleSkeleton } from "@/components/rewards/RewardModule";
import { ClaimSuccessOverlay, type ClaimResult } from "@/components/rewards/ClaimSuccessOverlay";

import {
  BadgesIllustration,
  EarnIllustration,
  HelpIllustration,
  HistoryIllustration,
  SpinIllustration,
  StoreIllustration,
  WalletIllustration,
} from "@/components/rewards/illustrations";
import { SpinWheel } from "@/components/rewards/SpinWheel";
import { isSameDay, useRewards, type Voucher } from "@/components/rewards/useRewards";
import {
  BADGES,
  EARN_RULES,
  FAQS,
  HISTORY,
  LEADERBOARD,
  STORE,
  TIERS,
} from "@/lib/rewards-data";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Occupancy Rewards — Earn Points on Every Meal" },
      {
        name: "description",
        content:
          "Track your Occupancy Rewards balance, spin the daily wheel, redeem free desserts and bill discounts, collect badges and climb the diner leaderboard.",
      },
      { property: "og:title", content: "Occupancy Rewards — Earn Points on Every Meal" },
      {
        property: "og:description",
        content: "Points, streaks, badges and rewards for every table you dine at.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RewardsHub,
});

const SECTIONS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "spin", label: "Daily Spin", icon: Sparkles },
  { id: "store", label: "Rewards Store", icon: Store },
  { id: "badges", label: "Badges", icon: Medal },
  { id: "mine", label: "My Rewards", icon: Wallet },
  { id: "earn", label: "How to Earn", icon: Coins },
  { id: "history", label: "History", icon: HistoryIcon },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "faq", label: "FAQ", icon: HelpCircle },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function tierFor(lifetime: number) {
  return [...TIERS].reverse().find((t) => lifetime >= t.min) ?? TIERS[0];
}

function RewardsHub() {
  const [section, setSection] = useState<SectionId>("dashboard");
  const [claim, setClaim] = useState<ClaimResult | null>(null);
  const rewards = useRewards();
  const { state } = rewards;
  const tier = tierFor(state.lifetime);

  const celebrate = (result: ClaimResult) => {
    setClaim(result);
    toast.success(`${result.name} claimed`, {
      description: `Code ${result.code} · ${result.balanceAfter} points left`,
      className: "glass-panel",
      duration: 5000,
    });
  };

  const claimById = (id: string, name: string, cost: number) => {
    const result = rewards.redeem(id, name, cost);
    if (result) celebrate(result);
    else setSection("store");
  };


  return (
    <div className="relative min-h-dvh bg-background text-foreground page-enter">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "var(--gradient-mesh)" }}
      />

      <header className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to home
        </Link>
        <div className="mt-3 flex min-w-0 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Gift className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight sm:text-4xl">
              Occupancy Rewards
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Every meal earns. Every point counts.
            </p>
          </div>
        </div>
      </header>

      <BalanceStrip
        balance={state.balance}
        tier={tier.name}
        streak={state.streak}
        onClaim={claimById}

        onStore={() => setSection("store")}
      />

      {/* Section navigation */}
      <nav
        aria-label="Rewards Hub sections"
        className="marquee mx-auto mt-6 w-full max-w-7xl overflow-x-auto px-4 sm:px-6"
      >
        <ul className="flex w-max gap-2 pb-2">
          {SECTIONS.map((s) => {
            const active = section === s.id;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setSection(s.id)}
                  className={`nav-item inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium ${
                    active
                      ? "nav-item-active border-primary/40"
                      : "border-border bg-surface/60 text-muted-foreground"
                  }`}
                >
                  <s.icon className="h-4 w-4" aria-hidden="true" />
                  {s.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6 sm:px-6">
        {!rewards.hydrated ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <RewardModuleSkeleton key={i} index={i} />
            ))}
          </div>
        ) : (
          <>
            {section === "dashboard" && <Dashboard rewards={rewards} onGo={setSection} />}
            {section === "spin" && <DailySpin rewards={rewards} />}
            {section === "store" && <RewardsStore rewards={rewards} onClaimed={celebrate} />}
            {section === "badges" && <Badges />}
            {section === "mine" && <MyRewards rewards={rewards} onBrowse={() => setSection("store")} />}
            {section === "earn" && <HowToEarn />}
            {section === "history" && <HistoryView rewards={rewards} />}
            {section === "leaderboard" && <Leaderboard points={state.balance} />}
            {section === "faq" && <Faq />}
          </>
        )}
      </main>

      {claim && (
        <ClaimSuccessOverlay
          claim={claim}
          onClose={() => setClaim(null)}
          onViewRewards={() => {
            setClaim(null);
            setSection("mine");
          }}
        />
      )}
    </div>
  );
}


/* ------------------------------------------------------------------ */

function BalanceStrip({
  balance,
  tier,
  streak,
  onClaim,
  onStore,
}: {
  balance: number;
  tier: string;
  streak: number;
  onClaim: (id: string, name: string, cost: number) => void;
  onStore: () => void;
}) {
  // The cheapest reward on the board — claimable now, or the goal to save toward.
  const nextReward = [...STORE].sort((a, b) => a.cost - b.cost)[0];
  const target = nextReward.cost;
  const claimable = balance >= target;
  const pct = Math.min(100, Math.round((balance / target) * 100));

  return (
    <section
      aria-label="Rewards balance summary"
      className="mx-auto mt-6 w-full max-w-7xl px-4 sm:px-6"
    >
      <div className="glass-panel rounded-3xl p-5 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              <Coins className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
              Balance
            </div>
            <div className="mt-1 font-display text-4xl font-bold text-gradient-primary sm:text-5xl">
              <AnimatedNumber value={balance} />
            </div>
            <div className="text-xs text-muted-foreground">Rewards points</div>
          </div>

          <div className="flex flex-col justify-center gap-2">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-sm font-semibold text-warning">
              <Medal className="h-4 w-4" aria-hidden="true" />
              {tier}
            </span>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive">
              <Flame className="h-4 w-4" aria-hidden="true" />
              {streak}-day streak
            </span>
          </div>

          <div className="rounded-2xl border border-border/70 bg-surface/50 p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Next reward
            </div>
            <p className="mt-1 text-sm font-medium">
              {target.toLocaleString()} Rewards → {nextReward.name}
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width] duration-1000 ease-out"
                style={{ width: `${pct}%`, background: "var(--gradient-primary)" }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {claimable
                ? "Ready to claim now"
                : `${(target - balance).toLocaleString()} points to go`}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-sm">
          <button
            type="button"
            disabled={!claimable}
            onClick={() => onClaim(nextReward.id, nextReward.name, nextReward.cost)}
            className="press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-40"
          >
            <Gift className="h-4 w-4" aria-hidden="true" />
            Claim
          </button>
          <button
            type="button"
            onClick={onStore}
            className="press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface/60 px-5 text-sm font-semibold"
          >
            <Store className="h-4 w-4" aria-hidden="true" />
            Store
          </button>
        </div>
      </div>
    </section>
  );
}

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="mb-5">
      <h2 className="font-display text-xl font-bold sm:text-2xl">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </header>
  );
}

type RewardsApi = ReturnType<typeof useRewards>;

/* ------------------------------ Dashboard ------------------------------ */

function Dashboard({ rewards, onGo }: { rewards: RewardsApi; onGo: (s: SectionId) => void }) {
  const { state, checkIn } = rewards;
  const checkedIn = isSameDay(state.lastCheckInAt);
  const spun = isSameDay(state.lastSpinAt);
  const tier = tierFor(state.lifetime);
  const next = TIERS[TIERS.findIndex((t) => t.id === tier.id) + 1];
  const tierPct = next
    ? Math.min(100, Math.round(((state.lifetime - tier.min) / (next.min - tier.min)) * 100))
    : 100;

  const activeVouchers = state.vouchers.filter((v) => !v.used);
  const feed = [...state.log, ...HISTORY];
  const lastEarned = feed.find((h) => h.points > 0);
  const totalEarned = HISTORY.filter((h) => h.points > 0).reduce((s, h) => s + h.points, 0) + state.lifetime;
  const earnedBadges = BADGES.filter((b) => b.earned).length;
  const nextBadge = BADGES.find((b) => !b.earned);
  const affordable = STORE.filter((r) => r.cost <= state.balance);
  const featured = [...STORE].sort((a, b) => a.cost - b.cost)[0];
  const nextTierGoal = next ? next.min - state.lifetime : 0;
  const dailyMax = 100;
  const dailyEarnedToday = (checkedIn ? 10 : 0) + (spun ? 25 : 0);
  const lastSpinWin = state.log.find((h) => h.label.toLowerCase().includes("spin"));

  return (
    <div className="space-y-6">
      {/* ---------------------------- Hero ---------------------------- */}
      <motion.section
        aria-label="Rewards overview"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="rw-module group p-5 sm:p-8"
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--rw-gold)_45%,transparent)] bg-[color-mix(in_oklab,var(--rw-gold)_12%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--rw-gold-soft)]">
              <Medal className="h-3.5 w-3.5" aria-hidden="true" />
              {tier.name} member
            </span>
            <div className="mt-3 font-display text-5xl font-bold leading-none rw-gold-text sm:text-6xl">
              <AnimatedNumber value={state.balance} />
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Reward points available · {tier.perk}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-surface/40 p-4">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                  <Flame className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                  Daily streak
                </div>
                <div className="mt-1 font-display text-2xl font-bold tabular-nums">
                  <AnimatedNumber value={state.streak} /> days
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-surface/40 p-4">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                  <Gift className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Next reward
                </div>
                <div className="mt-1 truncate text-sm font-semibold">{featured.name}</div>
                <div className="text-xs text-muted-foreground">
                  {state.balance >= featured.cost
                    ? "Ready to claim"
                    : `${(featured.cost - state.balance).toLocaleString()} points to go`}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {next ? `Progress to ${next.name}` : "Top tier reached"}
                </span>
                <span className="tabular-nums">{tierPct}%</span>
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "var(--gradient-primary)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(3, tierPct)}%` }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              {next && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {nextTierGoal.toLocaleString()} lifetime points to unlock {next.perk.toLowerCase()}.
                </p>
              )}
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Lifetime earned" value={state.lifetime} icon={Trophy} />
              <StatCard label="Active vouchers" value={activeVouchers.length} icon={Ticket} />
              <StatCard label="Badges earned" value={earnedBadges} icon={Medal} />
              <StatCard label="Rewards in reach" value={affordable.length} icon={Store} />
            </div>

            <div className="rounded-2xl border border-border/70 bg-surface/40 p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <h3 className="truncate text-sm font-semibold">Recent activity</h3>
                <button
                  type="button"
                  onClick={() => onGo("history")}
                  className="shrink-0 text-xs font-medium text-primary"
                >
                  View all
                </button>
              </div>
              <ul className="mt-2 divide-y divide-border/60">
                {feed.slice(0, 4).map((h) => (
                  <li key={h.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="truncate">{h.label}</span>
                    <span
                      className={`ml-auto shrink-0 font-semibold tabular-nums ${
                        h.points > 0 ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {h.points > 0 ? "+" : ""}
                      {h.points}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <QuickAction
                icon={CalendarCheck}
                title={checkedIn ? "Checked in today" : "Daily check-in"}
                sub={checkedIn ? "Back tomorrow to keep the streak alive." : "+10 points, keeps your streak going."}
                cta={checkedIn ? "Done" : "Check in"}
                disabled={checkedIn}
                onClick={() => {
                  checkIn();
                  toast.success("Checked in — +10 points!");
                }}
              />
              <QuickAction
                icon={Sparkles}
                title="Daily spin"
                sub={spun ? "Already spun today." : "One free spin, every segment wins."}
                cta="Spin"
                disabled={spun}
                onClick={() => onGo("spin")}
              />
            </div>
          </div>
        </div>
      </motion.section>

      {/* ------------------------ Feature modules ------------------------ */}
      <div className="grid gap-5 lg:grid-cols-2">
        <RewardModule
          index={0}
          eyebrow="Daily Spin"
          title="Spin the wheel of the house"
          description="One free spin every 24 hours — every segment pays out, from 5 points to a free coffee."
          status={spun ? "Next spin in 23h" : "Spin available"}
          statusTone={spun ? "muted" : "primary"}
          illustration={<SpinIllustration />}
          stats={[
            { label: "Today's status", value: spun ? "Spun" : "Ready", animate: false },
            { label: "Last reward won", value: lastSpinWin ? `+${lastSpinWin.points}` : "—", animate: false, accent: true },
            { label: "Top prize", value: 500 },
          ]}
          cta={spun ? "View wheel" : "Spin now"}
          ctaIcon={Sparkles}
          onCta={() => onGo("spin")}
        />

        <RewardModule
          index={1}
          eyebrow="Rewards Store"
          title="Trade points for the good stuff"
          description="Desserts, bill discounts and chef's table experiences — redeemable the moment you can afford them."
          status={`${STORE.length} items available`}
          statusTone="gold"
          illustration={<StoreIllustration />}
          stats={[
            { label: "Rewards available", value: STORE.length },
            { label: "Within reach", value: affordable.length },
            { label: "Featured", value: featured.name, animate: false, accent: true },
          ]}
          progress={{
            label: `Toward ${featured.name}`,
            pct: Math.min(100, (state.balance / featured.cost) * 100),
            hint: `${featured.cost.toLocaleString()} points · ${featured.blurb}`,
          }}
          cta="Visit store"
          ctaIcon={Store}
          onCta={() => onGo("store")}
        />

        <RewardModule
          index={2}
          eyebrow="Badges"
          title="Collect every achievement"
          description="Unlock restaurant badges for reviews, QR orders, streaks and party bookings."
          status={`${earnedBadges} / ${BADGES.length} unlocked`}
          statusTone="gold"
          illustration={<BadgesIllustration />}
          stats={[
            { label: "Unlocked", value: `${earnedBadges} / ${BADGES.length}`, animate: false },
            { label: "Current badge", value: tier.name, animate: false, accent: true },
            { label: "Next badge", value: nextBadge?.name ?? "All done", animate: false },
          ]}
          progress={{
            label: "Badge collection",
            pct: (earnedBadges / BADGES.length) * 100,
            hint: nextBadge ? `Next up — ${nextBadge.desc}.` : "Every badge unlocked.",
          }}
          cta="View badges"
          ctaIcon={Medal}
          onCta={() => onGo("badges")}
        />

        <RewardModule
          index={3}
          eyebrow="My Rewards"
          title="Your reward wallet"
          description="Live vouchers, membership perks and everything waiting to be shown to your server."
          status={`${activeVouchers.length} active`}
          statusTone={activeVouchers.length ? "primary" : "muted"}
          illustration={<WalletIllustration />}
          stats={[
            { label: "Active rewards", value: activeVouchers.length },
            { label: "Coupons", value: activeVouchers.filter((v) => v.name.toLowerCase().includes("off")).length },
            { label: "Membership", value: tier.name.split(" ")[0], animate: false, accent: true },
          ]}
          empty={
            state.vouchers.length === 0
              ? {
                  title: "Your wallet is empty",
                  message: "Redeem a reward from the store and the voucher lands here instantly.",
                }
              : undefined
          }

          cta="Open wallet"
          ctaIcon={Wallet}
          onCta={() => onGo("mine")}
        />

        <RewardModule
          index={4}
          eyebrow="Ways to Earn"
          title="Stack points on every visit"
          description="Scan, order, review and refer — each action drops points straight into your balance."
          status={`Earn up to ${dailyMax} today`}
          statusTone="primary"
          illustration={<EarnIllustration />}
          stats={[
            { label: "Earn actions", value: EARN_RULES.length },
            { label: "Today's cap", value: dailyMax },
            { label: "Biggest bonus", value: "+500", animate: false, accent: true },
          ]}
          progress={{
            label: "Daily goal",
            pct: (dailyEarnedToday / dailyMax) * 100,
            hint: `${dailyEarnedToday} of ${dailyMax} points earned today.`,
          }}
          cta="See all activities"
          ctaIcon={Coins}
          onCta={() => onGo("earn")}
        />

        <RewardModule
          index={5}
          eyebrow="Reward History"
          title="Every point, on the timeline"
          description="A complete ledger of earnings, redemptions and expiries across your dining history."
          status={lastEarned ? `Last earned ${lastEarned.points > 0 ? `+${lastEarned.points}` : ""}` : "No activity yet"}
          statusTone="muted"
          illustration={<HistoryIllustration />}
          stats={[
            { label: "Total earned", value: totalEarned },
            { label: "Entries", value: feed.length },
            { label: "Last earned", value: lastEarned?.label.split(" —")[0] ?? "—", animate: false, accent: true },
          ]}
          cta="View timeline"
          ctaIcon={Clock}
          onCta={() => onGo("history")}
        />

        <RewardModule
          index={6}
          eyebrow="Help & FAQ"
          title="The reward guide"
          description="How points, tiers, streaks and vouchers work — answered by the house."
          status={`${FAQS.length} articles`}
          statusTone="muted"
          illustration={<HelpIllustration />}
          stats={[
            { label: "Common questions", value: FAQS.length },
            { label: "Reward tiers", value: TIERS.length },
            { label: "Latest update", value: "Streaks", animate: false, accent: true },
          ]}
          cta="Learn more"
          ctaIcon={HelpCircle}
          onCta={() => onGo("faq")}
        />

        <RewardModule
          index={7}
          eyebrow="Leaderboard"
          title="The house regulars"
          description="See where you rank against the most loyal diners this season."
          status={`Rank #${LEADERBOARD.find((l) => l.you)?.rank ?? "—"}`}
          statusTone="gold"
          illustration={<BadgesIllustration />}
          stats={[
            { label: "Your points", value: state.balance },
            { label: "Diners ranked", value: LEADERBOARD.length },
            { label: "Leader", value: LEADERBOARD[0].name.split(" ")[0], animate: false, accent: true },
          ]}
          cta="View leaderboard"
          ctaIcon={Trophy}
          onCta={() => onGo("leaderboard")}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="glass-panel hover-lift rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-1.5 font-display text-2xl font-bold">
        <AnimatedNumber value={value} />
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  title,
  sub,
  cta,
  onClick,
  disabled = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
  cta: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/70 bg-surface/40 p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{sub}</div>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="press min-h-9 shrink-0 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40"
      >
        {cta}
      </button>
    </div>
  );
}

/* ------------------------------ Daily Spin ------------------------------ */

function DailySpin({ rewards }: { rewards: RewardsApi }) {
  const { state, addPoints, setLastSpin } = rewards;
  const spun = isSameDay(state.lastSpinAt);

  return (
    <div>
      <SectionHead title="Daily Spin" sub="One free spin every 24 hours. Every segment is a win." />
      <div className="glass-panel rounded-3xl p-6 sm:p-10">
        <SpinWheel
          canSpin={!spun}
          nextSpinLabel="Come back tomorrow"
          onWin={(label, points) => {
            setLastSpin();
            addPoints(points, `Daily spin — ${label}`);
            toast.success(`You won ${label}!`);
          }}
        />
      </div>
    </div>
  );
}

/* ----------------------------- Rewards Store ----------------------------- */

const CATS = [
  { id: "all", label: "All" },
  { id: "food", label: "Food" },
  { id: "discount", label: "Discounts" },
  { id: "experience", label: "Experiences" },
] as const;

function RewardsStore({
  rewards,
  onClaimed,
}: {
  rewards: RewardsApi;
  onClaimed: (result: ClaimResult) => void;
}) {
  const { state, redeem } = rewards;

  const [cat, setCat] = useState<string>("all");
  const list = useMemo(
    () => STORE.filter((r) => cat === "all" || r.category === cat).sort((a, b) => a.cost - b.cost),
    [cat],
  );

  return (
    <div>
      <SectionHead title="Rewards Store" sub="Turn points into desserts, discounts and experiences." />

      <div className="mb-5 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={cat === c.id}
            onClick={() => setCat(c.id)}
            className={`press min-h-9 rounded-full border px-3.5 text-xs font-medium ${
              cat === c.id
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border bg-surface/60 text-muted-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((r, i) => {
          const affordable = state.balance >= r.cost;
          return (
            <Reveal key={r.id} delay={i * 50}>
              <article className="glass-panel hover-lift flex h-full flex-col rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                    <r.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{r.name}</h3>
                    <p className="text-xs capitalize text-muted-foreground">{r.category}</p>
                  </div>
                  <span className="ml-auto shrink-0 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-bold tabular-nums text-warning">
                    {r.cost}
                  </span>
                </div>
                <p className="mt-3 flex-1 text-sm text-muted-foreground">{r.blurb}</p>
                {r.tierRequired && (
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    {r.tierRequired} and above
                  </p>
                )}
                {!affordable && (
                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: `${Math.min(100, (state.balance / r.cost) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {r.cost - state.balance} more points needed
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  disabled={!affordable}
                  onClick={() => {
                    const result = redeem(r.id, r.name, r.cost);
                    if (result) onClaimed(result);

                  }}
                  className="press mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {affordable ? "Redeem" : "Not enough points"}
                </button>
              </article>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------- Badges -------------------------------- */

function Badges() {
  const earned = BADGES.filter((b) => b.earned).length;
  return (
    <div>
      <SectionHead
        title="Badges"
        sub={`${earned} of ${BADGES.length} unlocked — keep dining to collect the rest.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {BADGES.map((b, i) => (
          <Reveal key={b.id} delay={i * 40}>
            <article
              className={`glass-panel hover-lift h-full rounded-2xl p-5 text-center ${
                b.earned ? "" : "opacity-70"
              }`}
            >
              <span
                className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl ${
                  b.earned ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                <b.icon className="h-7 w-7" aria-hidden="true" />
              </span>
              <h3 className="mt-3 font-semibold">{b.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{b.desc}</p>
              {b.earned ? (
                <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-primary">
                  <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                  Earned
                </span>
              ) : b.progress ? (
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{ width: `${(b.progress.current / b.progress.target) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                    {b.progress.current.toLocaleString()} / {b.progress.target.toLocaleString()}
                  </p>
                </div>
              ) : null}
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ My Rewards ------------------------------ */

function MyRewards({ rewards, onBrowse }: { rewards: RewardsApi; onBrowse: () => void }) {
  const { state, markUsed } = rewards;
  const active = state.vouchers.filter((v) => !v.used);
  const used = state.vouchers.filter((v) => v.used);

  return (
    <div>
      <SectionHead title="My Rewards" sub="Your redeemed vouchers — show the code at your table." />

      {state.vouchers.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Wallet className="h-7 w-7" aria-hidden="true" />
          </span>
          <h3 className="mt-4 font-display text-lg font-semibold">No rewards yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Redeem something from the store and it will land right here.
          </p>
          <button
            type="button"
            onClick={onBrowse}
            className="press mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Browse the store
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <VoucherGrid list={active} onUse={markUsed} />
          {used.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Used</h3>
              <VoucherGrid list={used} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VoucherGrid({ list, onUse }: { list: Voucher[]; onUse?: (id: string) => void }) {
  if (list.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((v) => (
        <article
          key={v.id}
          className={`glass-panel relative overflow-hidden rounded-2xl p-5 ${v.used ? "opacity-60" : ""}`}
        >
          <div
            aria-hidden="true"
            className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background"
          />
          <div
            aria-hidden="true"
            className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background"
          />
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="truncate font-semibold">{v.name}</h3>
          </div>
          <p className="mt-2 font-mono text-lg font-bold tracking-widest text-primary">{v.code}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Expires {new Date(v.expiresAt).toLocaleDateString()}
          </p>
          {onUse && !v.used && (
            <button
              type="button"
              onClick={() => {
                onUse(v.id);
                toast.success("Voucher marked as used.");
              }}
              className="press mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-primary/40 text-sm font-semibold text-primary"
            >
              Mark as used
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

/* ------------------------------ How to Earn ------------------------------ */

function HowToEarn() {
  return (
    <div>
      <SectionHead title="How to Earn" sub="Every action at the table adds up. Here's the full list." />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EARN_RULES.map((r, i) => (
          <Reveal key={r.action} delay={i * 40}>
            <li className="glass-panel hover-lift grid h-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <r.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 text-sm font-medium">{r.action}</span>
              <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">
                {r.points}
              </span>
            </li>
          </Reveal>
        ))}
      </ul>
      <div className="glass-panel mt-6 rounded-2xl p-5 text-sm text-muted-foreground">
        <strong className="text-foreground">Tip:</strong> points post the moment your bill is closed.
        Bonus points from spins and promos expire after 30 days — spend those first.
      </div>
    </div>
  );
}

/* -------------------------------- History -------------------------------- */

function HistoryView({ rewards }: { rewards: RewardsApi }) {
  const [filter, setFilter] = useState<"all" | "earned" | "redeemed">("all");
  const merged = [...rewards.state.log, ...HISTORY];
  const rows = merged.filter((h) => filter === "all" || h.kind === filter);

  return (
    <div>
      <SectionHead title="History" sub="Every point earned, redeemed and expired." />
      <div className="mb-4 flex gap-2">
        {(["all", "earned", "redeemed"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`press min-h-9 rounded-full border px-3.5 text-xs font-medium capitalize ${
              filter === f
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border bg-surface/60 text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <ul className="glass-panel divide-y divide-border/60 rounded-2xl">
        {rows.map((h) => (
          <li key={h.id} className="row-hover grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{h.label}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(h.date).toLocaleDateString()} · {h.kind}
              </div>
            </div>
            <div
              className={`shrink-0 self-center text-sm font-bold tabular-nums ${
                h.points > 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {h.points > 0 ? "+" : ""}
              {h.points}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------ Leaderboard ------------------------------ */

function Leaderboard({ points }: { points: number }) {
  const rows = LEADERBOARD.map((r) => (r.you ? { ...r, points } : r)).sort(
    (a, b) => b.points - a.points,
  );
  return (
    <div>
      <SectionHead title="Leaderboard" sub="This month's top diners. Resets on the 1st." />
      <ol className="glass-panel divide-y divide-border/60 rounded-2xl">
        {rows.map((r, i) => (
          <li
            key={r.name}
            className={`row-hover grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 p-4 ${
              r.you ? "bg-primary/[0.08]" : ""
            }`}
          >
            <span
              className={`w-6 shrink-0 text-center text-sm font-bold tabular-nums ${
                i < 3 ? "text-warning" : "text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-xs font-bold text-primary">
              {r.initials}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {r.name}
                {r.you && <span className="ml-2 text-xs text-primary">(you)</span>}
              </div>
              <div className="truncate text-xs text-muted-foreground">{r.tier}</div>
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
              {r.points.toLocaleString()}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------------------------------- FAQ ---------------------------------- */

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div>
      <SectionHead title="FAQ" sub="Everything about points, tiers, streaks and vouchers." />
      <ul className="space-y-3">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <li key={f.q} className="glass-panel overflow-hidden rounded-2xl">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
                className="row-hover grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-left"
              >
                <span className="min-w-0 text-sm font-medium">{f.q}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <p className="drop-in border-t border-border/60 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
