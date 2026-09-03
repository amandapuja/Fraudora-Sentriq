// ─── Audit Logs tab ───────────────────────────────────────────────────────────
// Records every meaningful application action (login, transaction created,
// alert generated/updated, analyst decisions, demo generation) — displayed
// from GET /audit-logs and refreshed live via the shared realtime stream.

import { useCallback, useEffect, useState, type CSSProperties } from "react"
import { GlassCard, Icon, Tag, useTheme } from "../App"
import { useRealtime } from "../lib/realtime"
import { fetchAuditLogs } from "../lib/data"
import type { AuditLogEntry } from "../lib/types"
import { formatDateTime } from "../lib/format"

const ACTION_LABELS: Record<string, string> = {
  login_user: "User Login",
  register_user: "User Registered",
  create_transaction: "Transaction Created",
  update_alert_status: "Alert Status Changed",
  create_transaction_label: "Transaction Labeled",
  demo_transactions_generated: "Demo Transactions Generated",
  review_alert: "Alert Reviewed",
  seed_database: "Database Seeded",
  update_risk_configuration: "Risk Config Updated",
}

function actionStyle(T: ReturnType<typeof useTheme>["T"], action: string): { label: string; color: string } {
  const known = ACTION_LABELS[action]
  const hash = [...action].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const fallbackColors = [T.cyan, T.violet, T.indigo, T.pink, T.amber, T.emerald]
  return {
    label: known ?? action.replace(/_/g, " "),
    color: known ? fallbackColors[hash % fallbackColors.length] : fallbackColors[hash % fallbackColors.length],
  }
}

const ACTION_OPTIONS = Object.keys(ACTION_LABELS)

export function AuditTab() {
  const { T } = useTheme()
  const { tick } = useRealtime()

  const [items, setItems] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [actionFilter, setActionFilter] = useState("")
  const [actorFilter, setActorFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const result = await fetchAuditLogs({ limit: 100, action: actionFilter || undefined, actor: actorFilter || undefined })
      setItems(result.items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat audit log")
    } finally {
      setLoading(false)
    }
  }, [actionFilter, actorFilter])

  useEffect(() => {
    void load()
  }, [tick, load])

  return (
    <GlassCard className="fst-tab-content">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="clipboard" size={17} color={T.emerald} />
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Audit Log</h3>
            <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{total} catatan · semua tindakan penting aplikasi</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={filterStyle(T)}>
            <option value="">Semua Aksi</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
          <input
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder="Filter actor…"
            style={{ ...filterStyle(T), minWidth: 160 }}
          />
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: T.redDim, border: `1px solid ${T.red}40`, borderRadius: 8, marginBottom: 12 }}>
          <p style={{ fontSize: 13, color: T.red }}>{error}</p>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div style={{ padding: 36, textAlign: "center", color: T.textSub, fontSize: 13 }}>Memuat audit log…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 36, textAlign: "center", color: T.textMuted, fontSize: 13 }}>Belum ada catatan audit.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["Waktu", "Actor", "Aksi", "Entity", "Entity ID", "Deskripsi"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px 12px 0", fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((log) => {
                const style = actionStyle(T, log.action)
                return (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "10px 12px 10px 0", fontSize: 11, color: T.textMuted, whiteSpace: "nowrap", fontFamily: "'JetBrains Mono',monospace" }}>{formatDateTime(log.created_at)}</td>
                    <td style={{ padding: "10px 12px 10px 0", fontSize: 12, color: T.text, fontWeight: 600, whiteSpace: "nowrap" }}>{log.actor}</td>
                    <td style={{ padding: "10px 12px 10px 0" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: style.color, background: `${style.color}14`, border: `1px solid ${style.color}35`, padding: "3px 8px", borderRadius: 5, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.03em" }}>
                        {style.label.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px 10px 0" }}><Tag color={T.textSub}>{log.entity_type}</Tag></td>
                    <td style={{ padding: "10px 12px 10px 0", fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap" }}>{log.entity_id ? log.entity_id.slice(0, 12) : "—"}</td>
                    <td style={{ padding: "10px 12px 10px 0", fontSize: 12, color: T.textSub, maxWidth: 380 }}>{log.description ?? "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  )
}

function filterStyle(T: ReturnType<typeof useTheme>["T"]): CSSProperties {
  return {
    fontSize: 12, padding: "7px 10px", borderRadius: 8, background: T.glassCard,
    border: `1px solid ${T.border}`, color: T.text, fontFamily: "inherit", cursor: "pointer", outline: "none",
  }
}
