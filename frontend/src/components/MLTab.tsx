// ─── Machine Learning / Fraud Scoring tab ─────────────────────────────────────
// Honest status of the scoring engine from GET /ml/status. The engine is a
// rule-based ensemble (always active) that optionally blends trained ML model
// contributions (PaySim tabular model, TrustLens internal adaptive model) when
// artifacts exist. No production capability is claimed.

import { useCallback, useEffect, useState } from "react"
import { GlassCard, Icon, StatusBadge, Tag, useTheme } from "../App"
import { useRealtime } from "../lib/realtime"
import { fetchMLStatus } from "../lib/data"
import type { MLStatus } from "../lib/types"
import { formatDateTime, formatMoney, RISK_LABEL, timeAgo } from "../lib/format"

export function MLTab() {
  const { T } = useTheme()
  const { tick } = useRealtime()

  const [ml, setMl] = useState<MLStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      setMl(await fetchMLStatus())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat status ML")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [tick, load])

  if (loading && !ml) {
    return <div style={{ padding: 40, textAlign: "center", color: T.textSub, fontSize: 13 }}>Memuat status scoring engine…</div>
  }

  const riskColor = (r: string) => (r === "high" ? T.red : r === "medium" ? T.amber : T.emerald)
  const dist = ml?.risk_distribution ?? { low: 0, medium: 0, high: 0 }
  const maxDist = Math.max(1, dist.low, dist.medium, dist.high)
  const adaptive = ml?.adaptive_learning

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <div style={{ padding: "10px 14px", background: T.redDim, border: `1px solid ${T.red}40`, borderRadius: 8 }}>
          <p style={{ fontSize: 13, color: T.red }}>{error}</p>
        </div>
      )}

      {/* Engine status */}
      <GlassCard accent={T.violet}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Fraud Scoring Engine</h3>
            <p style={{ fontSize: 12, color: T.textSub, marginTop: 4, maxWidth: 620, lineHeight: 1.6 }}>{ml?.scoring_engine.description}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <StatusBadge status="actual" />
            {ml?.scoring_engine.ml_models_loaded ? <StatusBadge status="simulation" /> : <StatusBadge status="pending" />}
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Tag color={T.violet}>{ml?.scoring_engine.name}</Tag>
          <Tag color={T.cyan}>{ml?.scoring_engine.mode}</Tag>
          <Tag color={ml?.scoring_engine.ml_models_loaded ? T.emerald : T.amber}>
            ML models loaded: {ml?.scoring_engine.ml_models_loaded ? "YES" : "NO"}
          </Tag>
        </div>
        {!ml?.scoring_engine.ml_models_loaded && (
          <div style={{ marginTop: 12, padding: "9px 12px", background: T.amberDim, border: `1px solid ${T.amber}30`, borderRadius: 8 }}>
            <p style={{ fontSize: 11, color: T.amber }}>
              Tidak ada artifact model terlatih — scoring aktif berbasis rule ensemble (deterministik). Saat model PaySim/TrustLens dilatih, kontribusinya otomatis ditambahkan.
            </p>
          </div>
        )}
      </GlassCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Processed + distributions */}
        <GlassCard accent={T.cyan}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>Transaksi Diproses & Distribusi</h3>
          <div style={{ display: "flex", gap: 18, marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: T.cyan, fontFamily: "'JetBrains Mono',monospace" }}>{(ml?.processed_transactions ?? 0).toLocaleString("id-ID")}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>transaksi discoring</div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: T.textSub, fontFamily: "'JetBrains Mono',monospace" }}>{ml?.model_artifacts_count ?? 0}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>model artifacts</div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: T.emerald, fontFamily: "'JetBrains Mono',monospace" }}>{ml?.baseline_model.model_available ? "OK" : "—"}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>baseline model</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {([
              ["HIGH", dist.high, T.red],
              ["MEDIUM", dist.medium, T.amber],
              ["LOW", dist.low, T.emerald],
            ] as const).map(([label, value, color]) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color }}>{label}</span>
                  <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{value.toLocaleString("id-ID")}</span>
                </div>
                <div style={{ height: 7, background: T.border, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(value / maxDist) * 100}%`, height: "100%", background: color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
          {ml && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              {Object.entries(ml.status_distribution).map(([st, count]) => (
                <Tag key={st} color={T.textSub}>{st.toUpperCase()} {count}</Tag>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Adaptive learning */}
        <GlassCard accent={T.emerald}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Adaptive Learning</h3>
            {adaptive?.adaptive_learning_enabled ? <StatusBadge status="actual" /> : <StatusBadge status="pending" />}
          </div>
          {adaptive ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", background: T.violetDim, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12, color: T.textSub }}>Label baru sejak training</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: adaptive.ready_for_retraining ? T.emerald : T.amber, fontFamily: "'JetBrains Mono',monospace" }}>
                  {adaptive.new_labels_since_last_training} / {adaptive.min_labels_required}
                </span>
              </div>
              <div style={{ padding: "9px 12px", background: T.violetDim, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12, color: T.textSub }}>Rekomendasi: </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{adaptive.recommended_action}</span>
              </div>
              <p style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.6 }}>
                Label analyst menjadi data umpan balik untuk retraining model PaySim (continual learning). Retraining otomatis dijalankan backend saat label cukup.
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: T.textMuted }}>Status adaptive learning tidak tersedia.</p>
          )}
        </GlassCard>
      </div>

      {/* Models */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <GlassCard accent={T.indigo}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>Baseline Model</h3>
          {ml?.baseline_model.model_available ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <ModelRow label="Status" value="Tersedia" ok />
              <ModelRow label="Path" value={ml.baseline_model.model_path ?? "—"} mono />
            </div>
          ) : (
            <div style={{ padding: "12px 14px", background: T.amberDim, borderRadius: 8, border: `1px solid ${T.amber}30` }}>
              <p style={{ fontSize: 12, color: T.amber }}>Baseline model belum dilatih. Jalankan POST /api/v1/ml/train-baseline setelah data cukup.</p>
            </div>
          )}
        </GlassCard>

        <GlassCard accent={T.pink}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>Model Tabular Aktif (PaySim)</h3>
          {ml?.active_tabular_model ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <ModelRow label="Model" value={ml.active_tabular_model.model_name ?? "—"} />
              <ModelRow label="Dataset" value={ml.active_tabular_model.dataset_name ?? "—"} mono />
              <ModelRow label="Versi" value={ml.active_tabular_model.version ?? "—"} mono />
              {ml.active_tabular_model.created_at && <ModelRow label="Dibuat" value={formatDateTime(ml.active_tabular_model.created_at)} />}
              {ml.active_tabular_model.accuracy != null && <ModelRow label="Accuracy" value={`${(ml.active_tabular_model.accuracy * 100).toFixed(1)}%`} mono />}
            </div>
          ) : (
            <div style={{ padding: "12px 14px", background: T.amberDim, borderRadius: 8, border: `1px solid ${T.amber}30` }}>
              <p style={{ fontSize: 12, color: T.amber }}>Belum ada model PaySim terlatih — kontribusi ML tidak aktif, rule ensemble yang bekerja.</p>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Latest scoring events */}
      <GlassCard accent={T.red}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Event Scoring Terbaru</h3>
          <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>
            last update: {ml?.last_updated ? formatDateTime(ml.last_updated) : "—"}
          </span>
        </div>
        {!ml || ml.latest_scoring_events.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: T.textMuted, fontSize: 12 }}>Belum ada event scoring.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Transaction", "Score", "Risiko", "Status", "Amount", "Route", "Waktu"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px 10px 0", fontSize: 9, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ml.latest_scoring_events.map((e) => (
                  <tr key={e.transaction_id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "9px 12px 9px 0", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: T.violet, fontWeight: 600, whiteSpace: "nowrap" }}>{e.transaction_reference}</td>
                    <td style={{ padding: "9px 12px 9px 0", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: riskColor(e.risk_level), fontWeight: 700 }}>{e.fraud_score.toFixed(2)}</td>
                    <td style={{ padding: "9px 12px 9px 0" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: riskColor(e.risk_level), background: `${riskColor(e.risk_level)}14`, border: `1px solid ${riskColor(e.risk_level)}35`, padding: "2px 6px", borderRadius: 4, fontFamily: "'JetBrains Mono',monospace" }}>{RISK_LABEL[e.risk_level]}</span>
                    </td>
                    <td style={{ padding: "9px 12px 9px 0", fontSize: 10, color: T.textSub, textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace" }}>{e.status}</td>
                    <td style={{ padding: "9px 12px 9px 0", fontSize: 11, color: T.text, fontWeight: 600, whiteSpace: "nowrap" }}>{formatMoney(e.amount, e.currency)}</td>
                    <td style={{ padding: "9px 12px 9px 0" }}><Tag color={T.indigo}>{e.source_country} → {e.destination_country}</Tag></td>
                    <td style={{ padding: "9px 12px 9px 0", fontSize: 11, color: T.textMuted, whiteSpace: "nowrap" }}>{timeAgo(e.transaction_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ fontSize: 10, color: T.textMuted, marginTop: 12, fontStyle: "italic" }}>
          Skor final memakai ensemble guard: max(rule, blend) — rule-based selalu aktif; kontribusi ML hanya saat artifact terlatih tersedia. Ini prototype, bukan klaim production-ready.
        </p>
      </GlassCard>
    </div>
  )
}

function ModelRow({ label, value, mono, ok }: { label: string; value: string; mono?: boolean; ok?: boolean }) {
  const { T } = useTheme()
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ fontSize: 11, color: T.textMuted }}>{label}</span>
      <span style={{ fontSize: 12, color: ok ? T.emerald : T.text, fontWeight: 600, textAlign: "right", fontFamily: mono ? "'JetBrains Mono',monospace" : "inherit", wordBreak: "break-all" }}>{value}</span>
    </div>
  )
}
