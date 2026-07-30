import illusHero from "@/assets/illus-hero.jpg";
import illusChef from "@/assets/illus-chef.jpg";
import illusQr from "@/assets/illus-qr.jpg";
import illusAi from "@/assets/illus-ai.jpg";
import illusAnalytics from "@/assets/illus-analytics.jpg";

export type MenuRow = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  prep_minutes: number | null;
  popularity_score: number | null;
  is_available: boolean;
  category?: string | null;
};

export type DishBadge = "popular" | "chef" | "trending" | "new";

export type EnrichedDish = MenuRow & {
  image: string;
  diet: "veg" | "non-veg";
  spice: 0 | 1 | 2 | 3;
  rating: number;
  reviews: number;
  calories: number;
  category: string;
  badges: DishBadge[];
  ingredients: string[];
  allergens: string[];
};

export const DISH_IMAGES = [illusHero, illusChef, illusQr, illusAi, illusAnalytics];

export const CATEGORIES = [
  { id: "starters", label: "Starters", blurb: "Small plates to open the table" },
  { id: "mains", label: "Mains", blurb: "Signature plates from the pass" },
  { id: "grill", label: "From the grill", blurb: "Fire-kissed and smoky" },
  { id: "sides", label: "Sides", blurb: "Perfect companions" },
  { id: "desserts", label: "Desserts", blurb: "A sweet finish" },
  { id: "drinks", label: "Drinks", blurb: "Pours, brews and mocktails" },
] as const;

const VEG_HINTS = [
  "paneer", "veg", "salad", "mushroom", "tofu", "dal", "naan", "bread", "fries",
  "soda", "juice", "lemonade", "coffee", "tea", "cake", "ice", "cheese", "corn",
  "pasta", "margherita", "hummus", "soup",
];
const MEAT_HINTS = ["chicken", "beef", "lamb", "pork", "fish", "prawn", "shrimp", "steak", "bacon", "mutton", "salmon", "tuna", "egg"];
const SPICY_HINTS = ["masala", "chilli", "chili", "spicy", "peri", "curry", "tikka", "jalapeno", "buffalo", "sriracha"];

