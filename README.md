# United Rentals AI Co‑Pilot Prototype

A Next.js prototype for an **AI‑augmented United Rentals contact center experience**. It’s designed as a **sales-ready demo** you can walk through live with customers or internal stakeholders.

The prototype focuses on two core journeys:

- **Start Co‑Pilot**: a live, AI‑driven call simulation (with a spoofed customer).
- **Call History & Analytics**: a rich review of previous calls plus demo analytics.

## Why this exists

This repo is intentionally demo-first:

- **Production‑grade UX feel** even when services are mocked (no empty dashboards).
- **Storytelling-optimized** call flow (persona + intent cycling so each run looks different).
- **Not production**: auth, data privacy, key management, and governance are not production-hardened.

## Routes (screens) and what they do

Navigation is defined in `src/components/AppSidebar.tsx`.

| Route | What it shows | Key file(s) |
|---|---|---|
| `/` | Dashboard KPIs and demo metrics | `src/app/page.tsx`, `src/mock/app-demo-data.ts` |
| `/copilot` | Live call simulation: transcript + suggestions + customer info + chat assist | `src/app/copilot/page.tsx`, `src/lib/ur-agents.ts`, `src/components/copilot/*` |
| `/call-history` | Saved call records (summary + transcript) | `src/app/call-history/page.tsx`, `src/components/call-history/*`, `src/app/api/call-history/route.ts` |
| `/analytics` | Analytics derived from call history (with demo fallback) | `src/app/analytics/page.tsx`, `src/mock/app-demo-data.ts` |
| `/reports` | Demo report generation and “recent reports” | `src/app/reports/page.tsx`, `src/mock/reports.ts` |
| `/integrations` | Demo integrations catalog | `src/app/integrations/page.tsx`, `src/mock/integrations.ts` |

## Key journeys (how to use the prototype)

### Dashboard / Analytics

- Browse metrics and charts (seeded demo data) so the app always “feels alive”.
- Demo data is centralized in `src/mock/app-demo-data.ts`.

### Start Co‑Pilot (live call simulation)

The Co‑Pilot page is `src/app/copilot/page.tsx`. It presents:

- **Live Transcript** (left): built turn-by-turn during the demo call.
- **AI Suggestions** (middle): Resolution agent output (next best action, sentiment, steps, etc.).
- **Right drawer**: **Chat Assist** and **Customer Info** tabs.

How a standard demo call runs:

1. Click **Start Call**.
2. The app cycles to the next **persona + intent** (stored in `sessionStorage` so it continues across navigation).
3. The ISR greeting is generated (agent-driven) and added to the transcript.
4. The **spoof customer agent** responds and the transcript grows.
5. After each customer turn, the transcript-so-far is sent to the **AI suggestion agent** and the suggestion list updates.
6. The ISR response is generated (agent-driven) using the customer’s latest message.
7. After the call ends, the transcript is summarized into a structured record and saved to Call History.

There is also a scripted **“first time caller”** mode that plays a predefined transcript while still requesting suggestions each customer turn (see `CallMode` in `src/app/copilot/page.tsx`).

### End call → summary → Call History

When a call ends:

- The transcript is summarized into a `CallRecord`.
- The UI posts it to `POST /api/call-history`.
- Open `/call-history` to view the newly saved record, including the stored transcript.

Storage is optional: if MongoDB isn’t configured/available, the API still returns the record but marks that it was not persisted.

## Agents in this prototype (requested breakdown)

All agent integrations are wrapped in `src/lib/ur-agents.ts` and orchestrated by `src/app/copilot/page.tsx`.

### Summary agent (post‑call)

**Purpose**: convert a completed transcript into a structured `CallRecord` for Call History and analytics.

