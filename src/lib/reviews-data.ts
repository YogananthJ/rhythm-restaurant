import illusHero from "@/assets/illus-hero.jpg";
import illusChef from "@/assets/illus-chef.jpg";
import illusQr from "@/assets/illus-qr.jpg";
import illusAi from "@/assets/illus-ai.jpg";
import illusAnalytics from "@/assets/illus-analytics.jpg";

export type DiningType = "family" | "couple" | "business" | "friends";

export type Review = {
  id: string;
  name: string;
  initials: string;
  level: string;
  verified: boolean;
  location: string;
  visited: string; // display date
  date: string; // ISO for sorting
  rating: number;
  title: string;
  body: string;
  dishes: string[];
  photos: string[];
  helpful: number;
  diningType: DiningType;
  reply?: { author: string; role: string; body: string };
};

export const REVIEW_PHOTOS = [illusHero, illusChef, illusQr, illusAi, illusAnalytics];

export const REVIEW_STATS = {
  average: 4.9,
  customers: 15000,
  orders: 52000,
  satisfaction: 98,
  total: 15243,
  breakdown: [
    { stars: 5, pct: 78 },
    { stars: 4, pct: 15 },
    { stars: 3, pct: 5 },
    { stars: 2, pct: 1 },
    { stars: 1, pct: 1 },
  ],
};

export const REVIEWS: Review[] = [
  {
    id: "r1",
    name: "Aarthi Rajan",
    initials: "AR",
    level: "Gold Gourmet",
    verified: true,
    location: "Chennai, IN",
    visited: "June 2026",
    date: "2026-06-18",
    rating: 5,
    title: "Amazing experience",
    body:
      "The AI recommendations were incredibly accurate and the food was delicious. The QR ordering system made everything effortless — we never once had to flag down a server.",
    dishes: ["Butter Chicken", "Garlic Naan", "Fresh Lime Soda"],
    photos: [illusHero, illusChef],
    helpful: 128,
    diningType: "family",
    reply: {
      author: "Occupancy Demo Kitchen",
      role: "General Manager",
      body: "Thank you Aarthi! Chef Devan says the butter chicken is his favourite too. See you soon.",
    },
  },
  {
    id: "r2",
    name: "Daniel Okoye",
    initials: "DO",
    level: "Regular",
    verified: true,
    location: "Lagos, NG",
    visited: "June 2026",
    date: "2026-06-11",
    rating: 5,
    title: "Fastest kitchen I've seen",
    body:
      "Ordered from the table QR and the tracker showed every step. Food arrived in 12 minutes and it was still steaming.",
    dishes: ["Truffle Fries", "Wood-fired Margherita"],
    photos: [illusQr],
    helpful: 96,
    diningType: "friends",
  },
  {
    id: "r3",
    name: "Meera Iyer",
    initials: "MI",
    level: "Platinum Palate",
    verified: true,
    location: "Bengaluru, IN",
    visited: "May 2026",
    date: "2026-05-29",
    rating: 5,
    title: "Perfect anniversary dinner",
    body:
      "Booked an outdoor table in under a minute, added a special request for a quiet corner, and they honoured it exactly. Beautiful ambience and warm service.",
    dishes: ["Paneer Tikka", "Saffron Kheer"],
    photos: [illusHero, illusAnalytics, illusAi],
    helpful: 214,
    diningType: "couple",
    reply: {
      author: "Occupancy Demo Kitchen",
      role: "Host Manager",
      body: "Happy anniversary Meera — the corner table is yours whenever you're back.",
    },
  },
  {
    id: "r4",
    name: "Sofia Marchetti",
    initials: "SM",
    level: "Regular",
    verified: false,
    location: "Milan, IT",
    visited: "May 2026",
    date: "2026-05-14",
    rating: 4,
    title: "Great food, busy evening",
    body:
      "Slightly long wait at peak hour, but the live queue told us exactly how long — that honesty made all the difference. The pasta was excellent.",
    dishes: ["Tagliatelle al Ragù"],
    photos: [],
    helpful: 41,
    diningType: "business",
  },
  {
    id: "r5",
    name: "Hiro Tanaka",
    initials: "HT",
    level: "Gold Gourmet",
    verified: true,
    location: "Osaka, JP",
    visited: "April 2026",
    date: "2026-04-30",
    rating: 5,
    title: "Business lunch, zero friction",
    body:
      "Split the bill across four cards from the table itself. Receipts hit our inboxes before we stood up. This is how restaurants should run.",
    dishes: ["Chef's Bento", "Matcha Cheesecake"],
    photos: [illusAnalytics],
    helpful: 73,
    diningType: "business",
  },
  {
    id: "r6",
    name: "Priya Nair",
    initials: "PN",
    level: "Regular",
    verified: true,
    location: "Kochi, IN",
    visited: "April 2026",
    date: "2026-04-12",
    rating: 5,
    title: "Kids loved it",
    body:
      "Allergen info on every dish gave us real peace of mind. The staff flagged the nut items before we even asked.",
    dishes: ["Malabar Parotta", "Chicken Curry", "Mango Lassi"],
    photos: [illusChef, illusHero],
    helpful: 58,
    diningType: "family",
  },
  {
    id: "r7",
    name: "Liam Brennan",
    initials: "LB",
    level: "New Guest",
    verified: false,
    location: "Dublin, IE",
    visited: "March 2026",
    date: "2026-03-22",
    rating: 4,
    title: "Smooth first visit",
    body:
      "Walked in without a booking, joined the waitlist on my phone, and got a text when the table was ready. Simple and modern.",
    dishes: ["Steak Frites"],
    photos: [],
    helpful: 19,
    diningType: "friends",
  },
  {
    id: "r8",
    name: "Zainab Ali",
    initials: "ZA",
    level: "Platinum Palate",
    verified: true,
    location: "Dubai, AE",
    visited: "March 2026",
    date: "2026-03-05",
    rating: 5,
    title: "Chef's recommendations never miss",
    body:
      "I let the recommendation engine pick the whole table. Every single plate was a hit — and two of them I'd never have ordered myself.",
    dishes: ["Lamb Ouzi", "Baklava", "Turkish Coffee"],
    photos: [illusAi, illusQr],
    helpful: 167,
    diningType: "family",
    reply: {
      author: "Occupancy Demo Kitchen",
      role: "Executive Chef",
      body: "That means a lot, Zainab. The lamb ouzi is back on the specials board next week.",
    },
  },
];
