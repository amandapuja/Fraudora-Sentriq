// ─── Transactions tab ─────────────────────────────────────────────────────────
// Live transaction monitoring backed by GET /transactions + GET /transactions/:id.
// Includes a controlled DEMO GENERATOR that creates transactions through the
// real backend pipeline (POST /transactions/demo/generate) — scoring, alerting,
// audit logging and realtime push happen backend-side, not in the browser.

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { GlassCard, Icon, StatusBadge, Tag, useTheme } from "../App"
import { useRealtime } from "../lib/realtime"
import { fetchTransactionDetail, fetchTransactions, generateDemoTransactions } from "../lib/data"
import type { DemoGenerateResponse, RiskLevel, Transaction, TxStatus } from "../lib/types"
import { CHANNEL_LABEL, formatDateTime, formatMoney, RISK_LABEL, TX_STATUS_LABEL, timeAgo } from "../lib/format"

const PAGE_SIZE = 15

export function TransactionsTab() {
  const { T } = useTheme()
  const { tick, refresh } = useRealtime()

  const [items, setItems] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "">("")
  const [statusFilter, setStatusFilter] = useState<TxStatus | "">("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      setError(null)
      const result = await fetchTransactions({ limit: PAGE_SIZE, offset, risk_level: riskFilter || undefined, status: statusFilter || undefined })
      setItems(result.items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat transaksi")
    } finally {
      setLoading(false)
    }
  }, [offset, riskFilter, statusFilter])

  useEffect(() => {
    void load()
  }, [tick, load])

  async function openDetail(tx: Transaction) {
    setSelected(tx)
    setDetailLoading(true)
    try {
      const detail = await fetchTransactionDetail(tx.id)
      setSelected(detail)
    } catch {
      // Keep the row-level data if the detail call fails.
    } finally {
      setDetailLoading(false)
    }
  }

  const riskColor = (r: string) => (r === "high" ? T.red : r === "medium" ? T.amber : T.emerald)
  const statusColor = (s: string) => (s === "blocked" ? T.red : s === "flagged" ? T.amber : s === "approved" ? T.emerald : T.textSub)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <GlassCard className="fst-tab-content">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Transaction Monitoring</h3>
            <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
              {total.toLocaleString("id-ID")} transaksi · menampilkan {offset + 1}–{Math.min(offset + PAGE_SIZE, total)}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={riskFilter} onChange={(e) => { setRiskFilter(e.target.value as RiskLevel | ""); setOffset(0) }} style={filterStyle(T)}>
              <option value="">Semua Risiko</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as TxStatus | ""); setOffset(0) }} style={filterStyle(T)}>
              <option value="">Semua Status</option>
              <option value="approved">Approved</option>
              <option value="flagged">Flagged</option>
              <option value="blocked">Blocked</option>
              <option value="pending">Pending</option>
            </select>
            <div style={{ display: "flex", gap: 4 }}>
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} style={pageBtn(T, offset === 0)}>‹ Prev</button>
              <button disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)} style={pageBtn(T, offset + PAGE_SIZE >= total)}>Next ›</button>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: T.redDim, border: `1px solid ${T.red}40`, borderRadius: 8, marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: T.red }}>{error}</p>
          </div>
        )}

        {loading && items.length === 0 ? (
          <div style={{ padding: 36, textAlign: "center", color: T.textSub, fontSize: 13 }}>Memuat transaksi…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 36, textAlign: "center" }}>
            <p style={{ fontSize: 13, color: T.textSub }}>Tidak ada transaksi dengan filter ini.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Transaction ID", "Waktu", "Pengirim", "Penerima", "Amount", "Route", "Tipe", "Skor", "Risiko", "Status"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px 12px 0", fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((tx) => (
                  <tr key={tx.id} onClick={() => void openDetail(tx)} style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = T.violetDim)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                    <td style={{ padding: "11px 12px 11px 0", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: T.violet, fontWeight: 600, whiteSpace: "nowrap" }}>{tx.transaction_reference}</td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 11, color: T.textMuted, whiteSpace: "nowrap" }}>{timeAgo(tx.transaction_time)}</td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 11, color: T.textSub, whiteSpace: "nowrap" }}>{tx.sender_account?.account_number ?? "?"}</td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 11, color: T.textSub, whiteSpace: "nowrap" }}>{tx.receiver_account?.account_number ?? "?"}</td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 12, color: T.text, fontWeight: 600, whiteSpace: "nowrap" }}>{formatMoney(tx.amount, tx.currency)}</td>
                    <td style={{ padding: "11px 12px 11px 0" }}><Tag color={T.indigo}>{tx.source_country} → {tx.destination_country}</Tag></td>
                    <td style={{ padding: "11px 12px 11px 0", fontSize: 11, color: T.textMuted, whiteSpace: "nowrap" }}>{CHANNEL_LABEL[tx.channel] ?? tx.channel}</td>
                    <td style={{ padding: "11px 12px 11px 0", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: riskColor(tx.risk_level), fontWeight: 700 }}>{tx.fraud_score.toFixed(2)}</td>
                    <td style={{ padding: "11px 12px 11px 0" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: riskColor(tx.risk_level), background: `${riskColor(tx.risk_level)}14`, border: `1px solid ${riskColor(tx.risk_level)}35`, padding: "3px 7px", borderRadius: 4, fontFamily: "'JetBrains Mono',monospace" }}>{RISK_LABEL[tx.risk_level]}</span>
                    </td>
                    <td style={{ padding: "11px 12px 11px 0" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: statusColor(tx.status), background: `${statusColor(tx.status)}12`, border: `1px solid ${statusColor(tx.status)}35`, padding: "3px 8px", borderRadius: 6, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" }}>{TX_STATUS_LABEL[tx.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <DemoGenerator onDone={() => refresh()} />

      {selected && (
        <TransactionDetailModal tx={selected} loading={detailLoading} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

// ─── Controlled demo generator ────────────────────────────────────────────────

const SCENARIOS: { id: string; label: string; desc: string }[] = [
  { id: "random", label: "Random", desc: "Campuran acak — risiko bervariasi" },
  { id: "cross_border_high", label: "Cross-Border High", desc: "ID → NG/RU/US/PH/MY/SG, nominal besar" },
  { id: "large_amount", label: "Large Amount", desc: "Nominal 60–250 jt — memicu skor tinggi" },
  { id: "blacklisted_device", label: "Blacklisted Device", desc: "Perangkat diblacklist — sinyal kuat" },
]

function DemoGenerator({ onDone }: { onDone: () => void }) {
  const { T, G } = useTheme()
  const [count, setCount] = useState(3)
  const [scenario, setScenario] = useState("random")
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<DemoGenerateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await generateDemoTransactions(count, scenario as "random" | "cross_border_high" | "large_amount" | "blacklisted_device")
      setResult(res)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat transaksi demo")
    } finally {
      setRunning(false)
    }
  }

  return (
    <GlassCard accent={T.amber}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="zap" size={17} color={T.amber} />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Demo Transaction Generator</h3>
          <StatusBadge status="simulation" />
        </div>
        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.amber }}>
          DEMO DATA — diproses melalui pipeline backend sungguhan
        </span>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label style={{ fontSize: 11, color: T.textSub, display: "block", marginBottom: 6 }}>Jumlah</label>
          <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} style={{ width: 80, ...filterStyle(T) }} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ fontSize: 11, color: T.textSub, display: "block", marginBottom: 6 }}>Skenario</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SCENARIOS.map((s) => (
              <button key={s.id} title={s.desc} onClick={() => setScenario(s.id)} style={{
                fontSize: 10, fontWeight: 700, padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                background: scenario === s.id ? G.ctaBtn : T.glassSoft, color: scenario === s.id ? "#fff" : T.textSub,
                border: scenario === s.id ? "none" : `1px solid ${T.border}`,
              }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => void generate()} disabled={running} style={{
          fontSize: 13, fontWeight: 700, padding: "10px 22px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
          background: G.pinkBtn, color: "#fff", border: "none", opacity: running ? 0.6 : 1,
          boxShadow: "0 6px 20px rgba(244,114,182,0.25)",
        }}>
          {running ? "Memproses…" : `Generate ${count} Transaksi`}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: "9px 12px", background: T.redDim, border: `1px solid ${T.red}40`, borderRadius: 8 }}>
          <p style={{ fontSize: 12, color: T.red }}>{error}</p>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: T.violetDim, borderRadius: 10, border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: T.text }}>✓ {result.message}</span>
            <span style={{ fontSize: 12, color: T.textSub }}>{result.count} transaksi</span>
            <span style={{ fontSize: 12, color: T.red, fontWeight: 700 }}>{result.alerts_created} alert dibuat</span>
            <span style={{ fontSize: 12, color: T.amber, fontWeight: 700 }}>{result.high_risk_count} high-risk</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {result.items.map((item) => {
              const color = item.transaction.risk_level === "high" ? T.red : item.transaction.risk_level === "medium" ? T.amber : T.emerald
              return (
                <div key={item.transaction.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: T.violet, fontWeight: 600, minWidth: 160 }}>{item.transaction.transaction_reference}</span>
                  <span style={{ color: T.textSub, minWidth: 110 }}>{formatMoney(item.transaction.amount, item.transaction.currency)}</span>
                  <span style={{ color: T.textMuted }}>{item.transaction.source_country} → {item.transaction.destination_country}</span>
                  <span style={{ color, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{item.transaction.fraud_score.toFixed(2)}</span>
                  <span style={{ color, fontWeight: 700 }}>{RISK_LABEL[item.transaction.risk_level]}</span>
                  {item.alert_created && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: T.red, background: T.redDim, border: `1px solid ${T.red}40`, padding: "2px 7px", borderRadius: 4 }}>ALERT ⚠</span>
                  )}
                </div>
              )
            })}
          </div>
          <p style={{ fontSize: 10, color: T.textMuted, marginTop: 10, fontStyle: "italic" }}>
            Transaksi ini dibuat melalui API backend, melalui scoring & alert engine yang sama dengan alur normal, dan tercatat di audit log sebagai demo data.
          </p>
        </div>
      )}
    </GlassCard>
  )
}

