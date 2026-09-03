// ─── Cross-Border Analysis tab ────────────────────────────────────────────────
// Aggregates from /cross-border/*: summary, routes, country risk map,
// high-risk transactions and a daily timeline. All values are derived from
// backend transaction data — no invented countries or relationships.

import { useCallback, useEffect, useState } from "react"
import { GlassCard, Icon, Tag, useTheme } from "../App"
import { useRealtime } from "../lib/realtime"
import { fetchCountryRiskMap, fetchCrossBorderRoutes, fetchCrossBorderSummary, fetchHighRiskCrossBorder, fetchCrossBorderTimeline } from "../lib/data"
import type { CountryRiskRow, CrossBorderRoute, CrossBorderSummary, HighRiskCrossBorderTx } from "../lib/types"
import { formatMoney, formatMoneyCompact, formatShortDate, RISK_LABEL, timeAgo } from "../lib/format"

interface TimelinePoint {
  date: string
  transaction_count: number
  average_fraud_score: number
  high_risk_count: number
}

export function CrossBorderTab() {
  const { T } = useTheme()
  const { tick } = useRealtime()

  const [summary, setSummary] = useState<CrossBorderSummary | null>(null)
  const [routes, setRoutes] = useState<CrossBorderRoute[]>([])
  const [countries, setCountries] = useState<CountryRiskRow[]>([])
  const [highRisk, setHighRisk] = useState<HighRiskCrossBorderTx[]>([])
  const [timeline, setTimeline] = useState<TimelinePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const [sum, routeRes, countryRes, highRes, tlRes] = await Promise.all([
        fetchCrossBorderSummary(),
        fetchCrossBorderRoutes(15),
        fetchCountryRiskMap(20),
        fetchHighRiskCrossBorder(15),
        fetchCrossBorderTimeline(),
      ])
      setSummary(sum)
      setRoutes(routeRes.items)
      setCountries(countryRes.items)
      setHighRisk(highRes.items)
      setTimeline(tlRes.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat analisis cross-border")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [tick, load])

  if (loading && !summary) {
    return <div style={{ padding: 40, textAlign: "center", color: T.textSub, fontSize: 13 }}>Memuat analisis cross-border…</div>
  }

  const riskColor = (r: string) => (r === "high" ? T.red : r === "medium" ? T.amber : T.emerald)

  const kpis = summary ? [
    { icon: "globe", label: "Transaksi Cross-Border", value: summary.cross_border_transactions.toLocaleString("id-ID"), sub: `${summary.total_transactions.toLocaleString("id-ID")} total`, color: T.cyan },
    { icon: "chart", label: "Cross-Border Rate", value: `${Math.round(summary.cross_border_rate * 100)}%`, sub: `${summary.domestic_transactions.toLocaleString("id-ID")} domestik`, color: T.violet },
    { icon: "alert", label: "High-Risk Cross-Border", value: summary.high_risk_cross_border.toLocaleString("id-ID"), sub: "transaksi berisiko tinggi", color: T.red },
    { icon: "zap", label: "Avg Fraud Score", value: summary.average_cross_border_fraud_score.toFixed(2), sub: "lintas batas (0–1)", color: T.amber },
  ] : []

  const maxTimeline = Math.max(1, ...timeline.map((t) => t.transaction_count))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <div style={{ padding: "10px 14px", background: T.redDim, border: `1px solid ${T.red}40`, borderRadius: 8 }}>
          <p style={{ fontSize: 13, color: T.red }}>{error}</p>
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {kpis.map((k) => (
          <GlassCard key={k.label} style={{ padding: 16 }} accent={k.color}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ padding: 7, borderRadius: 9, background: k.color + "18" }}>
                <Icon name={k.icon} size={15} color={k.color} />
              </div>
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, color: k.color, fontFamily: "'JetBrains Mono',monospace", marginBottom: 3 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: T.textSub, fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{k.sub}</div>
          </GlassCard>
        ))}
      </div>

      {/* Timeline */}
      <GlassCard accent={T.cyan}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>Aktivitas Cross-Border per Hari</h3>
        {timeline.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: T.textMuted, fontSize: 12 }}>Belum ada data timeline.</div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140, overflowX: "auto", paddingBottom: 4 }}>
            {timeline.map((t) => (
              <div key={t.date} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 44 }}>
                <div style={{ fontSize: 9, color: t.high_risk_count > 0 ? T.red : T.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>
                  {t.high_risk_count > 0 ? `${t.high_risk_count}⚠` : ""}
                </div>
                <div style={{ width: 26, height: Math.max(3, (t.transaction_count / maxTimeline) * 90), background: t.high_risk_count > 0 ? `linear-gradient(to top, ${T.red}, ${T.amber})` : T.cyan, borderRadius: "5px 5px 0 0", opacity: 0.85 }} title={`${t.transaction_count} tx`} />
                <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap" }}>{formatShortDate(t.date)}</div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Routes */}
        <GlassCard accent={T.violet}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>Rute Berisiko (urut skor rata-rata)</h3>
          {routes.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: T.textMuted, fontSize: 12 }}>Belum ada rute cross-border.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {routes.map((r) => {
                const color = r.average_fraud_score >= 0.75 ? T.red : r.average_fraud_score >= 0.45 ? T.amber : T.emerald
                return (
                  <div key={r.route} style={{ padding: "10px 12px", background: T.violetDim, borderRadius: 10, border: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: "'JetBrains Mono',monospace" }}>{r.route}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}14`, border: `1px solid ${color}35`, padding: "2px 8px", borderRadius: 5, fontFamily: "'JetBrains Mono',monospace" }}>
                        {r.average_fraud_score.toFixed(2)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11, color: T.textSub, flexWrap: "wrap" }}>
                      <span>{r.transaction_count} tx</span>
                      <span>{r.high_risk_count} high-risk</span>
                      <span>{formatMoneyCompact(r.total_amount, "IDR")}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </GlassCard>

        {/* Country risk map */}
        <GlassCard accent={T.indigo}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>Profil Risiko Negara</h3>
          {countries.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: T.textMuted, fontSize: 12 }}>Belum ada data negara.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                    {["Negara", "Base Risk", "Tx", "High-Risk", "Avg Score"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px 10px 0", fontSize: 9, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {countries.map((c) => (
                    <tr key={c.country_code} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "9px 10px 9px 0" }}>
                        <span style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{c.country_name}</span>
                        <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", marginLeft: 6 }}>{c.country_code}</span>
                      </td>
                      <td style={{ padding: "9px 10px 9px 0" }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: riskColor(c.base_risk_level), background: `${riskColor(c.base_risk_level)}14`, border: `1px solid ${riskColor(c.base_risk_level)}35`, padding: "2px 6px", borderRadius: 4, fontFamily: "'JetBrains Mono',monospace" }}>
                          {RISK_LABEL[c.base_risk_level]}
                        </span>
                      </td>
                      <td style={{ padding: "9px 10px 9px 0", fontSize: 11, color: T.textSub, fontFamily: "'JetBrains Mono',monospace" }}>{c.transaction_count}</td>
                      <td style={{ padding: "9px 10px 9px 0", fontSize: 11, color: c.high_risk_count > 0 ? T.red : T.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{c.high_risk_count}</td>
                      <td style={{ padding: "9px 10px 9px 0", fontSize: 11, color: riskColor(c.base_risk_level), fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{c.average_fraud_score.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>

      {/* High-risk cross-border transactions */}
      <GlassCard accent={T.red}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>Transaksi Cross-Border Berisiko Tinggi</h3>
        {highRisk.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: T.textMuted, fontSize: 12 }}>Tidak ada transaksi cross-border berisiko tinggi.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Transaction", "Route", "Amount", "Score", "Risiko", "Status", "Waktu"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px 12px 0", fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {highRisk.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "11px 12px 11px 0", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: T.violet, fontWeight: 600, whiteSpace: "nowrap" }}>{tx.transaction_reference}</td>
                    <td style={{ padding: "11px 12px 11px 0" }}><Tag color={T.indigo}>{tx.route}</Tag></td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 12, color: T.text, fontWeight: 600, whiteSpace: "nowrap" }}>{formatMoney(tx.amount, tx.currency)}</td>
                    <td style={{ padding: "11px 12px 11px 0", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: riskColor(tx.risk_level), fontWeight: 700 }}>{tx.fraud_score.toFixed(2)}</td>
                    <td style={{ padding: "11px 12px 11px 0" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: riskColor(tx.risk_level), background: `${riskColor(tx.risk_level)}14`, border: `1px solid ${riskColor(tx.risk_level)}35`, padding: "3px 7px", borderRadius: 4, fontFamily: "'JetBrains Mono',monospace" }}>{RISK_LABEL[tx.risk_level]}</span>
                    </td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 11, color: T.textSub, textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace" }}>{tx.status}</td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 11, color: T.textMuted, whiteSpace: "nowrap" }}>{timeAgo(tx.transaction_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
