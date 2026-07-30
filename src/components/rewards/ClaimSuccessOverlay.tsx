import { motion } from "framer-motion";
import { Coins, Gift, Ticket, Wallet, X } from "lucide-react";

import { AnimatedNumber } from "@/components/AnimatedNumber";
import type { Voucher } from "@/components/rewards/useRewards";

export type ClaimResult = Voucher & { balanceAfter: number };

/** Glassy celebration overlay shown right after a reward is claimed. */
export function ClaimSuccessOverlay({
  claim,
  onClose,
  onViewRewards,
}: {
  claim: ClaimResult;
  onClose: () => void;
  onViewRewards: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reward claimed"
      className="fixed inset-0 z-[90] grid place-items-center bg-background/70 p-4 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel relative w-full max-w-md overflow-hidden rounded-3xl p-7 text-center"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-white/5 hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-16 h-40 opacity-60 blur-3xl"
          style={{ background: "var(--gradient-primary)" }}
        />

        <motion.span
          initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.08 }}
          className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 text-primary"
        >
          <Gift className="h-8 w-8" aria-hidden="true" />
        </motion.span>

        <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">Reward claimed!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {claim.name} is now in your wallet. Show the code at your table.
        </p>

        <div className="mt-5 rounded-2xl border border-dashed border-primary/40 bg-primary/8 px-4 py-4">
          <div className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
            Voucher code
          </div>
          <div className="mt-1 font-display text-2xl font-bold tracking-[0.24em] text-primary">
            {claim.code}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-left">
          <Detail
            icon={Coins}
            label="Points spent"
            value={`-${claim.cost}`}
          />
          <Detail
            icon={Wallet}
            label="New balance"
            value={<AnimatedNumber value={claim.balanceAfter} />}
            accent
          />
          <Detail
            icon={Ticket}
            label="Valid until"
            value={new Date(claim.expiresAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })}
          />
        </dl>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onViewRewards}
            className="press inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            View my rewards
          </button>
          <button
            type="button"
            onClick={onClose}
            className="press inline-flex min-h-11 items-center rounded-xl border border-border bg-surface/60 px-5 text-sm font-semibold text-muted-foreground"
          >
            Keep browsing
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Coins;
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface/40 p-3">
      <dt className="flex items-center gap-1 text-[0.6rem] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {label}
      </dt>
      <dd
        className={`mt-1 font-display text-sm font-bold tabular-nums ${
          accent ? "rw-gold-text" : "text-foreground"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
