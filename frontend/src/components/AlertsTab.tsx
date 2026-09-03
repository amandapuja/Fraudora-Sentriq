// ─── Fraud Alerts tab ─────────────────────────────────────────────────────────
// Real-time alert queue backed by GET /alerts. The investigation flow:
// open alert → view transaction details + risk indicators → change alert
// status (PATCH /alerts/:id/status) → label transaction (POST /labels).
// Every action is recorded in the audit log by the backend.

import { useCallback, useEffect, useState, type CSSProperties } from "react"
import { GlassCard, Icon, Tag, useAuth, useTheme } from "../App"
import { useRealtime } from "../lib/realtime"
import { createLabel, fetchAlerts, updateAlertStatus } from "../lib/data"
import type { Alert, AlertStatus } from "../lib/types"
import { ALERT_STATUS_LABEL, formatDateTime, formatMoney, RISK_LABEL, timeAgo } from "../lib/format"

const SEVERITY_ORDER = ["critical", "high", "medium", "low"]

export function AlertsTab() {
  const { T } = useTheme()
  const { auth } = useAuth()
  const { tick, refresh } = useRealtime()

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [severityFilter, setSeverityFilter] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Alert | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const actor = auth.user?.name ?? "Analyst"

  const load = useCallback(async () => {
    try {
      setError(null)
      const result = await fetchAlerts({ limit: 50, status: statusFilter || undefined, severity: severityFilter || undefined })
      const items = [...result.items].sort((a, b) => {
        const sa = SEVERITY_ORDER.indexOf(a.severity)
        const sb = SEVERITY_ORDER.indexOf(b.severity)
        return sa - sb
      })
      setAlerts(items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat alerts")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, severityFilter])

  useEffect(() => {
    void load()
  }, [tick, load])

  async function runAction(fn: () => Promise<unknown>, okText: string) {
    setActionBusy(true)
    setActionMsg(null)
    try {
      await fn()
      setActionMsg({ ok: true, text: okText })
      refresh()
    } catch (err) {
      setActionMsg({ ok: false, text: err instanceof Error ? err.message : "Aksi gagal" })
    } finally {
      setActionBusy(false)
    }
  }

  const severityColor = (s: string) => (s === "critical" || s === "high" ? T.red : s === "medium" ? T.amber : T.emerald)
  const severityBg = (s: string) => (s === "critical" || s === "high" ? T.redDim : s === "medium" ? T.amberDim : T.emeraldDim)
  const statusColor = (s: string) =>
    s === "open" ? T.red : s === "investigating" ? T.amber : s === "resolved" ? T.emerald : T.textMuted

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <GlassCard className="fst-tab-content">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Fraud Alert Queue</h3>
            <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{total} alert · diklik untuk investigasi</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={filterStyle(T)}>
              <option value="">Semua Status</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={filterStyle(T)}>
              <option value="">Semua Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: T.redDim, border: `1px solid ${T.red}40`, borderRadius: 8, marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: T.red }}>{error}</p>
          </div>
        )}

        {loading && alerts.length === 0 ? (
          <div style={{ padding: 36, textAlign: "center", color: T.textSub, fontSize: 13 }}>Memuat alert queue…</div>
        ) : alerts.length === 0 ? (
          <div style={{ padding: 36, textAlign: "center" }}>
            <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}><Icon name="alert" size={30} color={T.violet} /></div>
            <p style={{ fontSize: 13, color: T.textSub }}>Tidak ada alert dengan filter ini.</p>
            <p style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Gunakan Demo Generator di tab Transactions untuk memicu alert baru.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Alert", "Transaction", "Severity", "Score", "Amount", "Route", "Detected", "Status"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px 12px 0", fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => {
                  const color = severityColor(a.severity)
                  return (
                    <tr key={a.id} onClick={() => setSelected(a)} style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = T.violetDim)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                      <td style={{ padding: "11px 12px 11px 0", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: T.violet, fontWeight: 600, whiteSpace: "nowrap" }}>{a.id.slice(0, 8)}</td>
                      <td style={{ padding: "11px 12px 11px 0", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: T.text }}>{a.transaction?.transaction_reference ?? "—"}</td>
                      <td style={{ padding: "11px 12px 11px 0" }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color, background: severityBg(a.severity), border: `1px solid ${color}35`, padding: "3px 7px", borderRadius: 4, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.05em" }}>
                          {a.severity.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "11px 12px 11px 0", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color, fontWeight: 700 }}>{a.risk_score.toFixed(2)}</td>
                      <td style={{ padding: "11px 12px 11px 0", fontSize: 12, color: T.text, fontWeight: 600, whiteSpace: "nowrap" }}>{a.transaction ? formatMoney(a.transaction.amount, a.transaction.currency) : "—"}</td>
                      <td style={{ padding: "11px 12px 11px 0" }}>
                        {a.transaction ? <Tag color={T.indigo}>{a.transaction.source_country} → {a.transaction.destination_country}</Tag> : <span style={{ color: T.textMuted, fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ padding: "11px 12px 11px 0", fontSize: 11, color: T.textMuted, whiteSpace: "nowrap" }}>{timeAgo(a.created_at)}</td>
                      <td style={{ padding: "11px 12px 11px 0" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: statusColor(a.status), background: `${statusColor(a.status)}12`, border: `1px solid ${statusColor(a.status)}35`, padding: "3px 8px", borderRadius: 6, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" }}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {selected && (
        <AlertDetailModal
          alert={selected}
          actor={actor}
          busy={actionBusy}
          msg={actionMsg}
          onClose={() => { setSelected(null); setActionMsg(null) }}
          onStatusChange={(status: AlertStatus) =>
            runAction(() => updateAlertStatus(selected.id, status, actor), `Status alert diubah ke ${status}.`)
          }
          onLabel={(label: "fraud" | "legitimate" | "suspicious") => {
            if (!selected.transaction) return
            void runAction(() => createLabel(selected.transaction!.id, label, actor), `Transaksi dilabeli ${label}.`)
          }}
        />
      )}
    </div>
  )
}

// ─── Alert detail / investigation modal ───────────────────────────────────────

function AlertDetailModal({
  alert,
  actor,
  busy,
  msg,
  onClose,
  onStatusChange,
  onLabel,
}: {
  alert: Alert
  actor: string
  busy: boolean
  msg: { ok: boolean; text: string } | null
  onClose: () => void
  onStatusChange: (status: AlertStatus) => void
  onLabel: (label: "fraud" | "legitimate" | "suspicious") => void
}) {
  const { T, G } = useTheme()
  const tx = alert.transaction
  const color = alert.severity === "critical" || alert.severity === "high" ? T.red : alert.severity === "medium" ? T.amber : T.emerald
  const statuses: AlertStatus[] = ["open", "investigating", "resolved", "dismissed"]

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", animation: "fadeIn 0.2s ease" }}>
      <div style={{ width: "100%", maxWidth: 720, maxHeight: "88vh", overflowY: "auto", background: T.glassCard, backdropFilter: T.blur, WebkitBackdropFilter: T.blur, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: "0 24px 80px rgba(0,0,0,0.25)", padding: 28, animation: "fadeInUp 0.3s ease", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 18, padding: 6 }}>✕</button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Icon name="alert" size={18} color={color} />
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: T.textMuted, letterSpacing: "0.1em" }}>ALERT INVESTIGATION</span>
        </div>
        <h3 style={{ fontSize: 19, fontWeight: 800, color: T.text, marginBottom: 4 }}>
          {tx?.transaction_reference ?? alert.id.slice(0, 8)}
          <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, color, background: `${color}15`, border: `1px solid ${color}40`, padding: "3px 9px", borderRadius: 5, fontFamily: "'JetBrains Mono',monospace", verticalAlign: "middle" }}>
            {alert.severity.toUpperCase()}
          </span>
        </h3>
        <p style={{ fontSize: 12, color: T.textSub, marginBottom: 18 }}>
          Alert {alert.id.slice(0, 8)} · {formatDateTime(alert.created_at)} · Status: <strong style={{ color: T.text }}>{ALERT_STATUS_LABEL[alert.status]}</strong>
          {alert.assigned_to ? ` · Assigned: ${alert.assigned_to}` : ""}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div style={{ padding: 14, background: T.violetDim, borderRadius: 10, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.textMuted, marginBottom: 8 }}>RISK INDICATORS</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "'JetBrains Mono',monospace" }}>{alert.risk_score.toFixed(2)}</span>
              <span style={{ fontSize: 11, color: T.textSub }}>fraud score<br />(0–1)</span>
            </div>
            <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(alert.risk_score * 100, 100)}%`, height: "100%", background: color, borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 8, fontFamily: "'JetBrains Mono',monospace" }}>
              Risk level: {RISK_LABEL[tx?.risk_level ?? "low"]} · Tx status: {tx?.status}
            </div>
          </div>
          <div style={{ padding: 14, background: T.violetDim, borderRadius: 10, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.textMuted, marginBottom: 8 }}>TRANSACTION</div>
            {tx ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                <Row label="Amount" value={formatMoney(tx.amount, tx.currency)} />
                <Row label="Route" value={`${tx.source_country} → ${tx.destination_country}`} />
                <Row label="Type" value={alert.alert_type} />
                <Row label="Detected" value={formatDateTime(alert.created_at)} />
              </div>
            ) : (
              <span style={{ fontSize: 12, color: T.textMuted }}>Detail transaksi tidak tersedia.</span>
            )}
          </div>
        </div>

        {alert.reason && (
          <div style={{ marginBottom: 16, padding: "12px 14px", background: T.amberDim, border: `1px solid ${T.amber}30`, borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.amber, marginBottom: 6, letterSpacing: "0.1em" }}>REASON / RISK INDICATORS</div>
            <ul style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {alert.reason.split("; ").map((r, i) => (
                <li key={i} style={{ fontSize: 12, color: T.textSub, display: "flex", gap: 8 }}>
                  <span style={{ color: T.amber, flexShrink: 0 }}>→</span>{r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {msg && (
          <div style={{ marginBottom: 14, padding: "9px 12px", borderRadius: 8, background: msg.ok ? T.emeraldDim : T.redDim, border: `1px solid ${msg.ok ? T.emerald : T.red}40` }}>
            <p style={{ fontSize: 12, color: msg.ok ? T.emerald : T.red }}>{msg.text}</p>
          </div>
        )}

        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
          <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.textMuted, marginBottom: 10, letterSpacing: "0.1em" }}>ANALYST ACTIONS (dictatat di audit log)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {statuses.map((s) => (
              <button key={s} disabled={busy || alert.status === s} onClick={() => onStatusChange(s)} style={{
                fontSize: 11, fontWeight: 700, padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                background: alert.status === s ? G.ctaBtn : "none", color: alert.status === s ? "#fff" : T.textSub,
                border: alert.status === s ? "none" : `1px solid ${T.border}`,
                opacity: busy ? 0.6 : 1, textTransform: "uppercase" as const, letterSpacing: "0.04em",
              }}>
                {s}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={busy} onClick={() => onLabel("fraud")} style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: "9px 0", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", background: G.pinkBtn, color: "#fff", border: "none", opacity: busy ? 0.6 : 1 }}>
              Tandai FRAUD
            </button>
            <button disabled={busy} onClick={() => onLabel("suspicious")} style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: "9px 0", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", background: T.amberDim, color: T.amber, border: `1px solid ${T.amber}40`, opacity: busy ? 0.6 : 1 }}>
              SUSPICIOUS
            </button>
            <button disabled={busy} onClick={() => onLabel("legitimate")} style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: "9px 0", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", background: "linear-gradient(135deg,#10b981,#34d399)", color: "#fff", border: "none", opacity: busy ? 0.6 : 1 }}>
              Tandai LEGIT
            </button>
          </div>
          <p style={{ fontSize: 10, color: T.textMuted, marginTop: 10, fontStyle: "italic" }}>
            Label fraud → transaksi diblokir & alert resolved · Label legit → transaksi disetujui & alert dismissed · Suspicious → investigating.
            Semua tindakan tercatat sebagai audit log ({actor}).
          </p>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const { T } = useTheme()
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ color: T.textMuted, fontSize: 11 }}>{label}</span>
      <span style={{ color: T.text, fontWeight: 600, fontSize: 12, textAlign: "right" }}>{value}</span>
    </div>
  )
}

function filterStyle(T: ReturnType<typeof useTheme>["T"]): CSSProperties {
  return {
    fontSize: 12, padding: "7px 10px", borderRadius: 8, background: T.glassCard,
    border: `1px solid ${T.border}`, color: T.text, fontFamily: "inherit", cursor: "pointer", outline: "none",
  }
}