- **Function**: `generateCallSummary(fullTranscript, sessionId, customerName?, customerAccount?)` (`src/lib/ur-agents.ts`)
- **Invoked from**: `saveCallAndGetSummary(...)` in `src/app/copilot/page.tsx`
- **Input**: transcript as a single string (`speaker: text` lines)
- **Output**: `CallRecord` (`src/types/call-records.ts`)
- **Resilience**:
  - Retries up to 4 times.
  - Detects “error-like” LLM responses.
  - Falls back to a local heuristic summary via `buildLocalFallbackCallRecord(...)` without surfacing “fallback” language in the UI.

### Spoof customer agent

**Purpose**: simulate the customer side of a call for a realistic demo without a live caller.

- **Function**: `getSpoofAgentReply(message, sessionId)` (`src/lib/ur-agents.ts`)
- **Driven by**: `runCallLoop(...)` in `src/app/copilot/page.tsx`
- **Persona + intent**:
  - Deterministic cycling across calls (persona + intent indices are stored in `sessionStorage`).
  - Intent-specific customer opening guidance is built by `getIntentOpeningInstruction(intentValue)`.
- **Call end marker**:
  - Spoof replies may include `[CALL_END]`; the UI strips it and transitions into closing.

### Live transcript (feature)

**What it is**: a UI-managed transcript of the demo call, built from:

- “agent/ISR” lines (agent-driven phrases and replies)
- “customer” lines (spoof customer agent or scripted playback)

Where it lives:

- **Source of truth**: `transcriptRef.current` + `transcriptEntries` in `src/app/copilot/page.tsx`
- **Rendered by**: `src/components/copilot/TranscriptFeed.tsx`

What gets persisted:

- The API saves a transcript string as `stored_transcript` on the saved `CallRecord` (details below).

### AI suggestion agent (Resolution agent)

**Purpose**: produce real-time “whisper” guidance and structured suggestions from the transcript-so-far.

- **Function**: `sendTranscriptForResolution(transcript, sessionId, personaLabel?, intentValue?)` (`src/lib/ur-agents.ts`)
- **When called**: after each customer turn (standard + scripted modes)
- **Output**: normalized `ResolutionSuggestion` (`src/types/call-records.ts`)
  - Common fields: `suggested_response`, `whisper_response`, `resolution_steps`, `knowledge_references`, `escalation`, `next_best_action`, `cross_sell_opportunity`, `customer_sentiment`
- **Rendered by**: `src/components/copilot/SuggestionsPanel.tsx`

### Chat Assist agent (in-call Q&A)

The right-panel “Chat Assist” uses an agent-backed API route that requests strict JSON.

- **UI**: `src/components/copilot/CustomerAssistChat.tsx`
- **API**: `POST /api/chat-assist` (`src/app/api/chat-assist/route.ts`)
- **Response contract**: `{ structured, raw }`
  - `structured` attempts to normalize keys: **Summary**, **Key points**, **Action steps (system)**, **Caveats / policy notes**
  - The UI currently renders only **Summary** + **Key points**

## How we store call summaries in MongoDB

MongoDB storage is optional (the demo still works without it).

### Configuration

See `.env.example`. To enable persistence:

- `MONGODB_URI`
- `MONGODB_DB_NAME` (optional; defaults to `ur_copilot`)

### DB/collection

Defined in `src/lib/mongodb.ts`:

- **Database**: `process.env.MONGODB_DB_NAME ?? "ur_copilot"`
- **Collection**: `call_summaries`

### Write path (insert)

`POST /api/call-history` (`src/app/api/call-history/route.ts`) inserts:

- All `CallRecord` fields
- `stored_transcript: transcript`
- `createdAt: new Date().toISOString()`

If MongoDB is unavailable, the API returns the record with:

- `savedToHistory: false`
- `_storage: "unavailable"`

### Read path (fetch)

`GET /api/call-history` (`src/app/api/call-history/route.ts`):

- Reads, sorts by `createdAt desc`, limits to 500
- Strips `_id` and `createdAt` before returning `CallRecord[]`

## Data model (CallRecord)

The shared data contract is `CallRecord` in `src/types/call-records.ts`.

Key fields you’ll see in Call History:

