import {
  Award,
  CalendarCheck,
  Cake,
  Camera,
  Coffee,
  Crown,
  Flame,
  Gift,
  Heart,
  IceCream,
  Percent,
  Pizza,
  QrCode,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";

export type Tier = {
  id: string;
  name: string;
  min: number;
  perk: string;
  icon: LucideIcon;
};

export const TIERS: Tier[] = [
  { id: "bronze", name: "Bronze Bite", min: 0, perk: "1 point per ₹10 spent", icon: Utensils },
  { id: "silver", name: "Silver Spoon", min: 500, perk: "Priority waitlist seating", icon: Star },
  { id: "gold", name: "Gold Gourmet", min: 1000, perk: "Free dessert every month", icon: Award },
  { id: "platinum", name: "Platinum Palate", min: 2500, perk: "Chef's table access + 2x points", icon: Crown },
];

export type StoreReward = {
  id: string;
  name: string;
  cost: number;
  category: "food" | "discount" | "experience";
  blurb: string;
  icon: LucideIcon;
  tierRequired?: string;
};

export const STORE: StoreReward[] = [
  { id: "dessert", name: "Free Dessert", cost: 250, category: "food", blurb: "Any dessert from today's menu, on the house.", icon: IceCream },
  { id: "coffee", name: "Free Coffee", cost: 150, category: "food", blurb: "Freshly brewed filter coffee or cappuccino.", icon: Coffee },
  { id: "starter", name: "Free Starter", cost: 400, category: "food", blurb: "Pick any starter under ₹400.", icon: Pizza },
  { id: "off10", name: "10% Off Bill", cost: 500, category: "discount", blurb: "Applies to your entire table bill.", icon: Percent },
  { id: "off20", name: "20% Off Bill", cost: 900, category: "discount", blurb: "Max discount ₹800 per visit.", icon: Ticket },
  { id: "birthday", name: "Birthday Cake", cost: 1200, category: "experience", blurb: "500g celebration cake with candles.", icon: Cake },
  { id: "chefstable", name: "Chef's Table for 2", cost: 2000, category: "experience", blurb: "Six-course tasting menu with the head chef.", icon: Crown, tierRequired: "Gold Gourmet" },
  { id: "priority", name: "Skip-the-Queue Pass", cost: 750, category: "experience", blurb: "Jump the waitlist on any single visit.", icon: Sparkles },
];

export type Badge = {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  earned: boolean;
  progress?: { current: number; target: number };
};

export const BADGES: Badge[] = [
  { id: "first", name: "First Bite", desc: "Complete your first order", icon: Utensils, earned: true },
  { id: "streak7", name: "Week Warrior", desc: "Visit 7 days in a row", icon: Flame, earned: true },
  { id: "reviewer", name: "Critic", desc: "Write 5 reviews", icon: Star, earned: true, progress: { current: 5, target: 5 } },
  { id: "photog", name: "Food Photographer", desc: "Upload 10 dish photos", icon: Camera, earned: false, progress: { current: 6, target: 10 } },
  { id: "qr", name: "Tap & Go", desc: "Place 20 QR orders", icon: QrCode, earned: false, progress: { current: 13, target: 20 } },
  { id: "host", name: "Table Host", desc: "Book for a party of 8+", icon: Users, earned: false, progress: { current: 0, target: 1 } },
  { id: "loyal", name: "Regular", desc: "Reach 50 lifetime visits", icon: Heart, earned: false, progress: { current: 34, target: 50 } },
  { id: "legend", name: "Occupancy Legend", desc: "Reach Platinum Palate", icon: Trophy, earned: false, progress: { current: 1250, target: 2500 } },
];

export type EarnRule = { action: string; points: string; icon: LucideIcon };

export const EARN_RULES: EarnRule[] = [
  { action: "Every ₹10 spent", points: "+1", icon: Utensils },
  { action: "Complete a QR order", points: "+25", icon: QrCode },
  { action: "Write a review with a photo", points: "+50", icon: Camera },
  { action: "Daily check-in", points: "+10", icon: CalendarCheck },
  { action: "Keep a 7-day streak", points: "+100", icon: Flame },
  { action: "Refer a friend who dines", points: "+300", icon: Users },
  { action: "Birthday month bonus", points: "+500", icon: Cake },
];

export type HistoryEntry = {
  id: string;
  date: string;
  label: string;
  points: number;
  kind: "earned" | "redeemed" | "expired";
};

export const HISTORY: HistoryEntry[] = [
  { id: "h1", date: "2026-07-29", label: "Daily check-in", points: 10, kind: "earned" },
  { id: "h2", date: "2026-07-28", label: "Order #1042 — ₹1,840", points: 184, kind: "earned" },
  { id: "h3", date: "2026-07-28", label: "Redeemed — Free Coffee", points: -150, kind: "redeemed" },
  { id: "h4", date: "2026-07-26", label: "Review with photo", points: 50, kind: "earned" },
  { id: "h5", date: "2026-07-24", label: "7-day streak bonus", points: 100, kind: "earned" },
  { id: "h6", date: "2026-07-21", label: "Referral — Daniel O.", points: 300, kind: "earned" },
  { id: "h7", date: "2026-07-18", label: "Redeemed — 10% off bill", points: -500, kind: "redeemed" },
  { id: "h8", date: "2026-06-30", label: "Promo points expired", points: -75, kind: "expired" },
];

export type LeaderRow = { rank: number; name: string; initials: string; points: number; tier: string; you?: boolean };

export const LEADERBOARD: LeaderRow[] = [
  { rank: 1, name: "Zainab Ali", initials: "ZA", points: 4820, tier: "Platinum Palate" },
  { rank: 2, name: "Meera Iyer", initials: "MI", points: 3910, tier: "Platinum Palate" },
  { rank: 3, name: "Hiro Tanaka", initials: "HT", points: 2740, tier: "Platinum Palate" },
  { rank: 4, name: "Daniel Okoye", initials: "DO", points: 1980, tier: "Gold Gourmet" },
  { rank: 5, name: "You", initials: "YO", points: 1250, tier: "Gold Gourmet", you: true },
  { rank: 6, name: "Priya Nair", initials: "PN", points: 1120, tier: "Gold Gourmet" },
  { rank: 7, name: "Liam Brennan", initials: "LB", points: 640, tier: "Silver Spoon" },
  { rank: 8, name: "Sofia Marchetti", initials: "SM", points: 410, tier: "Bronze Bite" },
];

export type SpinSegment = { label: string; points: number; weight: number; color: string };

export const SPIN_SEGMENTS: SpinSegment[] = [
  { label: "10 pts", points: 10, weight: 30, color: "var(--primary)" },
  { label: "25 pts", points: 25, weight: 24, color: "var(--accent)" },
  { label: "50 pts", points: 50, weight: 18, color: "var(--primary)" },
  { label: "5 pts", points: 5, weight: 14, color: "var(--accent)" },
  { label: "100 pts", points: 100, weight: 8, color: "var(--primary)" },
  { label: "250 pts", points: 250, weight: 4, color: "var(--accent)" },
  { label: "Free Coffee", points: 150, weight: 1.5, color: "var(--primary)" },
  { label: "500 pts", points: 500, weight: 0.5, color: "var(--accent)" },
];

export const FAQS = [
  {
    q: "How do I earn Occupancy Rewards?",
    a: "You earn 1 point for every ₹10 spent, plus bonus points for QR orders, reviews, daily check-ins, streaks and referrals. Points land in your balance the moment your bill is closed.",
  },
  {
    q: "Do my points expire?",
    a: "Base points stay valid for 12 months from the day you earn them. Promotional and spin-wheel bonus points expire after 30 days — you'll always see an expiry note in your History tab.",
  },
  {
    q: "How does the daily spin work?",
    a: "You get one free spin every 24 hours. Every segment is a win — the smallest prize is 5 points and the rarest is 500 points or a free coffee. Your spin resets at midnight local time.",
  },
  {
    q: "What are streaks?",
    a: "Visit or check in on consecutive days to build a streak. Hitting 7 days in a row awards a 100-point bonus, and a 30-day streak upgrades your tier for the following month.",
  },
  {
    q: "How do tiers work?",
    a: "Tiers are based on your lifetime points: Bronze Bite (0+), Silver Spoon (500+), Gold Gourmet (1,000+) and Platinum Palate (2,500+). Redeeming rewards never lowers your tier.",
  },
  {
    q: "Can I share rewards with friends?",
    a: "Redeemed vouchers are tied to your account, but anyone at your table can enjoy them. Refer a friend and you both get 300 points once they complete their first dinner.",
  },
  {
    q: "Where do I use a redeemed reward?",
    a: "Open My Rewards, tap the voucher and show the QR code to your server — or scan it yourself at the table before you place a QR order.",
  },
];