// ─── Transaction detail modal ─────────────────────────────────────────────────

export function TransactionDetailModal({ tx, loading, onClose }: { tx: Transaction; loading: boolean; onClose: () => void }) {
  const { T } = useTheme()
  const riskColor = (r: string) => (r === "high" ? T.red : r === "medium" ? T.amber : T.emerald)

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", animation: "fadeIn 0.2s ease" }}>
      <div style={{ width: "100%", maxWidth: 640, maxHeight: "88vh", overflowY: "auto", background: T.glassCard, backdropFilter: T.blur, WebkitBackdropFilter: T.blur, border: `1px solid ${T.border}`, borderRadius: 18, boxShadow: "0 24px 80px rgba(0,0,0,0.25)", padding: 28, animation: "fadeInUp 0.3s ease", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 18, padding: 6 }}>✕</button>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: T.textSub, fontSize: 13 }}>Memuat detail transaksi…</div>
        ) : (
          <>
            <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.textMuted, letterSpacing: "0.1em", marginBottom: 6 }}>TRANSACTION DETAIL</div>
            <h3 style={{ fontSize: 19, fontWeight: 800, color: T.text, marginBottom: 2 }}>
              {tx.transaction_reference}
              <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 700, color: riskColor(tx.risk_level), background: `${riskColor(tx.risk_level)}14`, border: `1px solid ${riskColor(tx.risk_level)}40`, padding: "3px 9px", borderRadius: 5, fontFamily: "'JetBrains Mono',monospace", verticalAlign: "middle" }}>
                {RISK_LABEL[tx.risk_level]}
              </span>
            </h3>
            <p style={{ fontSize: 12, color: T.textSub, marginBottom: 20 }}>{formatDateTime(tx.transaction_time)} · {CHANNEL_LABEL[tx.channel] ?? tx.channel} · IP {tx.ip_address ?? "—"}</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <InfoBox title="PENGIRIM">
                <InfoRow label="Akun" value={tx.sender_account?.account_number ?? "—"} />
                <InfoRow label="Pemilik" value={tx.sender_account?.holder_name ?? "—"} />
                <InfoRow label="Risiko" value={tx.sender_account ? tx.sender_account.risk_level.toUpperCase() : "—"} mono />
              </InfoBox>
              <InfoBox title="PENERIMA">
                <InfoRow label="Akun" value={tx.receiver_account?.account_number ?? "—"} />
                <InfoRow label="Pemilik" value={tx.receiver_account?.holder_name ?? "—"} />
                <InfoRow label="Risiko" value={tx.receiver_account ? tx.receiver_account.risk_level.toUpperCase() : "—"} mono />
              </InfoBox>
            </div>

            <InfoBox title="TRANSAKSI" style={{ marginBottom: 16 }}>
              <InfoRow label="Amount" value={formatMoney(tx.amount, tx.currency)} />
              <InfoRow label="Currency" value={tx.currency} mono />
              <InfoRow label="Route" value={`${tx.source_country} → ${tx.destination_country}`} />
              <InfoRow label="Fraud Score" value={tx.fraud_score.toFixed(2)} mono />
              <InfoRow label="Status" value={TX_STATUS_LABEL[tx.status]} />
              <InfoRow label="Tipe / Channel" value={CHANNEL_LABEL[tx.channel] ?? tx.channel} />
            </InfoBox>

            {tx.device && (
              <InfoBox title="PERANGKAT" style={{ marginBottom: 16 }}>
                <InfoRow label="Fingerprint" value={tx.device.device_fingerprint} />
                <InfoRow label="Tipe" value={tx.device.device_type ?? "—"} />
                <InfoRow label="OS / Browser" value={`${tx.device.os ?? "—"} / ${tx.device.browser ?? "—"}`} />
                <InfoRow label="IP" value={tx.device.ip_address ?? "—"} mono />
                <InfoRow label="Blacklist" value={tx.device.is_blacklisted ? "YES" : "NO"} mono />
              </InfoBox>
            )}

            {tx.merchant && (
              <InfoBox title="MERCHANT">
                <InfoRow label="Nama" value={tx.merchant.name} />
                <InfoRow label="Kategori" value={tx.merchant.category ?? "—"} />
                <InfoRow label="Negara" value={tx.merchant.country_code ?? "—"} mono />
                <InfoRow label="Risiko" value={tx.merchant.risk_level.toUpperCase()} mono />
              </InfoBox>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function InfoBox({ title, children, style }: { title: string; children: ReactNode; style?: CSSProperties }) {
  const { T } = useTheme()
  return (
    <div style={{ padding: 14, background: T.violetDim, borderRadius: 10, border: `1px solid ${T.border}`, ...style }}>
      <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.textMuted, marginBottom: 10, letterSpacing: "0.1em" }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{children}</div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { T } = useTheme()
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 11, color: T.textMuted }}>{label}</span>
      <span style={{ fontSize: 12, color: T.text, fontWeight: 600, textAlign: "right", fontFamily: mono ? "'JetBrains Mono',monospace" : "inherit", wordBreak: "break-all" }}>{value}</span>
    </div>
  )
}

function filterStyle(T: ReturnType<typeof useTheme>["T"]): CSSProperties {
  return {
    fontSize: 12, padding: "7px 10px", borderRadius: 8, background: T.glassCard,
    border: `1px solid ${T.border}`, color: T.text, fontFamily: "inherit", cursor: "pointer", outline: "none",
  }
}

function pageBtn(T: ReturnType<typeof useTheme>["T"], disabled: boolean): CSSProperties {
  return {
    fontSize: 11, fontWeight: 700, padding: "7px 12px", borderRadius: 8, cursor: disabled ? "default" : "pointer",
    fontFamily: "inherit", background: disabled ? T.glassSoft : T.violetDim, color: disabled ? T.textMuted : T.violet,
    border: `1px solid ${T.border}`, opacity: disabled ? 0.6 : 1,
  }
}
