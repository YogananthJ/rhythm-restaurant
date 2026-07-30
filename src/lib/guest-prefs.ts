import { useEffect, useState } from "react";

const KEY = "occ_guest_prefs_v1";

export type SavedReservation = {
  id: string;
  when: string;
  party: number;
  seating: string;
  name: string;
  notes?: string;
};

export type GuestPrefs = {
  favorites: { id: string; name: string; price_cents: number }[];
  reservations: SavedReservation[];
  paymentMethod: "card" | "upi" | "cash" | "wallet";
  addresses: { id: string; label: string; line: string }[];
};

const INITIAL: GuestPrefs = {
  favorites: [],
  reservations: [],
  paymentMethod: "card",
  addresses: [],
};

function read(): GuestPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...INITIAL, ...JSON.parse(raw) } : INITIAL;
  } catch {
    return INITIAL;
  }
}

function write(next: GuestPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked — prefs stay in memory */
  }
}

/** Persist a reservation locally so guests can see it in their profile. */
export function saveReservation(r: SavedReservation) {
  if (typeof window === "undefined") return;
  const cur = read();
  write({ ...cur, reservations: [r, ...cur.reservations].slice(0, 20) });
}

export function useGuestPrefs() {
  const [prefs, setPrefs] = useState<GuestPrefs>(INITIAL);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefs(read());
    setHydrated(true);
  }, []);

  const update = (patch: Partial<GuestPrefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      write(next);
      return next;
    });

  const toggleFavorite = (item: { id: string; name: string; price_cents: number }) =>
    setPrefs((p) => {
      const exists = p.favorites.some((f) => f.id === item.id);
      const next = {
        ...p,
        favorites: exists ? p.favorites.filter((f) => f.id !== item.id) : [...p.favorites, item],
      };
      write(next);
      return next;
    });

  return { prefs, hydrated, update, toggleFavorite };
}
