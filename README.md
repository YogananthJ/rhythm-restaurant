# Occupancy

> The AI-powered nervous system for modern restaurants — from the guest's first scan to the manager's last report.

---

## 🧭 Overview

Restaurants lose money in the gaps: an 86'd item still on the menu, a ticket sitting too long on the pass, a reservation that never got seated, a manager staring at yesterday's spreadsheet instead of tonight's floor.

**Occupancy** closes those gaps. It's a single, realtime operating system that connects the guest at the table, the cook on the line, the host at the door, and the manager on the floor — with an AI layer that watches everything and proposes moves before problems escalate.

Unlike traditional POS + KDS bundles that only *record* what happened, Occupancy *reasons* about what is happening and what will happen next. Every surface is live, every decision is explainable, and every action is one tap away.

---

## ✨ Key Features

### 🍽 Guest Experience
Guests scan a table QR, land on a live menu that reflects real-time availability, filter by dietary needs, add favorites, receive personalized "Chef's Picks" based on time of day and order history, and place an order without downloading anything. After the meal they rate the experience — feedback flows straight into the manager's sentiment stream.

### 👨‍🍳 Kitchen Operations
A tap-optimized Kitchen Display groups tickets into *placed → preparing → ready*. Advancing a ticket automatically updates the guest tracker and the table state. Median time-to-ready, overdue tickets, and hourly throughput surface as KPIs so bottlenecks are visible the moment they form.

### 👨‍💼 Restaurant Management
The manager dashboard is the live floor: table status, open tickets, revenue, menu 86'ing, and one-tap close-out — all synchronized across every device. Menu, categories, tables, QR sheets, and staff roles are managed inline.

### 🤖 AI Intelligence
An always-on Copilot answers plain-English questions ("who's the slowest table right now?"), generates shift briefs, detects incidents, and proposes ranked actions with confidence scores and estimated impact.

### 📊 Analytics & Reporting
Weekly / monthly / yearly revenue, product-mix breakdowns, seasonal best-sellers, and one-click CSV exports for accounting.

### 📅 Reservations
Public booking page with capacity checks, host stand queue, arrivals panel, auto-best-fit seating, and a full audit log of every status change.

### 📱 QR Ordering
Every table gets a printable QR tent. Scanning resolves through a token-validating RPC — no table IDs leak, no login required.

### 🔒 Security
Role-based access, row-level security on every table, token-scoped guest RPCs, PII masking in logs, and validated writes on every public endpoint.

### ⚡ Realtime Collaboration
Orders, menu availability, table states, waitlist, reservations, and feedback stream over WebSockets. Every open tab stays in sync without a refresh.

---

## 🔄 System Workflow

```text
Guest scans QR
   → live menu (dietary filters, favorites, AI picks)
   → places order
   → kitchen ticket appears instantly on KDS
   → cook advances stage → guest tracker updates live
   → manager dashboard reflects revenue + table state
   → AI copilot analyzes the floor, flags risks, proposes actions
   → order closed → payment recorded → receipt generated
   → guest submits rating → sentiment feeds Intel Center
   → nightly analytics + shift brief prepared for next service
```

---

## 🧠 AI Capabilities

| Capability | Why it exists |
|---|---|
| **Ops Copilot** | Managers shouldn't have to query a database mid-service. Ask in plain English, get a grounded answer from a live snapshot. |
| **Predictive Analytics** | Staffing and prep decisions are made *before* the rush, not during it. Forecasts next-hour revenue, kitchen load, and queue. |
| **Health Score** | A single 0–100 number turns dozens of signals into an at-a-glance state of the restaurant, with per-signal contributions so it's never a black box. |
| **Recommendations** | Guests order faster and spend more when the menu meets them where they are — time of day, dietary needs, past orders, trending items. |
| **Incident Detection** | Problems (stale tickets, low menu coverage, long waits) are surfaced with root cause and business impact before a guest complains. |
| **Shift Brief** | End-of-shift context transfer is where information dies. The AI writes a Numbers / Wins / Watch-outs handoff automatically. |
| **Restaurant Memory** | A queryable timeline of the service — what happened, when, and why — so post-mortems take minutes, not meetings. |
| **Digital Twin** | Test decisions ("close two tables", "86 the risotto", "add a cook") against a live simulation before committing them to the floor. |
| **Risk Radar** | Probability-scored predictions with ETA and suggested intervention — the difference between reacting and preventing. |
| **Autopilot** | Continuously watches the floor and proposes ranked, explainable actions. Nothing runs without a human tap. |

---

## 🤖 AI Usage

Occupancy integrates **Google Gemini** to provide an AI-powered Restaurant Copilot.

### AI Model

- Google Gemini (via the Lovable AI Gateway — no user-supplied API key required)

### Current AI Capabilities

