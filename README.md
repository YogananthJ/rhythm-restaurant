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

### Day 5 — Intelligence Center (`/intel`)
Mission-control surface that analyzes the live floor instead of just displaying it.
- **Restaurant Health Score** (0–100) computed from kitchen backlog, waitlist, occupancy, menu availability, avg prep, and revenue trend — with band, trend arrow, confidence %, and per-signal reasons.
- **AI Ops Feed + Incident Center + Smart Recommendations** via new `generateIntelInsights` server fn (Gemini 2.5 Flash, JSON mode) fed a real snapshot of the restaurant; incidents can be dismissed / resolved locally, auto-refreshes on floor changes (60s throttle).
- **Predictive analytics**: next-hour revenue, expected kitchen load, expected queue, likely busy window, inventory risk — all derived from 24h history + current trend, with a confidence score.
- **Restaurant Replay** timeline: orders placed / advanced / closed, table status changes, waitlist joins & seatings, menu 86 events — filterable by Today / Last hour / Specific table / Specific order.
- **Recharts visualizations**: 12h revenue area, orders/hour bars, kitchen-load line, top sellers bar, live table-occupancy heatmap (colored by idle minutes).
- Skeleton loading, empty states, throttled AI, realtime subscriptions on `orders`, `order_items`, `dining_tables`, `menu_items`, `waitlist`.
- Dashboard header links to `/intel`.


### Day 4 — Host queue (waitlist)
- New `waitlist` table (party size, phone, quoted wait, status, seated table) with staff-only RLS + realtime.
- `/host` surface for the door: add walk-ins, notify guests, and one-tap seat them at any open table (auto-flips the table to `seated`).
- Live KPIs (waiting, notified, avg wait) and party-size aware table suggestions.
- Dashboard header links to `/host`.

### Day 6 — Menu Manager (`/menu`)
- Full CRUD for menu items: create, edit, delete, 86-toggle — all live.
- Category management: add/delete categories with per-category counts and filter chips.
- Search across name + description, live category filter, empty/skeleton states.
- Writes flow through the same realtime channel, so `/dashboard`, `/t/:token`, `/kds`, and `/intel` reflect changes instantly.
- Dashboard header now links to `/menu`.

### Day 7 — Guest feedback loop
- New `guest_feedback` table (rating 1–5, comment, auto-derived sentiment) with staff-only reads and a token-scoped `submit_guest_feedback` RPC — same secure guest pattern as `get_guest_order`.
- Guest order tracker (`/t/:token/order/:orderId`) grows a star-rating + comment form the moment the order is `ready`/`served`/`closed`; already-submitted reviews render read-only.
- New "Guest sentiment · 24h" panel on `/intel` — average score, rating breakdown bars, positive/neutral/negative counts, and a live scroll of the latest written comments (color-coded by rating), all wired to realtime.

### Day 8 — Autopilot (`/autopilot`) — AI Restaurant Operating System
The mission-control brain that continuously watches the floor and proposes moves before problems escalate. Tesla-Autopilot-for-restaurants.
- **Live Restaurant Brain**: subscribes to `orders`, `order_items`, `dining_tables`, `menu_items`, `waitlist`, `guest_feedback`; rebuilds a live snapshot on every change.
- **Explainable Health Score (0–100)**: deterministic client-side algorithm with per-signal contributions (Kitchen Load, Queue, Occupancy, Menu Coverage, Ticket Age, Guest Satisfaction, Revenue) — every point is traceable.
- **Action Cards**: new `generateAutopilotPlan` server fn (Gemini 2.5 Flash, JSON-mode) returns structured actions with Problem / Root Cause / Business Impact / Recommended Action / Confidence / Estimated Improvement / signals. **Approve** executes the recommended action against the live database (86 an item, re-enable an item, mark table cleaning, seat a waitlist guest, flag a ticket); **Dismiss** hides it. Nothing runs automatically.
- **Risk Radar**: probability-scored predictions with ETA and suggested intervention.
- **Digital Twin Simulator**: what-if toggles (hide item, add cook, close table, accept large reservation, rush intensity slider) instantly recompute health, avg wait, queue, kitchen backlog, projected revenue, and satisfaction.
- **Emergency Mode**: when health < 50 the whole surface flips red, header banner announces recovery focus.
- **Restaurant Memory**: 24h event timeline (orders, seating, walk-ins) — the day the restaurant lived.
- **Judge Mode**: demo toggle that seeds realistic activity into the real database every ~7s (orders, kitchen advances, table cycling) so the whole system lights up live during a demo. Off by default.
- Autopilot sweeps every 45s automatically; "Run now" for on-demand.
- Dashboard header links to `/autopilot`.

