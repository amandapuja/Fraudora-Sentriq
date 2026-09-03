// ─── Backend data types (mirrors TrustLens FastAPI responses) ────────────────

export type RiskLevel = "low" | "medium" | "high"
export type TxStatus = "approved" | "flagged" | "blocked" | "pending"
export type AlertStatus = "open" | "investigating" | "resolved" | "dismissed"
export type AlertSeverity = "low" | "medium" | "high" | "critical"

export interface AccountRef {
  id: string
  account_number: string
  holder_name: string
  risk_level: RiskLevel
}

export interface DeviceRef {
  id: string
  device_fingerprint: string
  device_type?: string | null
  os?: string | null
  browser?: string | null
  ip_address?: string | null
  risk_level: RiskLevel
  is_blacklisted: boolean
}

export interface MerchantRef {
  id: string
  name: string
  category?: string | null
  country_code?: string | null
  risk_level: RiskLevel
  is_blacklisted: boolean
}

export interface Transaction {
  id: string
  transaction_reference: string
  sender_account_id: string
  receiver_account_id: string
  device_id?: string | null
  merchant_id?: string | null
  amount: number
  currency: string
  channel: string
  source_country: string
  destination_country: string
  ip_address?: string | null
  status: TxStatus
  fraud_score: number
  risk_level: RiskLevel
  transaction_time: string
  created_at: string
  sender_account?: AccountRef | null
  receiver_account?: AccountRef | null
  device?: DeviceRef | null
  merchant?: MerchantRef | null
}

export interface TransactionListResponse {
  total: number
  limit: number
  offset: number
  items: Transaction[]
}

export interface AlertTxRef {
  id: string
  transaction_reference: string
  amount: number
  currency: string
  source_country: string
  destination_country: string
  status: TxStatus
  fraud_score: number
  risk_level: RiskLevel
}

export interface Alert {
  id: string
  transaction_id: string
  alert_type: string
  severity: AlertSeverity
  risk_score: number
  reason?: string | null
  status: AlertStatus
  assigned_to?: string | null
  created_at: string
  resolved_at?: string | null
  transaction?: AlertTxRef | null
}

export interface AlertListResponse {
  total: number
  limit: number
  offset: number
  items: Alert[]
}

export interface AuditLogEntry {
  id: string
  actor: string
  action: string
  entity_type: string
  entity_id?: string | null
  description?: string | null
  created_at: string
}

export interface AuditLogListResponse {
  total: number
  limit: number
  offset: number
  items: AuditLogEntry[]
}

export interface DashboardSummary {
  total_transactions: number
  total_accounts: number
  total_devices: number
  total_merchants: number
  total_alerts: number
  open_alerts: number
  investigating_alerts: number
  high_risk_transactions: number
  medium_risk_transactions: number
  low_risk_transactions: number
  blocked_transactions: number
  transactions_today: number
  cross_border_transactions: number
  cross_border_rate: number
  average_fraud_score: number
  risk_distribution: Record<RiskLevel, number>
  status_distribution: Record<TxStatus, number>
  severity_distribution: Record<AlertSeverity, number>
  generated_at: string
}

export interface CrossBorderSummary {
  total_transactions: number
  domestic_transactions: number
  cross_border_transactions: number
  cross_border_rate: number
  high_risk_cross_border: number
  average_cross_border_fraud_score: number
}

export interface CrossBorderRoute {
  route: string
  source_country: string
  destination_country: string
  transaction_count: number
  average_fraud_score: number
  high_risk_count: number
  total_amount: number
}

export interface CountryRiskRow {
  country_code: string
  country_name: string
  region?: string | null
  base_risk_level: RiskLevel
  base_risk_score: number
  transaction_count: number
  average_fraud_score: number
  high_risk_count: number
}

export interface HighRiskCrossBorderTx {
  id: string
  transaction_reference: string
  amount: number
  currency: string
  route: string
  source_country: string
  destination_country: string
  fraud_score: number
  risk_level: RiskLevel
  status: TxStatus
  transaction_time: string
  sender_account?: AccountRef | null
  receiver_account?: AccountRef | null
}

export interface GraphNode {
  id: string
  label: string
  title?: string | null
  amount?: number | null
  currency?: string | null
  fraud_score?: number | null
  risk_level?: RiskLevel | null
  status?: TxStatus | null
  account_number?: string | null
  category?: string | null
  code?: string | null
  is_blacklisted?: boolean | null
  ip_address?: string | null
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  source?: "neo4j" | "postgres_fallback"
  available?: boolean
  notice?: string
  neo4j_error?: string
}

export interface MLStatus {
  scoring_engine: {
    name: string
    mode: string
    description: string
    ml_models_loaded: boolean
  }
  baseline_model: { model_available: boolean; model_path?: string | null }
  active_tabular_model?: {
    version?: string
    model_name?: string
    dataset_name?: string
    created_at?: string
    accuracy?: number
  } | null
  adaptive_learning?: {
    adaptive_learning_enabled: boolean
    new_labels_since_last_training: number
    min_labels_required: number
    ready_for_retraining: boolean
    recommended_action: string
  } | null
  processed_transactions: number
  risk_distribution: Record<RiskLevel, number>
  status_distribution: Record<TxStatus, number>
  latest_scoring_events: Array<{
    transaction_id: string
    transaction_reference: string
    fraud_score: number
    risk_level: RiskLevel
    status: TxStatus
    amount: number
    currency: string
    source_country: string
    destination_country: string
    transaction_time: string
  }>
  model_artifacts_count: number
  last_updated: string
}

export interface DemoGenerateResponse {
  message: string
  scenario: string
  count: number
  alerts_created: number
  high_risk_count: number
  is_demo_data: boolean
  items: Array<{
    transaction: Transaction
    alert?: Alert | null
    alert_created: boolean
  }>
}

// ─── Realtime events ──────────────────────────────────────────────────────────

export type LiveEventType =
  | "stream.connected"
  | "transaction.created"
  | "transaction.updated"
  | "alert.created"
  | "alert.updated"
  | "audit.created"

export interface LiveEvent<T = unknown> {
  type: LiveEventType
  data: T
}