- Conversational restaurant assistant
- Answers restaurant-related queries
- Provides operational guidance
- Assists users using the application's available context
- Natural language interaction through a chatbot interface

### AI Safety Guardrails (`src/lib/ai-guardrails.ts`)

- Hardened Occupancy Copilot system prompt — restaurant-scope only, never invents data.
- Prompt-injection, role-override, credential-probe, destructive-SQL and jailbreak detection.
- Off-topic redirection, prompt length caps, control-character normalisation.
- Live data is wrapped in a `LIVE CONTEXT` block marked as data, never instructions.
- Secrets, emails and phone numbers are redacted from prompts, answers and logs.

### AI Audit Log (`ai_audit_log` table + `/insights`)

Every AI call records the feature, prompt, retrieved context, answer, outcome
(`answered` / `blocked` / `error`), block reason, model, latency and token usage —
scoped per restaurant, staff-readable, insert-only (no edits or deletes).

### Shipped AI Modules

- **Revenue insights** — hour-of-day, weekday and daily trends with AI-explained drivers (`getRevenueInsights`).
- **Intelligent menu recommendations** — predicted demand + availability + kitchen-load-adjusted prep times (`getMenuRecommendations`).
- **Context-aware copilot** — answers from live occupancy, kitchen status, tables, reservations, waitlist and recent orders (`askOpsAssistant`).

### Future Enhancements

- AI-powered demand forecasting across seasons
- Automated staffing recommendations

---




## 🏗 Architecture

```text
┌─────────────────────────────────────────────────────────┐
│  React 19 + TanStack Start (SSR, file-based routing)    │  Frontend
└──────────────┬──────────────────────────┬───────────────┘
               │ server functions         │ realtime (WS)
               ▼                          ▼
┌───────────────────────────┐   ┌────────────────────────┐
│  TanStack Server Fns      │   │  Realtime Engine        │
│  (typed RPC, edge worker) │   │  (Postgres → WS fanout) │
└──────────┬────────────────┘   └────────────┬───────────┘
           │                                 │
           ▼                                 ▼
┌─────────────────────────────────────────────────────────┐
│  Postgres + RLS + SECURITY DEFINER RPCs                 │  Data
│  Auth (email + Google OAuth, JWT claims)                │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│  AI Gateway → Gemini 2.5 Flash (JSON-mode reasoning)    │  Intelligence
└─────────────────────────────────────────────────────────┘
```

- **Frontend** renders SSR from the edge and hydrates with React 19.
- **Server functions** enforce auth via middleware and call the DB with the user's JWT so RLS applies.
- **Realtime** streams row changes directly to subscribed clients.
- **AI layer** is invoked from server functions with a curated snapshot — never raw user input.

---

## 🛠 Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TanStack Start, TanStack Router, TanStack Query |
| Styling | Tailwind CSS v4, shadcn/ui, OKLCH design tokens |
| Backend | TanStack server functions (edge worker) |
| Database | Postgres (Lovable Cloud / Supabase) |
| Auth | Supabase Auth (Email + Google OAuth), JWT claims, RBAC via `user_roles` |
| Realtime | Supabase Realtime (Postgres logical replication → WebSockets) |
| AI | Lovable AI Gateway · Google Gemini 2.5 Flash (JSON mode) |
| Charts | Recharts |
| PDF / QR | jsPDF, qrcode.react |
| Deployment | Edge runtime (Cloudflare Workers) via Lovable |

---

## 📦 Core Modules

| Module | Purpose | Main Features | Users |
|---|---|---|---|
| **Landing** | Convert visitors, showcase product | Live floor mockup, KDS preview, AI preview, session-aware CTAs | Everyone |
| **Dashboard** | Live floor control | Table map, orders, menu 86, KPIs, close-out, reservations panel | Manager |
| **Kitchen Display** | Ticket workflow | 3-stage board, one-tap advance, auto table sync, KPI overlay | Kitchen |
| **Host Panel** | Door + waitlist + arrivals | Walk-in queue, party-size suggestions, one-tap seat, reservation check-in | Host |
| **Reservations** | Public booking | Datetime + party size, capacity check, instant confirmation code | Guest |
| **Reports** | Sales intelligence | Weekly/monthly/yearly, product mix, seasonal, CSV export | Manager |
| **Autopilot** | AI operating system | Health score, action cards, risk radar, digital twin, emergency mode | Manager |
| **Intel Center** | Live analytics + AI feed | Health score with reasons, incidents, replay, guest sentiment | Manager |
| **Ops Copilot** | Chat + shift brief | Grounded Q&A, 24h analytics, AI handoff | Manager |
| **Menu Manager** | Full menu CRUD | Categories, dietary tags, 86-toggle, search | Manager |
| **QR Ordering** | Guest menu + cart | Realtime menu, dietary filters, favorites, upsells | Guest |
| **Guest Tracking** | Live order status | 4-stage tracker, post-meal rating + comment | Guest |
| **Billing** | Revenue hub | Split / merge orders, coupons, payments, PDF receipts | Manager |