- `call_summary`: identifiers + metadata (includes demo-only `spoof_persona` / `spoof_intent`)
- `summary`: narrative summary (often a JSON string if the summary agent returned structured JSON)
- `action_items`, `next_steps`, `customer_health`
- `stored_transcript`: saved transcript string

## UI / CSS stack

### Tailwind + theme

- **Tailwind CSS v4** is loaded via `@import "tailwindcss";` in `src/app/globals.css`
- `src/app/globals.css` defines the brand theme (CSS variables for palette, shadows, radius) and a “liquid glass” visual system
- PostCSS is configured in `postcss.config.mjs` (`@tailwindcss/postcss`)

### shadcn/ui

- shadcn/ui is configured by `components.json` and components live in `src/components/ui/*`
- Uses Radix UI primitives + `cn()` helper (`src/lib/utils.ts`)
- Icons: `lucide-react`

## Running the prototype

### Prerequisites

- Node.js 18+
- npm

### Install / run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Environment variables (AI + Mongo)

Copy `.env.example` to `.env` and set what you need.

Common AI variables used across the app:

- `NEXT_PUBLIC_LYZR_API_BASE_URL` (client-side agent base URL)
- `LYZR_API_BASE_URL` (server-side for `/api/chat-assist`)
- `LYZR_API_KEY`
- `LYZR_USER_ID`
- `LYZR_RESOLUTION_AGENT_ID`
- `LYZR_SUMMARY_AGENT_ID`
- `LYZR_SPOOF_AGENT_ID`
- `LYZR_CHAT_ASSIST_AGENT_ID`

Persistence:

- `MONGODB_URI`
- `MONGODB_DB_NAME`

Security note: this repo contains **hardcoded demo defaults** for some AI configuration in `src/lib/ur-agents.ts` and `src/app/api/chat-assist/route.ts` so the prototype runs without setup. Treat these as placeholders and rotate/remove them for anything beyond internal demos.

## Demo flow (suggested talk track)

1. **Dashboard / Analytics**
   - Show populated KPIs and charts (seeded demo data).
2. **Start Co‑Pilot**
   - Start a call and point out persona + intent cycling.
   - Highlight Live Transcript + AI Suggestions (sentiment, next best action, cross-sell).
   - Show Customer Info loading states (waiting → fetching → full profile after customer speaks).
   - Ask a quick Chat Assist question to show structured guidance.
3. **End call**
   - Point out “Processing chat and creating summary…”
4. **Call History**
   - Open the newest record and review the summary + stored transcript.

## Project structure (functions and folders)

```text
src/
  app/
    api/                 # Next.js route handlers (server)
      call-history/      # Mongo read/write for call records
      chat-assist/       # Agent-backed structured Q&A proxy
      customer-records/  # Demo CRM-like API
    copilot/             # Co-Pilot page (call simulation)
    call-history/        # Call history page
    analytics/           # Analytics page
    reports/             # Reports page
    integrations/        # Integrations page
    globals.css          # Tailwind imports + global theme tokens
  components/
    copilot/             # Transcript, suggestions, customer info, chat assist UI
    call-history/        # Call history UI components
    ui/                  # shadcn/ui components
    AppSidebar.tsx       # Sidebar navigation
  lib/
    ur-agents.ts         # All agent wrappers + summary fallback
    mongodb.ts           # Mongo client + call history collection getter
  mock/                  # Seed/demo data and scenarios
  types/
    call-records.ts      # Shared TypeScript contracts
docs/
  united-rentals-aerial-lift-specs.md  # Demo spec / KB reference
```

## Troubleshooting & key notes

- **Call history not saved**: Mongo is optional. If `MONGODB_URI` is unset or connection fails, the API returns `savedToHistory: false` and the UI still shows the summary for the current call.
- **Chat Assist shows partial fields**: the API returns action steps and caveats too, but the UI intentionally renders only Summary + Key points.
- **Agent responses not parseable**: `src/lib/ur-agents.ts` normalizes varied agent response shapes and falls back to local heuristics for summaries when needed.


