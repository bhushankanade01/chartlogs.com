# ChartLogs

A full-stack professional trading journal web app for forex/stock traders. Dark Bloomberg-terminal aesthetic. Track, analyze, and optimize trading performance.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — for password hashing

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS (dark theme forced via `document.documentElement.classList.add("dark")`)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Charts: Recharts

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — DB schema (users, trades, journal_entries, sessions)
- `lib/api-client-react/src/generated/` — generated React Query hooks + TypeScript types
- `lib/api-zod/src/generated/` — generated Zod schemas
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/chartlogs/src/pages/` — React pages (Landing, Login, Register, Dashboard, Trades, Journal, Analytics, Market, Tools, Settings)
- `artifacts/chartlogs/src/components/` — UI components including AddTradeDrawer

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → React Query hooks + Zod schemas
- Bearer token auth stored in `sessions` DB table (30-day expiry)
- Password hashing: SHA256(password + SESSION_SECRET)
- Dark mode forced globally at app init (not user-toggled)
- All numeric DB fields (prices, pnl) stored as NUMERIC strings, parsed to float in API responses

## Product

- **Dashboard**: P&L stats, equity curve chart, P&L heatmap calendar, recent trades
- **Trades**: Full trade log with search/filter, AddTradeDrawer for manual entry
- **Journal**: Per-trade notes and mood tracking
- **Analytics**: Performance by symbol, day of week, tag, emotion with charts
- **Market**: Economic calendar with high/medium/low impact events
- **Tools**: Position size calculator, R:R calculator, pip value calculator
- **Settings**: Account name, timezone, currency, default lot size

## Demo Account

- Email: `demo@chartlogs.com`
- Password: `demo1234`
- 20 seeded trades with realistic forex/gold data

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- When adding new API routes, update `lib/api-spec/openapi.yaml` first, then run codegen
- `SESSION_SECRET` must be set for password hashing to work (auth will fail silently otherwise)
- Never use `zod` directly in `api-server` — it's not in the package.json; use `@workspace/api-zod` schemas instead
- The `useGetRecentTrades` hook takes 0-1 args (options only, no params)
- `useGetAnalyticsByTag` and `useGetAnalyticsByEmotion` take no params
- GetPerformancePeriod values: `today | 7d | 30d | 3m | 1y | all` (not `1m` etc.)
- MetaApi client API domain is `agiliumtrade.ai` (NOT `agiliumtrade.agiliumtrade.ai`) — old domain returns SSL errors/404. The correct URL is `https://mt-client-api-v1.{region}.agiliumtrade.ai`. The domain is fetched dynamically via provisioning API `/users/current/servers/mt-client-api`. See `metaapi.ts` for implementation.
- `metaapi.cloud-sdk` npm is blocked by Replit firewall (crypto-js dep). Use raw fetch with the provisioning + client API URLs directly.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