---

## ⚡ Realtime Features

| Stream | What syncs live |
|---|---|
| Orders | Placement, stage advance, close-out |
| Kitchen | Ticket state across every KDS device |
| Menu Availability | 86 toggles propagate to guest menus instantly |
| Tables | Status changes (open / seated / cleaning) |
| Reservations | Booking, confirmation, seating, audit log |
| Waitlist | Party added, notified, seated |
| Feedback | New guest ratings + comments |
| Analytics | Auto-refresh on any qualifying event |

---

## 🔒 Security

- **RBAC** via `user_roles` table + `has_role()` security-definer function — never stored on profile.
- **Row Level Security** enabled on every public table; policies gated by role.
- **Guest Token Access** — no anon reads on orders/tables. Guests hit `resolve_table_by_qr` and `get_guest_order` RPCs that validate access tokens server-side.
- **Input Validation** — Zod on every server function; capped quantities/prices; freshness checks on public inserts.
- **Secure RPCs** — SECURITY DEFINER with pinned `search_path`; EXECUTE revoked from anon on internal functions.
- **Audit Logs** — `reservation_events` records every create/update/delete with actor + diff.
- **PII Protection** — auth debug log masks emails and stores a stable short hash for correlation without exposing addresses.

---

## 📈 Scalability

| Scale | How it works |
|---|---|
| **Single restaurant** | Single tenant row; edge-rendered SSR handles all traffic with zero cold start. |
| **Multiple branches** | Restaurants are first-class rows; every domain table is `restaurant_id`-scoped and RLS-partitioned. Add a location by inserting a row. |
| **Franchise chains** | Roles compose vertically (chain admin → region manager → store manager); analytics roll up via SQL views without schema changes. |

Realtime fanout is per-channel, so adding branches doesn't multiply subscription cost linearly on any single client.

---

## 💡 Innovation

- **AI-first, not AI-bolted-on** — the AI reasons over a curated live snapshot on every meaningful change, not from a chat prompt in isolation.
- **Explainable Health Score** — every point of the 0–100 score traces back to a signal contribution. No black-box vibes.
- **Digital Twin Simulator** — what-if the floor before you commit. Managers get to *rehearse* decisions.
- **Autopilot with human-in-the-loop** — proposes, never executes. Confidence + estimated impact on every card.
- **Live Intelligence, not dashboards** — the Intel Center reacts to the floor, not to a page refresh.
- **Restaurant Memory** — the day the restaurant lived, as a queryable timeline.

---

## 📁 Folder Structure

```text
occupancy/
├── src/
│   ├── routes/                    # File-based routing (TanStack)
│   │   ├── __root.tsx             # App shell + global auth listener
│   │   ├── index.tsx              # Landing
│   │   ├── auth.tsx               # Sign in / up + Google OAuth
│   │   ├── book.tsx               # Public reservations
│   │   ├── health.tsx             # System health probe
│   │   ├── _authenticated/       # Staff-only subtree
│   │   │   ├── dashboard.tsx
│   │   │   ├── kds.tsx
│   │   │   ├── host.tsx
│   │   │   ├── menu.tsx
│   │   │   ├── tables.tsx
│   │   │   ├── ops.tsx
│   │   │   ├── intel.tsx
│   │   │   ├── autopilot.tsx
│   │   │   ├── reports.tsx
│   │   │   └── billing.tsx
│   │   └── t/                     # Guest QR flow
│   │       ├── $token.tsx
│   │       └── $token.order.$orderId.tsx
│   ├── lib/                       # Server functions + utilities
│   │   ├── ai-ops.functions.ts
│   │   ├── intel.functions.ts
│   │   ├── autopilot.functions.ts
│   │   ├── auth-log.ts
│   │   ├── money.ts
│   │   └── receipt.ts
│   ├── components/                # UI + feature components
│   ├── hooks/                     # useAuth, useMobile, ...
│   ├── integrations/supabase/     # Generated client + middleware
│   └── styles.css                 # Tailwind v4 + design tokens
├── supabase/                      # Migrations + config
├── tests/e2e/                     # Playwright suites
└── README.md
```

---

## 🚀 Installation

```bash
# 1. Clone
git clone <repo-url> occupancy && cd occupancy

# 2. Install
bun install       # or: npm install

# 3. Configure environment
cp .env.example .env
# fill in the values below

# 4. Run
bun run dev
```

---

## 🔑 Environment Variables

```dotenv
# Public (safe in the browser)
VITE_SUPABASE_URL="https://<project>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
VITE_SUPABASE_PROJECT_ID="<project-id>"

# Server-only
SUPABASE_URL="https://<project>.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_PROJECT_ID="<project-id>"

# AI Gateway (server-only)
LOVABLE_API_KEY="lov_..."
```