### Day 9 — Reservations
- New `reservations` table (guest name, phone, email, party size, requested time, status, notes, optional table) — anon can insert (with strict validation), staff-only read/update/delete, realtime enabled.
- Public booking page (`/book`) — no login required; datetime picker, party size, phone, email, special requests; instant confirmation screen with a reference code.
- Host stand (`/host`) now shows a Reservations panel: pending vs confirmed, time-to-arrival, one-tap Confirm / Cancel, and one-tap Seat that flips a live table to `seated` — all realtime across every open host tab.
- Landing header has a "Reserve" link straight into `/book`.

### Day 9.5 — Guest check-in panel
- Host stand gets an "Arrivals" panel showing reservations in the ±30/60m window, color-coded (green = arriving soon, red = late).
- One-tap **Mark arrived & seat** auto-picks the best-fit open table (preferred table first, then smallest table that fits the party), flips the reservation to `seated`, and updates the dining table to `seated` — all realtime.
- If no table is open the guest is marked `confirmed` and held at the door with a toast.
- Same **Check in** action added inline to every reservation card in the list.

### Day 10 — Reservation RBAC, audit log & analytics
- **RBAC**: reservations remain staff-only (admin/manager/host/waiter) for read/update, admin/manager for delete; public inserts kept behind strict `WITH CHECK` validation.
- **Audit log**: new `reservation_events` table + `AFTER INSERT/UPDATE/DELETE` trigger records `created`, `status_change` (with from/to), `table_assigned`, and `deleted` events with actor + details JSON. Staff-only read, realtime enabled.
- **Capacity check**: new `check_reservation_capacity` RPC (SECURITY DEFINER, callable by anon) evaluates seats booked in a ±90m window vs total seats. Public `/book` calls it before insert and blocks over-booking with an inline message.
- **Analytics**: `/dashboard` gains a "Reservations · today" panel — upcoming, seated today, live occupancy %, avg wait-to-seat (computed from event log), no-shows, cancelled — plus a live "Event log" audit feed of the latest 15 reservation actions.

## Surfaces
| Route | For | What it does |
|---|---|---|
| `/` | Everyone | Landing + product story |
| `/auth` | Staff | Sign up / sign in |
| `/book` | Guest | Public reservation form, no login |
| `/autopilot` | Manager | AI operating system: action cards, risk radar, digital twin, emergency mode, judge mode |
| `/dashboard` | Manager | Live floor, menu 86, table status, orders |
| `/ops` | Manager | AI copilot + 24h analytics + shift brief |
| `/host` | Host | Walk-in queue + reservations, notify + seat guests |
| `/intel` | Manager | Health, AI feed, incidents, replay, predictions, charts, guest sentiment |
| `/menu` | Manager | Full menu + category CRUD, realtime |
| `/kds` | Kitchen | Ticket board, advance order stages |
| `/tables` | Manager | Printable QR codes for every table |
| `/t/:token` | Guest | Live menu, cart, place order |
| `/t/:token/order/:orderId` | Guest | Live order status tracker + post-meal feedback |



## Stack
TanStack Start · React 19 · TypeScript · Tailwind v4 · Lovable Cloud (Supabase: Auth + Postgres + Realtime + RLS) · Lovable AI Gateway (Gemini 2.5 Flash) · qrcode.react.
