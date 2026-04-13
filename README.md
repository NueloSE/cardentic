# Cardentic

**AI agent orchestration with x402 micropayments on Stellar**

Cardentic is a platform where you describe a task, pay exactly what it costs, and a coordinated team of AI agents gets to work — each agent paid automatically via the [x402 protocol](https://x402.org) using USDC on the Stellar testnet.

> Built for the **Stellar Agents × x402 × Stripe MPP Hackathon** on DoraHacks (April 2026)

**Live demo:** https://cardentic.vercel.app

---

## The problem

AI agents today can't pay each other. If you want a "research agent" to hire a "flight agent" and a "hotel agent", someone has to pre-fund wallets, manage API keys, and wire up billing logic by hand. The economics of multi-agent pipelines are completely manual — and that friction stops autonomous agent networks from existing at all.

x402 changes this. It's HTTP 402 — a status code that has existed since 1995 but was never implemented — finally put to use. An agent that needs to be paid simply returns `402 Payment Required`. The calling agent reads the payment terms, signs a Stellar transaction, and retries. No pre-authorization, no shared wallets, no middleman. Just HTTP.

Cardentic is a proof that this works end-to-end: a user pays once with a card, and from that point forward every agent in the pipeline earns and gets paid autonomously, on-chain, in real time.

---

## What it does

1. You describe a task (e.g. *"Plan a 3-day trip to Lagos under $600"*)
2. A Boss Agent uses Claude to select the most relevant specialist agents from the marketplace
3. It shows you a transparent cost breakdown — exactly what each agent charges
4. You pay via Stripe (test card works instantly)
5. The Boss Agent funds itself with USDC on Stellar testnet, then pays each sub-agent individually via x402 micropayments
6. Each agent does its job (research, planning, analysis) and gets paid
7. A Summarizer agent synthesises all results into a final answer
8. You see a live log of every payment and step, including on-chain transaction hashes

---

## Architecture

```
User (browser)
    │
    ├─ POST /api/agent/estimate
    │       └─ Claude selects agents + subtasks
    │       └─ Plan saved to Supabase (task_plans)
    │       └─ Returns: agents list + total cost
    │
    ├─ POST /api/stripe/checkout
    │       └─ Creates Stripe session with exact dynamic amount
    │       └─ Attaches plan ID to Stripe session
    │
    │   [Stripe redirect → user pays]
    │
    ├─ Stripe webhook → POST /api/stripe/webhook
    │       └─ Verifies payment
    │       └─ Mints USDC to Boss Agent wallet on Stellar testnet
    │       └─ Triggers Boss Agent (async)
    │
    └─ GET /api/agent/stream/[sessionId]  ← SSE live feed
            └─ Boss Agent runs:
                   ├─ Retrieves stored plan from Supabase
                   ├─ Creates x402-enabled fetch client
                   ├─ Calls each sub-agent (POST with payment)
                   │     └─ Agent returns 402 → Boss signs → settles on Stellar
                   │     └─ Each payment emitted as live SSE event
                   └─ Calls Summarizer agent
                         └─ Returns structured final result
```

---

## Key concepts

### x402 micropayments

The [x402 protocol](https://x402.org) is an open standard for machine-to-machine payments over HTTP:

1. Client makes a `POST` request to an agent endpoint
2. Server responds with `402 Payment Required` + a `X-Payment-Required` header describing what to pay (amount, network, address)
3. Client signs a Stellar transaction and retries with `X-Payment` header
4. A facilitator (`x402.org/facilitator`) verifies and settles the payment on-chain
5. Server gets confirmation and returns the result

This enables truly autonomous agent economies — no wallets to configure, no pre-authorization needed. Each agent is a self-sovereign economic actor.

### Boss Agent orchestration

The Boss Agent is the coordinator:
- Fetches all available agents from the Supabase registry (not hardcoded)
- Uses Claude Haiku to select the right agents based on the task description
- Assigns a specific subtask to each selected agent
- Pays each agent autonomously via x402
- Passes all results to a Summarizer agent for a coherent final answer
- Emits real-time SSE events for every step so the UI updates live

### Hosted agents (zero-code registration)

Anyone can register an AI agent on the marketplace **with no code required**:

1. Fill in name, description (this becomes the system prompt), category, Stellar wallet address, and price
2. Cardentic auto-generates a hosted x402 endpoint: `https://cardentic.vercel.app/api/hosted/{id}`
3. The endpoint is fully functional — it validates x402 payments, runs Claude Haiku scoped to the description, and sends the payment to the registered Stellar address
4. The agent is immediately discoverable and usable by the Boss Agent

### Dynamic pricing

Pricing is not fixed. Before payment:
1. `/api/agent/estimate` runs Claude selection to choose the right agents for the task
2. Total = sum of selected agent prices + 0.50 USDC platform fee
3. Stripe is charged the exact USD equivalent
4. The plan is stored in Supabase with a 30-minute TTL
5. After payment, Boss Agent retrieves the same plan — Claude runs only once per task

---

## Project structure

```
cardentic/
├── agents/
│   └── bossAgent.ts              # Core orchestration logic
├── app/
│   ├── page.tsx                  # Home: task input + cost preview
│   ├── process/[sessionId]/      # Live pipeline view (SSE)
│   ├── marketplace/              # Agent registry browser
│   │   └── register/             # Register a new agent
│   └── api/
│       ├── agent/
│       │   ├── estimate/         # Pre-payment agent selection + cost
│       │   └── stream/[sessionId]/ # SSE event stream
│       ├── stripe/
│       │   ├── checkout/         # Create Stripe checkout session
│       │   ├── webhook/          # Handle payment confirmation
│       │   └── status/[sessionId]/ # Poll session status
│       ├── registry/
│       │   ├── agents/           # GET all agents (with filter/search)
│       │   └── register/         # POST register new agent
│       ├── hosted/[agentId]/     # Auto-hosted x402 agent endpoint
│       ├── agents/               # Built-in agents (flight, hotel, etc.)
│       └── test/trigger-pipeline/ # Dev-only: bypass Stripe for testing
├── components/
│   ├── AgentCard.tsx             # Agent status card
│   ├── FlowStep.tsx              # Pipeline step indicator
│   ├── LogPanel.tsx              # Live event log
│   └── TransactionBadge.tsx      # Stellar tx link badge
└── lib/
    ├── agentPlanner.ts           # Shared: Claude selection + Supabase plan ops
    ├── emitter.ts                # Global SSE event emitter (persists across modules)
    ├── session.ts                # In-memory session state
    ├── stellar.ts                # Stellar SDK helpers + USDC minting
    ├── supabase.ts               # Supabase client + Agent type
    ├── utils.ts                  # cn(), shortenHash(), etc.
    └── x402.ts                   # x402-enabled fetch factory
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + Radix UI |
| AI | Anthropic Claude Haiku (claude-haiku-4-5) |
| Payments | Stripe (fiat) + x402 (micropayments) |
| Blockchain | Stellar testnet (USDC) |
| Database | Supabase (PostgreSQL) |
| x402 | @x402/fetch, @x402/stellar, @x402/core v2.9 |
| Deployment | Vercel |

---

## Database schema

### `agents` table
Stores all registered agents in the marketplace.

```sql
create table agents (
  id              uuid    default gen_random_uuid() primary key,
  name            text    not null,
  description     text    not null,        -- becomes the Claude system prompt
  category        text    not null check (category in ('travel','finance','research','utilities','other')),
  endpoint_url    text    not null,        -- auto-generated hosted endpoint
  stellar_address text    not null,        -- where x402 payments go
  price_usdc      numeric(10,2) not null default 0.20,
  owner_name      text,
  owner_email     text,
  is_active       boolean default true,
  created_at      timestamptz default now()
);
```

### `task_plans` table
Stores pre-computed agent selection plans (created before payment, retrieved after).

```sql
create table task_plans (
  id               uuid    default gen_random_uuid() primary key,
  stripe_session_id text,
  task             text    not null,
  agents           jsonb   not null,        -- selected agents + subtasks
  total_usdc       numeric(10,2) not null,
  platform_fee_usdc numeric(10,2) not null default 0.50,
  charge_usd       numeric(10,2) not null,
  status           text    not null default 'pending',  -- pending | paid
  created_at       timestamptz default now(),
  expires_at       timestamptz default (now() + interval '30 minutes')
);
```

---

## Running locally

### Prerequisites

- Node.js 18+
- Supabase project (free tier works)
- Stripe account (test mode)
- Anthropic API key
- Stellar testnet account with XLM (for gas) and USDC

### Environment variables

Create `.env.local`:

```env
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stellar — Boss Agent wallet
STELLAR_SECRET_KEY=S...      # Boss Agent's Stellar secret key

# App URL (for Stripe success redirect)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Stellar testnet setup:** Create a keypair at https://laboratory.stellar.org, fund it with XLM via friendbot, then add a USDC trustline (issuer: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`).

### Install and run

```bash
npm install
npm run dev
```

### Stripe webhook (local)

Install [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret printed by the CLI into `STRIPE_WEBHOOK_SECRET`.

### Supabase setup

Run the two SQL blocks above in the Supabase SQL editor to create the `agents` and `task_plans` tables.

Seed some starter agents (optional):

```sql
insert into agents (name, description, category, endpoint_url, stellar_address, price_usdc)
values
  ('Flight Researcher', 'Find and compare flight options for travel routes. Return airlines, prices, layovers, and booking tips as JSON.', 'travel', 'https://cardentic.vercel.app/api/agents/flight-researcher', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5', 0.30),
  ('Hotel Researcher', 'Research hotel options for a destination. Return property names, prices, ratings, and neighbourhoods as JSON.', 'travel', 'https://cardentic.vercel.app/api/agents/hotel-researcher', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5', 0.25);
```

---

## API reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/agent/estimate` | Select agents + return cost breakdown |
| `POST` | `/api/stripe/checkout` | Create Stripe session with exact charge |
| `POST` | `/api/stripe/webhook` | Stripe webhook: confirm payment + start pipeline |
| `GET` | `/api/agent/stream/[sessionId]` | SSE stream of live pipeline events |
| `GET` | `/api/registry/agents` | List all agents (supports `?category=` and `?q=`) |
| `POST` | `/api/registry/register` | Register a new agent |
| `GET/POST` | `/api/hosted/[agentId]` | Auto-hosted x402 agent endpoint |
| `POST` | `/api/test/trigger-pipeline` | Dev only: bypass Stripe and trigger pipeline directly |

### SSE event types

Events emitted on the `/api/agent/stream/[sessionId]` channel:

| Event type | Payload | Description |
|---|---|---|
| `session_start` | `{ task, amount }` | Payment confirmed |
| `funding` | — | Initiating USDC transfer |
| `funded` | `{ txHash }` | USDC arrived at Boss Agent wallet |
| `planning` | `{ subtasks[] }` | Agents selected, subtasks assigned |
| `agent_paying` | `{ agent, amount }` | Boss paying agent via x402 |
| `agent_paid` | `{ agent, amount, txHash }` | Payment settled on Stellar |
| `agent_done` | `{ agent, preview }` | Agent completed its subtask |
| `aggregating` | — | Summarizer starting |
| `complete` | `{ result }` | Final result ready |
| `error` | `{ message }` | Pipeline error |

---

## How to test

1. Open https://cardentic.vercel.app
2. Enter a task, e.g. *"Research the top 3 budget hotels in Lisbon and compare them"*
3. Click **See cost breakdown** — Claude selects agents in ~2 seconds
4. Review the agent lineup and total price, then click **Pay**
5. Use test card `4242 4242 4242 4242`, any future date, any CVC
6. You're redirected to the live pipeline view — watch the log and agent cards update in real time
7. The final result appears when all agents complete

For a local dev cycle without Stripe, `POST /api/test/trigger-pipeline`:
```bash
curl -X POST http://localhost:3000/api/test/trigger-pipeline \
  -H "Content-Type: application/json" \
  -d '{"task": "Compare top 3 AI cloud providers"}'
```

The response includes a `sessionId`. Open the live pipeline view directly:
```
http://localhost:3000/process/<sessionId>
```

The SSE stream connects automatically and the pipeline runs in real time — no Stripe redirect needed.

---

## Agent marketplace

The marketplace at `/marketplace` lists all registered agents. Anyone can:

1. **Browse** agents by category (travel, finance, research, utilities)
2. **Search** by name or description
3. **Register** a new agent at `/marketplace/register` with no code — just fill in the form

Registered agents get an auto-hosted endpoint and are immediately eligible to be selected by the Boss Agent for relevant tasks. Payments flow directly to the agent owner's Stellar wallet via x402 — Cardentic never holds the funds.

---

## Hackathon submission notes

This project demonstrates all three hackathon sponsor integrations:

**Stellar**
- USDC minted to Boss Agent wallet on Stellar testnet after Stripe payment
- Every sub-agent payment settles as a real Stellar transaction
- Transaction hashes displayed as clickable links to stellar.expert

**x402**
- All sub-agent endpoints are x402-gated (respond with `402 Payment Required`)
- Boss Agent uses `@x402/fetch` with `createX402Fetch()` for automatic payment handling
- Hosted agent endpoints use `buildPaymentRequired()` from `@x402/core/server`
- Public facilitator at `https://www.x402.org/facilitator` handles settlement on testnet

**Stripe**
- User pays via Stripe Checkout (test mode)
- Webhook confirms payment before pipeline starts
- Dynamic pricing: Stripe charge equals exactly the sum of selected agent costs

---

## Known limitations

- **Testnet only** — all Stellar transactions use the Stellar testnet. No real USDC or XLM is involved at any point.
- **Stripe test mode** — the Stripe integration uses test keys. No real card charges occur. Use `4242 4242 4242 4242` with any future date and any CVC.
- **AI responses are simulated** — hosted agents run Claude Haiku scoped to their description, but they don't have access to live internet data (flights, hotels, prices). Results are research-quality summaries, not real-time bookings.
- **In-memory session state** — the SSE event emitter and session store are in-memory. On Vercel, serverless function cold starts mean very long-running pipelines may occasionally miss early events. The pipeline still completes; the live log may be partial on reconnect.
- **Single Boss Agent wallet** — the `STELLAR_SECRET_KEY` env var funds one shared Boss Agent wallet. In production each session would use an ephemeral keypair.
- **Rate limits** — Claude Haiku has per-minute token limits. Running many concurrent pipelines locally may hit rate limits.

---

## License

MIT
