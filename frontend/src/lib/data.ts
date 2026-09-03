// ─── Typed API data layer (TrustLens backend endpoints) ───────────────────────
// All functions reuse apiFetch() from ./api so the JWT Authorization
// header is attached automatically.

import { apiFetch } from "./api"
import type {
  Alert,
  AlertListResponse,
  AuditLogListResponse,
  CrossBorderRoute,
  CrossBorderSummary,
  CountryRiskRow,
  DashboardSummary,
  DemoGenerateResponse,
  GraphData,
  HighRiskCrossBorderTx,
  MLStatus,
  RiskLevel,
  Transaction,
  TransactionListResponse,
  TxStatus,
} from "./types"

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>("/dashboard/summary", { method: "GET" })
}

export async function fetchRecentAlerts(): Promise<Alert[]> {
  return apiFetch<Alert[]>("/dashboard/recent-alerts", { method: "GET" })
}

export async function fetchRecentTransactions(): Promise<{ items: Transaction[] }> {
  return apiFetch<{ items: Transaction[] }>("/dashboard/recent-transactions", { method: "GET" })
}

export async function fetchRecentActivity(): Promise<{ items: { id: string; actor: string; action: string; entity_type: string; entity_id?: string | null; description?: string | null; created_at: string }[] }> {
  return apiFetch("/dashboard/recent-activity", { method: "GET" })
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface TransactionQuery {
  limit?: number
  offset?: number
  risk_level?: RiskLevel
  status?: TxStatus
}

export async function fetchTransactions(query: TransactionQuery = {}): Promise<TransactionListResponse> {
  const params = new URLSearchParams()
  if (query.limit != null) params.set("limit", String(query.limit))
  if (query.offset != null) params.set("offset", String(query.offset))
  if (query.risk_level) params.set("risk_level", query.risk_level)
  if (query.status) params.set("status", query.status)
  const qs = params.toString()
  return apiFetch<TransactionListResponse>(`/transactions${qs ? `?${qs}` : ""}`, { method: "GET" })
}

export async function fetchTransactionDetail(id: string): Promise<Transaction> {
  return apiFetch<Transaction>(`/transactions/${id}`, { method: "GET" })
}

export async function generateDemoTransactions(
  count: number,
  scenario: "random" | "cross_border_high" | "large_amount" | "blacklisted_device",
): Promise<DemoGenerateResponse> {
  return apiFetch<DemoGenerateResponse>(
    `/transactions/demo/generate?count=${count}&scenario=${scenario}`,
    { method: "POST" },
  )
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export interface AlertQuery {
  limit?: number
  offset?: number
  status?: string
  severity?: string
}

export async function fetchAlerts(query: AlertQuery = {}): Promise<AlertListResponse> {
  const params = new URLSearchParams()
  if (query.limit != null) params.set("limit", String(query.limit))
  if (query.offset != null) params.set("offset", String(query.offset))
  if (query.status) params.set("status", query.status)
  if (query.severity) params.set("severity", query.severity)
  const qs = params.toString()
  return apiFetch<AlertListResponse>(`/alerts${qs ? `?${qs}` : ""}`, { method: "GET" })
}

export async function updateAlertStatus(
  alertId: string,
  status: string,
  actor: string,
): Promise<{ message: string; alert: Alert }> {
  return apiFetch<{ message: string; alert: Alert }>(
    `/alerts/${alertId}/status?status=${encodeURIComponent(status)}&actor=${encodeURIComponent(actor)}`,
    { method: "PATCH" },
  )
}

// ─── Labels (analyst decision) ────────────────────────────────────────────────

export async function createLabel(
  transactionId: string,
  label: "fraud" | "legitimate" | "suspicious",
  labelledBy: string,
  notes?: string,
): Promise<{ message: string; label_id: string; transaction_id: string; label: string; alert_updated: boolean }> {
  return apiFetch("/labels", {
    method: "POST",
    body: JSON.stringify({
      transaction_id: transactionId,
      label,
      labelled_by: labelledBy,
      notes: notes ?? null,
    }),
  })
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export interface AuditQuery {
  limit?: number
  offset?: number
  action?: string
  actor?: string
}

export async function fetchAuditLogs(query: AuditQuery = {}): Promise<AuditLogListResponse> {
  const params = new URLSearchParams()
  if (query.limit != null) params.set("limit", String(query.limit))
  if (query.offset != null) params.set("offset", String(query.offset))
  if (query.action) params.set("action", query.action)
  if (query.actor) params.set("actor", query.actor)
  const qs = params.toString()
  return apiFetch<AuditLogListResponse>(`/audit-logs${qs ? `?${qs}` : ""}`, { method: "GET" })
}

// ─── Graph ────────────────────────────────────────────────────────────────────

export async function fetchGraph(limit = 60, riskLevel?: RiskLevel): Promise<GraphData> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (riskLevel) params.set("risk_level", riskLevel)
  return apiFetch<GraphData>(`/graph?${params.toString()}`, { method: "GET" })
}

export async function syncGraph(): Promise<{ message: string; synced_transactions: number; error?: string }> {
  return apiFetch("/graph/sync", { method: "POST" })
}

// ─── Cross Border ─────────────────────────────────────────────────────────────

export async function fetchCrossBorderSummary(): Promise<CrossBorderSummary> {
  return apiFetch<CrossBorderSummary>("/cross-border/summary", { method: "GET" })
}

export async function fetchCrossBorderRoutes(limit = 15): Promise<{ total: number; items: CrossBorderRoute[] }> {
  return apiFetch(`/cross-border/routes?limit=${limit}`, { method: "GET" })
}

export async function fetchCountryRiskMap(limit = 20): Promise<{ total: number; items: CountryRiskRow[] }> {
  return apiFetch(`/cross-border/countries?limit=${limit}`, { method: "GET" })
}

export async function fetchHighRiskCrossBorder(limit = 15): Promise<{ total: number; items: HighRiskCrossBorderTx[] }> {
  return apiFetch(`/cross-border/high-risk-transactions?limit=${limit}`, { method: "GET" })
}

export interface CrossBorderTimelinePoint {
  date: string
  transaction_count: number
  average_fraud_score: number
  high_risk_count: number
}

export async function fetchCrossBorderTimeline(): Promise<{ items: CrossBorderTimelinePoint[] }> {
  return apiFetch("/cross-border/timeline", { method: "GET" })
}

// ─── ML / Fraud Scoring ───────────────────────────────────────────────────────

export async function fetchMLStatus(): Promise<MLStatus> {
  return apiFetch<MLStatus>("/ml/status", { method: "GET" })
}

export async function fetchMLModels(): Promise<{ items: Array<Record<string, unknown>> }> {
  return apiFetch("/ml/models", { method: "GET" })
}
