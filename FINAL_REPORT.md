# Fraudora Sentriq TraceX / TrustLens — Final Implementation Report

Project: Fraudora Sentriq TraceX (frontend) x TrustLens (FastAPI backend)
Date: 2026-08-31
Status: DEMO-READY — all 16 browser E2E tests PASS, TypeScript clean, production build clean

---

## 1. Executive Summary

Fraudora Sentriq TraceX is now a functional, honest, real-time fraud-monitoring prototype. All seven main dashboard modules (Dashboard/Overview, Transactions, Fraud Alerts, Transaction Graph, Cross-Border Analysis, ML/Fraud Scoring, Audit Logs) are connected to the FastAPI backend and SQLite database and update automatically when backend data changes. The application was completed by wiring the previously-written frontend API layer into the UI, fixing three backend bugs that prevented SQLite/SSE operation, and building seven new functional tab components. All displayed business data originates from the backend; no frontend random-number "live" simulation exists.

## 2. Original Problems

| # | Problem | Status |
|---|---------|--------|
| 1 | Dashboard used hardcoded mock KPI values ("12", "4,821", "94.3%") | Fixed — real /dashboard/summary |
| 2 | Alerts tab used a hardcoded mock alert array with local-only labeling | Fixed — real /alerts + /labels + /alerts/:id/status |
| 3 | Transactions tab was "Coming Soon" | Implemented — /transactions + detail + demo generator |
| 4 | Graph tab showed a static demo visualization | Implemented — real /graph (Neo4j or Postgres fallback) |
| 5 | Cross-Border tab was "Coming Soon" | Implemented — /cross-border/* aggregations |
| 6 | ML tab was "Coming Soon" | Implemented — honest /ml/status |
| 7 | Audit Logs tab was "Coming Soon" | Implemented — /audit-logs |
| 8 | Frontend data layer (lib/api.ts, data.ts, live.ts, types.ts) existed but was never imported | Fixed — all tabs now use it |
| 9 | SSE endpoint 500'd — EventBroker.subscribe() was missing | Fixed — implemented subscribe/unsubscribe |
| 10 | SQLite crash on transaction create — string UUIDs not coerced | Fixed — uuid coercion in transaction_engine |
| 11 | Neo4j absence caused 37s stalls (driver retry) | Fixed — 2s timeouts + no-retry + 60s circuit breaker |
| 12 | @tailwindcss/oxide / @rolldown native bindings broken; Vite dev server failed to start | Fixed — reinstalled bindings, upgraded vite 8.2.2, Node 24 |

## 3. Completed Features

- Authentication (login/register/me, JWT, session persistence, guest mode)
- Live dashboard with backend KPIs, risk distribution, recent alerts/transactions/activity
- Transaction monitoring (list, filters, pagination, detail modal)
- Controlled demo transaction generator (backend pipeline)
- Fraud alert queue (filters, detail/investigation modal, status change, labeling)
- Transaction graph explorer (interactive SVG, node inspector, risk filter)
- Cross-border analysis (summary, timeline, routes, country risk, high-risk list)
- ML / fraud scoring status page (honest rule-based engine status)
- Audit logs (live records of login, transactions, alerts, analyst actions)
- Real-time SSE with polling fallback, LIVE/POLLING badge, toasts, last-updated

## 4. Coming Soon Features Converted to Functional Modules

| Module | Before | After |
|--------|--------|-------|
| Transactions | "Coming Soon" fallback | Full table + detail + demo generator |
| Cross Border | "Coming Soon" fallback | 4 KPI cards + timeline + routes + country risk + high-risk table |
| ML | "Coming Soon" fallback | Scoring engine status + distributions + scoring events + adaptive learning |
| Audit Logs | "Coming Soon" fallback | Live audit table with filters |
| Graph | Static demo viz | Real backend graph, interactive |
| Investigation | Static demo card | Full alert-detail investigation modal with actions |

The only remaining "Coming Soon" text was the unknown-tab fallback in the dashboard; it has been replaced with a "Halaman tidak ditemukan" (page not found) card with a back-to-dashboard button.

## 5. Mock Data Removed

- Hardcoded KPI row (12 / 4,821 / 94.3% / 1.4s) → /dashboard/summary
- Hardcoded alerts array (TXN-0041 ... TXN-0021) → /alerts + /dashboard/recent-alerts
- Local-only labelAlert/alertLabels state → backend POST /labels + PATCH /alerts/:id/status
- Static "System Status" board (GNN Inference: Demo, Kafka: Demo, ...) → removed; replaced by real data panels
- Static HeroGraphViz/FederatedFlowDiagram in dashboard tabs → removed from dashboard (still used on marketing page)
- Guest "Demo / Graph Demo / Cross Border Demo / Technology" tabs → replaced with real backend-driven tabs (public API + polling)
- Settings "password changed" message falsely claiming persistence → now honestly labeled as demo-only

## 6. Frontend/Backend Architecture

```
React 19 + Vite 8 + TypeScript (frontend/src)
  ├── App.tsx                 — shell, theme/auth providers, routing by view
  ├── lib/api.ts              — JWT-aware fetch client (Authorization header)
  ├── lib/data.ts             — typed API functions for every endpoint
  ├── lib/types.ts            — backend response types
  ├── lib/live.ts             — SSE client with polling fallback
  ├── lib/realtime.tsx        — shared RealtimeProvider (one stream, tick-based refresh)
  ├── lib/format.ts           — currency/date/risk formatting
  └── components/             — OverviewTab, AlertsTab, TransactionsTab, GraphTab,
                                CrossBorderTab, MLTab, AuditTab, LiveBadge, Toasts
FastAPI (backend/app)
  ├── api/                    — auth, transactions, alerts, labels, dashboard,
  │                             graph, cross_border, ml, audit_logs, stream
  ├── services/               — transaction_engine (pipeline), fraud_scoring,
  │                             events (SSE broker), serializers, graph_sync
  ├── models/                 — user, account, device, merchant, country,
  │                             transaction, alert, label, audit_log
  └── db/                     — SQLite (default) / PostgreSQL, seed, neo4j (optional)
```

## 7. Real-Time Architecture

Backend event publisher → SSE (GET /api/v1/stream/events, JWT-authenticated) → frontend RealtimeProvider → tick-based data refetch in every tab. On any domain event (transaction.created, alert.created, alert.updated, audit.created) or poll tick, the provider bumps a counter; each tab refetches its own data and re-renders. No browser refresh required.

## 8. SSE Implementation

- GET /api/v1/stream/events streams `event: <type>` / `data: {json}` frames.
- Events: stream.connected (heartbeat), transaction.created, alert.created, alert.updated, audit.created.
- Broker is thread-safe (publish from worker threads, delivered to asyncio subscribers via loop.call_soon_threadsafe).
- Heartbeat every 25s; client auto-reconnects via the loop in lib/live.ts.
- Verified end-to-end: a Python SSE client received transaction.created and alert.created events immediately after demo generation.

## 9. Polling Fallback

If SSE is unavailable (guest mode, token missing, network drop), lib/live.ts falls back to a 4-second polling loop calling the same refresh function. The UI badge shows LIVE (SSE active) or POLLING (fallback) — it never claims LIVE when disconnected.

## 10. Transaction Pipeline

POST /transactions or POST /transactions/demo/generate → transaction_engine.create_scored_transaction → validate accounts/device/merchant → rule-based scoring + optional ML blend → store transaction → generate alert if score >= threshold → publish transaction.created / alert.created → audit log → best-effort Neo4j sync (skipped fast when Neo4j absent).

## 11. Fraud Scoring Pipeline

- Rule-based ensemble (always active, deterministic): risk factors include blacklisted device, blacklisted account, amount thresholds (>= Rp 150 jt large amount), cross-border to high-risk countries (NG/RU/US/PH/MY/SG), rapid velocity, new-account fraud, mule patterns, transaction frequency.
- Risk level: score >= 0.75 → HIGH, >= 0.45 → MEDIUM, else LOW.
- Optional trained-artifact blending: PaySim XGBoost tabular model and TrustLens internal adaptive model are loaded if artifacts exist (ml/registry); final score is max(rule, blend). No trained artifacts exist in this deployment, so the honest status is "Rule-Based Fraud Scoring Engine" with ML contribution inactive — the ML page states this explicitly.

## 12. Fraud Alert Pipeline

Score >= 0.75 (or rule hit) → Alert row (severity from score: critical >= 0.95, high >= 0.75, medium >= 0.6, low otherwise) with human-readable reason (semicolon-separated indicators) → alert.created SSE → toast notification → appears in queue/dashboard automatically.

## 13. Transaction Graph

GET /graph?limit=&risk_level= → Neo4j when available; otherwise a deterministic Postgres/SQLite-derived fallback graph (Account → Transaction → Account, Device, Merchant, Country nodes; SENT / RECEIVED_BY / USED_DEVICE / PAID_TO / FROM_COUNTRY / TO_COUNTRY edges). Frontend renders an interactive force-directed SVG with type colors, risk strokes, selection, neighbor highlighting and an inspector panel. Only relationships present in backend data are shown. The UI displays a SOURCE badge (NEO4J vs POSTGRES FALLBACK) and a notice when falling back.

## 14. Cross-Border Analysis

/cross-border/summary | routes | countries | high-risk-transactions | timeline — all derived from the transactions table. Displays cross-border volume/rate, per-day activity timeline, risky routes (sorted by average fraud score), country risk profiles, and a high-risk cross-border transaction table. No invented countries: only country codes present in seeded/generated data appear.

## 15. ML/Scoring Status

GET /ml/status shows: scoring engine name/mode/description, ml_models_loaded flag, processed transaction count, risk distribution (low/medium/high), status distribution, latest scoring events, adaptive learning state (labels collected vs retraining threshold), baseline model availability, active PaySim tabular model (if any), artifact count, and last update. Honest labeling: without trained artifacts the page states rule-based scoring is active.

## 16. Audit Logging

audit_logs table records: login/register, transaction created (incl. demo batches), alert generated, alert status changed, transaction labeled, DB seed. The Audit Logs tab displays time, actor, action, entity type/id, description with live refresh. Analyst actions in the alert modal record update_alert_status and create_transaction_label entries with the acting analyst's name.

## 17. Live Demo Mode

The Demo Transaction Generator (Transactions tab) posts to the real backend: POST /transactions/demo/generate?count=&scenario=. Scenarios: Random, Cross-Border High, Large Amount, Blacklisted Device. Each generated transaction goes through the full normal pipeline (store → score → alert → SSE → audit). The UI labels results with DEMO DATA and the dashboard banner states: "CONTROLLED DEMO PIPELINE — data dibuat & diproses oleh backend sendiri (bukan data keuangan sungguhan)".

## 18. Browser E2E Results (playwright-core + system Chrome, headless)

| Test | Description | Result |
|------|-------------|--------|
| 1 | App loads | PASS |
| 2 | Login (authenticated) | PASS |
| 3 | Dashboard backend data | PASS |
| 4 | Transactions table (real DB rows) | PASS |
| 5 | Demo transaction generation | PASS |
| 6 | Fraud scoring visible | PASS |
| 7 | Alert creation (toast/queue) | PASS |
| 8 | Real-time KPI update without refresh | PASS |
| 9 | Alert detail modal | PASS |
| 10 | Graph renders + inspector | PASS |
| 11 | Cross-Border | PASS |
| 12 | ML status | PASS |
| 13 | Audit logs | PASS |
| 14 | Alert status change | PASS |
| 15 | Logout | PASS |
| 16 | Login again | PASS |

Screenshots: frontend/e2e/screenshots/01-loading.png ... 14-login-again.png.

## 19. Build/Test Results

- npx tsc --noEmit → 0 errors
- npx vite build → success (394 kB JS, 13.6 kB CSS)
- Backend startup → OK (uvicorn :8000)
- GET /api/v1/health → {"status":"healthy","service":"trustlens-backend"}
- Database → SQLite backend/data/trustlens.db, migrated (alembic) + seeded (40 transactions, 29 alerts, demo accounts)
- SSE → verified receiving transaction.created / alert.created live

## 20. Known Limitations

- No real banking/financial data feed: all data is backend-generated or seeded demo data (honest, controlled demo environment).
- No trained ML artifacts: scoring is rule-based; ML blending activates only after training via /ml/train-baseline or /ml/train/paysim (requires the training datasets).
- Neo4j not running: graph uses the Postgres/SQLite fallback (SOURCE: POSTGRES FALLBACK).
- Password change on Settings is local-only (no backend endpoint) — clearly labeled.
- SSE requires a JWT; guests automatically use polling.
- No pagination on alerts/audit beyond the configured limits (50/100) — fine for demo scale.

## 21. How to Run

Prerequisites: Python 3.11+ venv with backend/requirements.txt (torch excluded — Linux-only wheel), Node.js >= 20.19 (Node 24 recommended).

Backend:
```bash
cd backend
# if first run:
python -m alembic upgrade head
python -m app.db.seeds.seed          # seeds demo users/data (idempotent)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Frontend:
```bash
cd frontend
npm install
npm run dev                          # http://localhost:8443 (proxies /api to :8000)
```
Login: analyst@trustlens.dev / password123 (or valen@trustlens.dev, operator@trustlens.dev).

## 22. How to Demo

1. Start backend + frontend (above).
2. Open http://localhost:8443 → landing page.
3. Login as analyst (credentials above) → dashboard with LIVE badge.
4. Transactions tab → Demo Transaction Generator → count 2-3, scenario Cross-Border High → Generate.
5. Watch the transaction table update automatically (SSE); toast "New fraud alert" appears.
6. Dashboard tab → KPIs (Total Transaksi, Alert Terbuka) updated automatically.
7. Alerts tab → open the new HIGH alert → review score, reason, transaction → click "investigating" → label "Tandai FRAUD".
8. Graph tab → nodes/edges from real data → click a node → inspector.
9. Cross Border tab → routes/country risk/timeline.
10. ML tab → scoring engine status + events.
11. Audit Logs tab → see login, demo_transactions_generated, create_transaction, update_alert_status entries.
12. Logout → login again to show session persistence.

## 23. Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| Dashboard | hardcoded numbers, static status board | backend KPIs, live feeds, LIVE badge |
| Transactions | Coming Soon | real table + details + demo generator |
| Alerts | mock array, local labels | real queue + investigation modal + backend status/label |
| Graph | static demo image | interactive backend graph + inspector |
| Cross-Border | Coming Soon | 5 API-backed panels |
| ML | Coming Soon | honest engine status + scoring events |
| Audit | Coming Soon | live backend audit trail |
| Real-time | none | SSE + polling fallback, toasts, auto-refresh |
| Backend bugs | SSE 500, SQLite UUID crash, Neo4j 37s stall | fixed |
| Honesty | "94.3% detection" fake metrics | all values derived from backend; demo clearly labeled |

## 24. Honest Capability/Claim Limitations

- This is a hackathon prototype in a controlled demo environment. All transactions are either seeded demo records or generated by the backend demo pipeline; they are NOT real customer banking transactions.
- The fraud scoring engine is rule-based and deterministic; it is not a trained production ML model. Optional ML blending is inactive until artifacts are trained.
- No real bank API, payment rail, or financial institution feed is connected.
- Graph data comes from the backend database (Neo4j optional); the UI always indicates the data source.
- Where a capability is not available (password-change persistence, trained models, real feeds), the UI says so instead of pretending.

Feature classification: Authentication IMPLEMENTED · Dashboard IMPLEMENTED · Transactions IMPLEMENTED · Fraud Alerts IMPLEMENTED · Transaction Graph IMPLEMENTED · Cross-Border IMPLEMENTED · ML/Fraud Scoring PARTIALLY IMPLEMENTED (rule-based; ML blending DEMO ONLY until artifacts exist) · Audit Logs IMPLEMENTED · Real-time SSE IMPLEMENTED · Real banking feeds NOT AVAILABLE (replaced by controlled demo pipeline).