const CATEGORY_HINTS: Array<[string, string[]]> = [
  ["drinks", ["soda", "juice", "coffee", "tea", "lemonade", "water", "beer", "wine", "mojito", "cola", "shake"]],
  ["desserts", ["cake", "ice", "brownie", "pudding", "tart", "gelato", "cheesecake", "dessert"]],
  ["sides", ["fries", "naan", "rice", "bread", "side", "slaw", "dip", "sauce"]],
  ["starters", ["soup", "salad", "wings", "nachos", "bruschetta", "starter", "samosa", "hummus", "spring"]],
  ["grill", ["grill", "steak", "tikka", "kebab", "skewer", "bbq", "roast", "tandoori"]],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const has = (text: string, list: string[]) => list.some((w) => text.includes(w));

export function categoryOf(item: Pick<MenuRow, "name" | "category">) {
  if (item.category) {
    const known = CATEGORIES.find((c) => c.id === item.category || c.label.toLowerCase() === String(item.category).toLowerCase());
    if (known) return known.id;
  }
  const text = item.name.toLowerCase();
  for (const [cat, hints] of CATEGORY_HINTS) if (has(text, hints)) return cat;
  return "mains";
}

const INGREDIENT_POOL: Record<string, string[]> = {
  starters: ["Seasonal greens", "Toasted seeds", "House vinaigrette", "Cracked pepper", "Sea salt"],
  mains: ["Slow-simmered base", "Aromatic spice blend", "Fresh herbs", "Cultured butter", "Stone-ground flour"],
  grill: ["Charcoal-fired protein", "Smoked paprika rub", "Burnt lime", "Garlic confit", "Cold-pressed olive oil"],
  sides: ["Hand-cut produce", "Clarified butter", "Flaky salt", "Fresh parsley"],
  desserts: ["Single-origin cocoa", "Madagascan vanilla", "Farm cream", "Raw cane sugar"],
  drinks: ["Filtered mineral water", "Fresh citrus", "House syrup", "Crushed ice", "Mint"],
};

const ALLERGEN_POOL: Record<string, string[]> = {
  starters: ["Gluten", "Nuts"],
  mains: ["Dairy", "Gluten"],
  grill: ["Mustard", "Soy"],
  sides: ["Gluten", "Dairy"],
  desserts: ["Dairy", "Eggs", "Nuts"],
  drinks: [],
};

export function enrichDish(item: MenuRow, index = 0): EnrichedDish {
  const text = `${item.name} ${item.description ?? ""}`.toLowerCase();
  const h = hash(item.id || item.name);
  const category = categoryOf(item);

  const diet: EnrichedDish["diet"] = has(text, MEAT_HINTS)
    ? "non-veg"
    : has(text, VEG_HINTS)
      ? "veg"
      : h % 2 === 0
        ? "veg"
        : "non-veg";

  const spice = (has(text, SPICY_HINTS) ? 2 + (h % 2) : category === "desserts" || category === "drinks" ? 0 : h % 2) as EnrichedDish["spice"];

  const pop = item.popularity_score ?? 0;
  const badges: DishBadge[] = [];
  if (pop >= 60) badges.push("popular");
  if (h % 5 === 0) badges.push("chef");
  if (pop >= 40 && (item.prep_minutes ?? 99) <= 12) badges.push("trending");
  if (h % 7 === 0) badges.push("new");

  return {
    ...item,
    category,
    image: DISH_IMAGES[(h + index) % DISH_IMAGES.length],
    diet,
    spice,
    rating: Number((4.1 + ((h % 9) / 10)).toFixed(1)),
    reviews: 40 + (h % 460),
    calories: 180 + (h % 720),
    badges,
    ingredients: INGREDIENT_POOL[category] ?? INGREDIENT_POOL.mains,
    allergens: ALLERGEN_POOL[category] ?? [],
  };
}

export const BADGE_META: Record<DishBadge, { label: string; className: string }> = {
  popular: { label: "Popular", className: "border-primary/40 bg-primary/15 text-primary" },
  chef: { label: "Chef recommended", className: "border-accent/40 bg-accent/15 text-accent-foreground" },
  trending: { label: "Trending", className: "border-orange-400/40 bg-orange-400/15 text-orange-300" },
  new: { label: "New", className: "border-sky-400/40 bg-sky-400/15 text-sky-300" },
};

export const GALLERY = [
  { id: "g1", src: illusHero, title: "The dining room", tag: "Interiors", blurb: "Warm brass, low light, and banquettes built for long dinners." },
  { id: "g2", src: illusChef, title: "Chef's pass", tag: "Kitchen", blurb: "Where every ticket is called, plated and checked." },
  { id: "g3", src: illusQr, title: "Table-side ordering", tag: "Experience", blurb: "Scan, browse, order — no waiting for a server." },
  { id: "g4", src: illusAi, title: "Signature plates", tag: "Dishes", blurb: "Seasonal produce, fire, and a lot of patience." },
  { id: "g5", src: illusAnalytics, title: "Service in motion", tag: "Ambience", blurb: "A full house on a Friday night, running on rhythm." },
  { id: "g6", src: illusChef, title: "Meet the team", tag: "Chefs", blurb: "Twelve cooks, one pass, zero shouting." },
];

export const FAQS = [
  {
    q: "How do I reserve a table?",
    a: "Head to Reserve a table, pick your date, time, party size and seating preference. We check live capacity before confirming, so if the slot is offered it is genuinely available. The host stand sees your booking instantly.",
  },
  {
    q: "How does QR ordering work?",
    a: "Every table has a unique QR code. Scan it with your phone camera, the live menu opens with real-time availability, and your order goes straight to the kitchen display — no app install, no account required.",
  },
  {
    q: "Can I cancel or change a reservation?",
    a: "Yes. Call the restaurant or reply to your confirmation and the host stand will amend or release your table. We hold tables for a 15-minute grace period after the booked time.",
  },
  {
    q: "How do payments work?",
    a: "You can settle at the table or at the counter. Bills can be split by guest or by item, coupons apply automatically, and a digital receipt is generated the moment payment is recorded.",
  },
  {
    q: "Do you cater to allergies and dietary needs?",
    a: "Every dish lists its allergens and whether it is vegetarian. Add a note to your order or reservation and the kitchen sees it on the ticket before prep starts.",
  },
  {
    q: "Do I need an account to order?",
    a: "No. Guests order and track without signing in. Creating an account simply adds order history, favourites and loyalty rewards.",
  },
];

export const CONTACT = {
  name: "Occupancy Demo Kitchen",
  address: "42 Harbour Lane, Marina District, Chennai 600001",
  phone: "+91 44 4000 1234",
  email: "hello@occupancy.restaurant",
  hours: [
    { day: "Monday – Thursday", time: "11:30 – 23:00" },
    { day: "Friday – Saturday", time: "11:30 – 01:00" },
    { day: "Sunday", time: "10:00 – 22:00" },
  ],
  socials: [
    { label: "Instagram", href: "https://instagram.com" },
    { label: "X / Twitter", href: "https://x.com" },
    { label: "Facebook", href: "https://facebook.com" },
  ],
};
