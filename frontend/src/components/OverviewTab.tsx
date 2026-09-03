// ─── Dashboard Overview tab ───────────────────────────────────────────────────
// Live monitoring dashboard driven entirely by backend data:
// /dashboard/summary, /dashboard/recent-alerts, /dashboard/recent-transactions,
// /dashboard/recent-activity. Refreshes automatically via the shared
// realtime context (SSE, polling fallback).

import { useCallback, useEffect, useState } from "react"
import { GlassCard, Icon, StatusBadge, Tag, useTheme } from "../App"
import { useRealtime } from "../lib/realtime"
import { fetchDashboardSummary, fetchRecentActivity, fetchRecentAlerts, fetchRecentTransactions } from "../lib/data"
import type { Alert, DashboardSummary, Transaction } from "../lib/types"
import { ALERT_STATUS_LABEL, formatMoneyCompact, RISK_LABEL, timeAgo } from "../lib/format"

interface ActivityItem {
  id: string
  actor: string
  action: string
  entity_type: string
  entity_id?: string | null
  description?: string | null
  created_at: string
}

export function OverviewTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { T } = useTheme()
  const { tick, status } = useRealtime()

  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const [sum, recentAlerts, recentTx, recentActivity] = await Promise.all([
        fetchDashboardSummary(),
        fetchRecentAlerts(),
        fetchRecentTransactions(),
        fetchRecentActivity(),
      ])
      setSummary(sum)
      setAlerts(recentAlerts)
      setTransactions(recentTx.items)
      setActivity(recentActivity.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data dashboard")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [tick, load])

  if (loading && !summary) {
    return <div style={{ padding: 40, textAlign: "center", color: T.textSub, fontSize: 13 }}>Memuat data dashboard…</div>
  }

  if (error && !summary) {
    return (
      <GlassCard style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>Gagal menghubungi backend</h3>
        <p style={{ fontSize: 13, color: T.textSub }}>{error}</p>
      </GlassCard>
    )
  }

  const s = summary
  const kpis: { icon: string; label: string; value: string; sub: string; color: string }[] = s
    ? [
        { icon: "chart", label: "Total Transaksi", value: s.total_transactions.toLocaleString("id-ID"), sub: `${s.transactions_today.toLocaleString("id-ID")} hari ini`, color: T.violet },
        { icon: "alert", label: "Alert Terbuka", value: String(s.open_alerts), sub: `${s.investigating_alerts} investigating`, color: T.red },
        { icon: "zap", label: "Risiko Tinggi", value: s.high_risk_transactions.toLocaleString("id-ID"), sub: `${s.medium_risk_transactions} medium`, color: T.amber },
        { icon: "globe", label: "Cross-Border", value: s.cross_border_transactions.toLocaleString("id-ID"), sub: `${Math.round(s.cross_border_rate * 100)}% dari total`, color: T.cyan },
        { icon: "search", label: "Rata-rata Skor", value: s.average_fraud_score.toFixed(2), sub: "fraud score avg", color: T.indigo },
        { icon: "lock", label: "Transaksi Diblokir", value: s.blocked_transactions.toLocaleString("id-ID"), sub: `${s.total_alerts} total alert`, color: T.pink },
      ]
    : []

  const riskDist = s ? [
    { level: "HIGH", value: s.risk_distribution.high, color: T.red, bg: T.redDim },
    { level: "MEDIUM", value: s.risk_distribution.medium, color: T.amber, bg: T.amberDim },
    { level: "LOW", value: s.risk_distribution.low, color: T.emerald, bg: T.emeraldDim },
  ] : []
  const maxRisk = Math.max(1, ...riskDist.map((r) => r.value))

  const severityColor = (severity: string) =>
    severity === "critical" || severity === "high" ? T.red : severity === "medium" ? T.amber : T.emerald
  const severityBg = (severity: string) =>
    severity === "critical" || severity === "high" ? T.redDim : severity === "medium" ? T.amberDim : T.emeraldDim

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 14 }}>
        {kpis.map((k) => (
          <GlassCard key={k.label} style={{ padding: 16 }} accent={k.color}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ padding: 7, borderRadius: 9, background: k.color + "18" }}>
                <Icon name={k.icon} size={15} color={k.color} />
              </div>
              <StatusBadge status={status === "live" ? "actual" : "simulation"} />
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, color: k.color, fontFamily: "'JetBrains Mono',monospace", marginBottom: 3 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: T.textSub, fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{k.sub}</div>
          </GlassCard>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Risk distribution */}
        <GlassCard accent={T.violet}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>Distribusi Risiko Transaksi</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {riskDist.map((r) => (
              <div key={r.level}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: r.color }}>{r.level}</span>
                  <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{r.value.toLocaleString("id-ID")}</span>
                </div>
                <div style={{ height: 8, background: T.border, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(r.value / maxRisk) * 100}%`, height: "100%", background: r.color, borderRadius: 4, transition: "width 0.5s ease" }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
            {s && Object.entries(s.status_distribution).map(([st, count]) => (
              <Tag key={st} color={T.textSub}>{st.toUpperCase()} {count}</Tag>
            ))}
          </div>
        </GlassCard>

        {/* Recent alerts feed */}
        <GlassCard accent={T.red}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Fraud Alerts Terbaru</h3>
            {onNavigate && (
              <button onClick={() => onNavigate("alerts")} style={{ fontSize: 11, color: T.violet, background: T.violetDim, border: `1px solid ${T.borderHi}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                Lihat Semua →
              </button>
            )}
          </div>
          {alerts.length === 0 ? (
            <div style={{ padding: "22px 10px", textAlign: "center", color: T.textMuted, fontSize: 12 }}>Belum ada alert. Buat transaksi demo untuk memicu alert.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alerts.slice(0, 5).map((a) => {
                const color = severityColor(a.severity)
                return (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: severityBg(a.severity), borderRadius: 10, border: `1px solid ${color}25` }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, animation: a.severity === "high" || a.severity === "critical" ? "pulse-glow 2s infinite" : "none" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: T.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {a.transaction?.transaction_reference ?? a.id.slice(0, 8)}
                        </span>
                        <span style={{ fontSize: 10, color: T.textMuted, whiteSpace: "nowrap" }}>{timeAgo(a.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: T.textSub, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {a.transaction ? `${formatMoneyCompact(a.transaction.amount, a.transaction.currency)} · ${a.transaction.source_country} → ${a.transaction.destination_country}` : a.alert_type} · {ALERT_STATUS_LABEL[a.status as keyof typeof ALERT_STATUS_LABEL] ?? a.status}
                      </div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color, background: severityBg(a.severity), border: `1px solid ${color}35`, padding: "2px 6px", borderRadius: 4, fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>
                      {a.severity.toUpperCase()}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </GlassCard>

        {/* Recent suspicious transactions */}
        <GlassCard accent={T.cyan}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Transaksi Mencurigakan Terbaru</h3>
            {onNavigate && (
              <button onClick={() => onNavigate("transactions")} style={{ fontSize: 11, color: T.violet, background: T.violetDim, border: `1px solid ${T.borderHi}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                Lihat Semua →
              </button>
            )}
          </div>
          {transactions.length === 0 ? (
            <div style={{ padding: "22px 10px", textAlign: "center", color: T.textMuted, fontSize: 12 }}>Belum ada transaksi.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {transactions.slice(0, 5).map((tx) => {
                const color = tx.risk_level === "high" ? T.red : tx.risk_level === "medium" ? T.amber : T.emerald
                return (
                  <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: T.violetDim, borderRadius: 10, border: `1px solid ${T.border}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: T.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.transaction_reference}</span>
                        <span style={{ fontSize: 10, color: T.textMuted, whiteSpace: "nowrap" }}>{timeAgo(tx.transaction_time)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: T.textSub, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {formatMoneyCompact(tx.amount, tx.currency)} · {tx.sender_account?.holder_name ?? "?"} → {tx.receiver_account?.holder_name ?? "?"} · {tx.source_country} → {tx.destination_country}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "'JetBrains Mono',monospace" }}>{tx.fraud_score.toFixed(2)}</div>
                      <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{RISK_LABEL[tx.risk_level]}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </GlassCard>

        {/* Recent activity (audit) */}
        <GlassCard accent={T.emerald}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Aktivitas Terbaru</h3>
            {onNavigate && (
              <button onClick={() => onNavigate("audit")} style={{ fontSize: 11, color: T.violet, background: T.violetDim, border: `1px solid ${T.borderHi}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                Audit Log →
              </button>
            )}
          </div>
          {activity.length === 0 ? (
            <div style={{ padding: "22px 10px", textAlign: "center", color: T.textMuted, fontSize: 12 }}>Belum ada aktivitas tercatat.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {activity.slice(0, 6).map((item) => (
                <div key={item.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 12px", background: T.violetDim, borderRadius: 8, border: `1px solid ${T.border}` }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.emerald, marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: T.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.description ?? item.action}</div>
                    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>{item.actor} · {timeAgo(item.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
