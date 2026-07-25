# Occupancy — Smart Restaurant Management System

VibeAthon 6.0 build — a live "restaurant nervous system" that keeps the kitchen, floor, and every guest in perfect sync.

**Live URL**: https://rhythm-restaurant.lovable.app

## Progress log

### Day 1 — Foundation
- Dark, high-contrast design system (emerald primary, blue accent, OKLCH tokens, glass panels, mesh gradient).
- Landing page (`/`) with animated live-floor mockup, KDS preview, AI copilot preview, feature grid.
- Lovable Cloud (Supabase) enabled and schema created: `profiles`, `user_roles` (admin/manager/kitchen/waiter/host/customer), `restaurants`, `dining_tables`, `menu_categories`, `menu_items`, `orders`, `order_items`.
- Seeded demo restaurant "Occupancy Demo Kitchen" with full menu + 8 tables.
- Auth flow (`/auth`) and `_authenticated` route guard.
- Manager live floor (`/dashboard`): realtime menu 86'ing, table status cycling, open-order feed, KPIs.

### Day 2 — Guest ordering + Kitchen Display
- Guest QR menu (`/t/:token`) — realtime; 86'd items disappear instantly; cart, notes, place order.
- Guest order tracker (`/t/:token/order/:orderId`) — 4-stage live status (placed → preparing → ready → served) via secure per-order access token.
- Kitchen Display System (`/kds`) — 3-column ticket board (placed / preparing / ready), one-tap advance.
- Global toaster for feedback across every surface.

### Day 2.5 — Security hardening
Fixed all 9 flagged findings:
- Public exposure closed on `orders` and `order_items`; staff-only read policies.
- Guest access via SECURITY DEFINER RPC `get_guest_order(order_id, access_token)`.
- Ownership + sanity validation on all guest inserts (table belongs to restaurant, quantity/price caps, freshness).
- `profiles` restricted to owner + managers/admins.
- Pinned `search_path` on trigger functions; revoked EXECUTE from anon on internal functions.

### Day 3 — AI ops copilot + analytics
- Ops Copilot (`/ops`) — chat that reads a live snapshot (tables, menu availability, active tickets, 24h orders) and answers as an on-shift GM.
- Powered by Lovable AI Gateway (`google/gemini-2.5-flash`); handles 402/429 gracefully.
- 24h analytics: revenue, orders, active tickets, avg ticket, top sellers with sparkline bars.
- Realtime auto-refresh on new orders/items.

### Day 3.5 — Table QR codes
- `/tables` page renders a printable QR code for every table (label, seats, live-menu URL).
- Print stylesheet — hit "Print all" to get a table tent sheet.
- One-click copy link + open-in-new-tab for staff testing.

### Day 3.75 — Shift handoff + payment close
- AI shift brief on `/ops`: one click generates a markdown handoff (Numbers / Wins / Watch-outs) from the last 12h of orders.
- "Close · paid" action on the dashboard for ready/served tickets — moves the order to `closed` and frees the ticket from the live queue.

## Surfaces
| Route | For | What it does |
|---|---|---|
| `/` | Everyone | Landing + product story |
| `/auth` | Staff | Sign up / sign in |
| `/dashboard` | Manager | Live floor, menu 86, table status, orders |
| `/ops` | Manager | AI copilot + 24h analytics |
| `/kds` | Kitchen | Ticket board, advance order stages |
| `/tables` | Manager | Printable QR codes for every table |
| `/t/:token` | Guest | Live menu, cart, place order |
| `/t/:token/order/:orderId` | Guest | Live order status tracker |

## Stack
TanStack Start · React 19 · TypeScript · Tailwind v4 · Lovable Cloud (Supabase: Auth + Postgres + Realtime + RLS) · Lovable AI Gateway (Gemini 2.5 Flash) · qrcode.react.