---

## 🧪 Running Locally

```bash
bun run dev          # start dev server on :8080
bun run build        # production build
bun run typecheck    # tsgo
bunx vitest run      # unit tests
python tests/e2e/auth_crosstab_all_routes.py   # e2e smoke
```

---

## ☁️ Deployment

Occupancy deploys to an edge runtime (Cloudflare Workers) via Lovable's hosting:

1. Push to the connected repository.
2. The platform builds with Vite and bundles server functions for the Worker.
3. Environment variables are injected server-side; public vars are inlined at build.
4. Realtime and Auth are served by the managed Postgres/Supabase project.

Stable URLs:
- Production: `https://rhythm-restaurant.lovable.app`
- Preview: automatic per-branch preview URL

---

## 🖼 Screenshots

| Surface | Preview |
|---|---|
| Landing Page | _[screenshot placeholder]_ |
| Manager Dashboard | _[screenshot placeholder]_ |
| Kitchen Display | _[screenshot placeholder]_ |
| Reservations | _[screenshot placeholder]_ |
| Intel Center | _[screenshot placeholder]_ |
| Autopilot | _[screenshot placeholder]_ |
| Reports | _[screenshot placeholder]_ |
| QR Ordering | _[screenshot placeholder]_ |

---

## 🗺 Future Roadmap

- 🎙 **Voice Ordering** — guest and staff hands-free via Web Speech + LLM intent parsing
- 📦 **Inventory Forecasting** — depletion prediction tied to menu availability
- 🏢 **Multi-Branch Analytics** — chain-level rollups and cross-store benchmarks
- 📈 **Demand Forecasting** — hour-by-hour cover predictions for staffing
- 📱 **Native Mobile Apps** — dedicated iOS/Android for host and kitchen
- 💳 **POS Integrations** — Square, Toast, Stripe Terminal
- 🚚 **Supplier Automation** — auto-reorder from usage patterns
- 🌡 **IoT Kitchen Sensors** — line temperature + prep-station telemetry into the Health Score

---

## 👥 Team

| Member | Responsibility |
|---|---|
| _Team Lead_ | Product direction, architecture, AI systems |
| _Frontend_ | UI, realtime UX, design system |
| _Backend_ | Database, RLS, RPCs, security |
| _AI / Data_ | Prompting, Intel Center, Autopilot |

---

## 🎬 Demo

- **Live Demo:** https://rhythm-restaurant.lovable.app
- **GitHub Repository:** _add link_
- **Presentation:** _add link_

---

## 🏆 Why This Project Stands Out

**Real-world impact.** Occupancy targets the operational dead zones every restaurant lives with — stale tickets, missed reservations, blind staffing, spreadsheet post-mortems — and replaces them with a single live surface.

**Technical complexity.** Edge-rendered SSR with TanStack Start, JWT-authenticated typed RPCs, row-level-secure Postgres, WebSocket realtime across every domain table, and a JSON-mode LLM pipeline that operates on curated live snapshots rather than raw prompts.

**AI innovation.** Not a chatbot glued to a dashboard. The AI is a *reasoning layer* with explainable scoring, a digital twin, a risk radar, and an autopilot that proposes ranked, human-approved actions — with confidence and estimated impact on every card.

**User experience.** Every persona — guest, cook, host, manager — has a purpose-built surface. Guests scan and order in seconds. Cooks tap tickets. Managers see one number that means something, backed by traceable reasons.

**Scalability.** Multi-tenant by construction. A single migration turns one restaurant into a chain.

**Business value.** Faster tables, fewer 86'd surprises, higher average tickets from AI upsells, fewer no-shows from confirmed reservations, and a manager who spends the shift *on the floor* — not in a spreadsheet.

Occupancy isn't a POS. It's the operating system restaurants have been missing.

### Guest experience layer (latest)

- Public routes: `/our-menu` (search, diet/spice/allergen filters), `/gallery` (masonry lightbox), `/faq`, `/contact`, `/profile` (orders, favourites, reservations, rewards).
- Landing additions: featured categories, "Why choose Occupancy", gallery strip, reserve/browse hero CTAs, expanded footer.
- Reservations: seating preference, live seat availability preview, celebratory confirmation saved to the guest profile.
- Order tracker: stage copy, progress bar and live ETA; friendly 404 for expired links.
- Errors: unified `StatusScreen` for 404 / 500 / offline / expired session, wired into the router root.
- Tests: `tests/e2e/visual_nav_regression.py` screenshots navbar dropdowns, mobile drawer and focus rings at 390 / 768 / 1440 and diffs against baselines in `tests/e2e/__screenshots__/`.

> Note: the staff menu manager stays at `/menu`; the public menu lives at `/our-menu`.
