// ─── Formatting & label helpers for the dashboard ────────────────────────────
// All display formatting is centralized here so tables, cards and modals
// render numbers/dates consistently.

import type { AlertSeverity, AlertStatus, RiskLevel, TxStatus } from "./types"

// ─── Currency ─────────────────────────────────────────────────────────────────

/** Full currency amount, e.g. "Rp 1.234.567" or "USD 1,234.56". */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString("id-ID")}`
  }
}

/** Compact amount for KPI cards: "Rp 245 jt", "Rp 1,2 M", "Rp 850 rb". */
export function formatMoneyCompact(amount: number, currency: string): string {
  const symbol = currency === "IDR" ? "Rp" : currency
  const abs = Math.abs(amount)
  if (abs >= 1_000_000_000) return `${symbol} ${(amount / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`
  if (abs >= 1_000_000) return `${symbol} ${(amount / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
  if (abs >= 1_000) return `${symbol} ${(amount / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`
  return `${symbol} ${amount.toLocaleString("id-ID")}`
}

// ─── Dates ────────────────────────────────────────────────────────────────────

/** "31 Agu 14:05:22" style timestamp. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return "—"
  try {
    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return date.toISOString().slice(0, 19).replace("T", " ")
  }
}

/** Short "31 Agu" date for timeline charts. */
export function formatShortDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return String(value)
  try {
    return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
  } catch {
    return String(value).slice(0, 10)
  }
}

/** Relative time like "2 mnt lalu", "3 jam lalu", "5 hari lalu". */
export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "—"
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return "—"
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return `${seconds} dtk lalu`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} mnt lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
}

// ─── Risk / status labels ─────────────────────────────────────────────────────

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
}

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
}

export const TX_STATUS_LABEL: Record<TxStatus, string> = {
  approved: "Approved",
  flagged: "Flagged",
  blocked: "Blocked",
  pending: "Pending",
}

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  resolved: "Resolved",
  dismissed: "Dismissed",
}

export const CHANNEL_LABEL: Record<string, string> = {
  mobile_banking: "Mobile Banking",
  internet_banking: "Internet Banking",
  payment_gateway: "Payment Gateway",
  atm: "ATM",
  e_wallet: "E-Wallet",
}

/** Map a numeric fraud score to the display risk level. */
export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 0.75) return "high"
  if (score >= 0.45) return "medium"
  return "low"
}

/** Map a numeric fraud score to the transaction status used by the backend. */
export function txStatusFromScore(score: number): TxStatus {
  if (score >= 0.85) return "blocked"
  if (score >= 0.6) return "flagged"
  return "approved"
}
