import { useEffect, useState } from "react";

const KEY = "occ_rewards_v1";

export type Voucher = {
  id: string;
  rewardId: string;
  name: string;
  cost: number;
  code: string;
  redeemedAt: string;
  used: boolean;
  expiresAt: string;
};

export type RewardsState = {
  balance: number;
  lifetime: number;
  streak: number;
  lastSpinAt: string | null;
  lastCheckInAt: string | null;
  vouchers: Voucher[];
  log: { id: string; date: string; label: string; points: number; kind: "earned" | "redeemed" }[];
};

const INITIAL: RewardsState = {
  balance: 1250,
  lifetime: 4310,
  streak: 7,
  lastSpinAt: null,
  lastCheckInAt: null,
  vouchers: [],
  log: [],
};

/** Client-side rewards wallet. Persists to localStorage after hydration. */
export function useRewards() {
  const [state, setState] = useState<RewardsState>(INITIAL);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...INITIAL, ...JSON.parse(raw) });
    } catch {
      /* corrupt payload — fall back to defaults */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked — wallet stays in memory */
    }
  }, [state, hydrated]);

  const addPoints = (points: number, label: string) =>
    setState((s) => ({
      ...s,
      balance: s.balance + points,
      lifetime: s.lifetime + Math.max(0, points),
      log: [
        {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          label,
          points,
          kind: "earned" as const,
        },
        ...s.log,
      ].slice(0, 50),
    }));

  const redeem = (rewardId: string, name: string, cost: number) => {
    let ok = false;
    setState((s) => {
      if (s.balance < cost) return s;
      ok = true;
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);
      const voucher: Voucher = {
        id: crypto.randomUUID(),
        rewardId,
        name,
        cost,
        code: `OCC-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        redeemedAt: new Date().toISOString(),
        expiresAt: expires.toISOString(),
        used: false,
      };
      return {
        ...s,
        balance: s.balance - cost,
        vouchers: [voucher, ...s.vouchers],
        log: [
          {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            label: `Redeemed — ${name}`,
            points: -cost,
            kind: "redeemed" as const,
          },
          ...s.log,
        ].slice(0, 50),
      };
    });
    return ok;
  };

  const markUsed = (voucherId: string) =>
    setState((s) => ({
      ...s,
      vouchers: s.vouchers.map((v) => (v.id === voucherId ? { ...v, used: true } : v)),
    }));

  const setLastSpin = () => setState((s) => ({ ...s, lastSpinAt: new Date().toISOString() }));

  const checkIn = () =>
    setState((s) => ({
      ...s,
      lastCheckInAt: new Date().toISOString(),
      streak: s.streak + 1,
      balance: s.balance + 10,
      lifetime: s.lifetime + 10,
      log: [
        {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          label: "Daily check-in",
          points: 10,
          kind: "earned" as const,
        },
        ...s.log,
      ].slice(0, 50),
    }));

  const reset = () => setState(INITIAL);

  return { state, hydrated, addPoints, redeem, markUsed, setLastSpin, checkIn, reset };
}

export function isSameDay(iso: string | null) {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.toDateString() === n.toDateString();
}
