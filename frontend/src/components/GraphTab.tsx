// ─── Transaction Graph tab ────────────────────────────────────────────────────
// Renders the backend graph (GET /graph — Neo4j when available, otherwise a
// PostgreSQL-derived fallback) as an interactive force-directed SVG.
// Analyst can select an entity/transaction and inspect its relationships.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { GlassCard, Icon, Tag, useTheme } from "../App"
import { useRealtime } from "../lib/realtime"
import { fetchGraph } from "../lib/data"
import type { GraphData, GraphEdge, GraphNode, RiskLevel } from "../lib/types"
import { formatMoney, RISK_LABEL } from "../lib/format"

const W = 1000
const H = 620

type Pos = { x: number; y: number }

export function GraphTab() {
  const { T } = useTheme()
  const { tick, refresh, status } = useRealtime()

  const [graph, setGraph] = useState<GraphData | null>(null)
  const [limit, setLimit] = useState(80)
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "">("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [positions, setPositions] = useState<Record<string, Pos>>({})

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await fetchGraph(limit, riskFilter || undefined)
      setGraph(data)
      setSelectedId((prev) => (prev && data.nodes.some((n) => n.id === prev) ? prev : null))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat graph")
    } finally {
      setLoading(false)
    }
  }, [limit, riskFilter])

  useEffect(() => {
    void load()
  }, [tick, load])

  // Force-directed layout (deterministic, client-side).
  useEffect(() => {
    if (!graph || graph.nodes.length === 0) return
    const positions = layoutGraph(graph.nodes, graph.edges)
    setPositions(positions)
  }, [graph])

  const nodeById = useMemo(() => {
    const map = new Map<string, GraphNode>()
    graph?.nodes.forEach((n) => map.set(n.id, n))
    return map
  }, [graph])

  const neighborIds = useMemo(() => {
    if (!graph || !selectedId) return new Set<string>()
    const set = new Set<string>([selectedId])
    graph.edges.forEach((e) => {
      if (e.source === selectedId) set.add(e.target)
      if (e.target === selectedId) set.add(e.source)
    })
    return set
  }, [graph, selectedId])

  const selectedNode = selectedId ? nodeById.get(selectedId) : null
  const selectedEdges = useMemo(() => {
    if (!graph || !selectedId) return []
    return graph.edges.filter((e) => e.source === selectedId || e.target === selectedId)
  }, [graph, selectedId])

  const typeColor = (label: string) =>
    label === "Account" ? T.violet : label === "Transaction" ? T.cyan : label === "Device" ? T.amber : label === "Merchant" ? T.pink : T.indigo
  const riskColor = (r?: string | null) => (r === "high" ? T.red : r === "medium" ? T.amber : T.emerald)
  const nodeRadius = (n: GraphNode) => (n.label === "Account" ? 13 : n.label === "Transaction" ? 9 + (n.fraud_score ?? 0) * 9 : n.label === "Country" ? 12 : 9)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <GlassCard>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="network" size={17} color={T.violet} />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Transaction Graph Explorer</h3>
            {graph && (
              <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: graph.source === "neo4j" ? T.cyan : T.amber, background: graph.source === "neo4j" ? T.cyanDim : T.amberDim, border: `1px solid ${graph.source === "neo4j" ? T.cyan : T.amber}40`, padding: "3px 9px", borderRadius: 6 }}>
                SOURCE: {graph.source === "neo4j" ? "NEO4J" : "POSTGRES FALLBACK"}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))} style={filterStyle(T)}>
              <option value={40}>40 transaksi</option>
              <option value={80}>80 transaksi</option>
              <option value={150}>150 transaksi</option>
            </select>
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as RiskLevel | "")} style={filterStyle(T)}>
              <option value="">Semua Risiko</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button onClick={() => refresh()} style={{ fontSize: 11, fontWeight: 700, padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", background: T.violetDim, color: T.violet, border: `1px solid ${T.borderHi}` }}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {graph?.notice && (
          <div style={{ marginBottom: 12, padding: "9px 12px", background: T.amberDim, border: `1px solid ${T.amber}30`, borderRadius: 8 }}>
            <p style={{ fontSize: 11, color: T.amber }}>⚠ {graph.notice}</p>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: T.redDim, border: `1px solid ${T.red}40`, borderRadius: 8 }}>
            <p style={{ fontSize: 13, color: T.red }}>{error}</p>
          </div>
        )}

        {loading && !graph ? (
          <div style={{ padding: 60, textAlign: "center", color: T.textSub, fontSize: 13 }}>Membangun graph…</div>
        ) : !graph || graph.nodes.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
            Belum ada data graph. Buat transaksi demo terlebih dahulu.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            {/* SVG canvas */}
            <div style={{ background: T.glassSoft, borderRadius: 12, border: `1px solid ${T.border}`, padding: 8, overflow: "hidden" }}>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
                {/* Edges */}
                {graph.edges.map((e) => {
                  const a = positions[e.source]
                  const b = positions[e.target]
                  if (!a || !b) return null
                  const active = !selectedId || neighborIds.has(e.source) && neighborIds.has(e.target)
                  const dimmed = selectedId && !active
                  return (
                    <g key={e.id} opacity={dimmed ? 0.12 : 1}>
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.label === "SENT" || e.label === "RECEIVED_BY" ? T.cyan : T.violet} strokeWidth={selectedId ? 1.4 : 0.8} opacity={0.5} />
                      <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 3} textAnchor="middle" fontSize={7} fill={T.textMuted} fontFamily="JetBrains Mono">
                        {e.label}
                      </text>
                    </g>
                  )
                })}
                {/* Nodes */}
                {graph.nodes.map((n) => {
                  const pos = positions[n.id]
                  if (!pos) return null
                  const r = nodeRadius(n)
                  const color = typeColor(n.label)
                  const dimmed = selectedId && !neighborIds.has(n.id)
                  const isSelected = selectedId === n.id
                  return (
                    <g key={n.id} opacity={dimmed ? 0.15 : 1} style={{ cursor: "pointer" }} onClick={() => setSelectedId(isSelected ? null : n.id)}>
                      {isSelected && <circle cx={pos.x} cy={pos.y} r={r + 7} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />}
                      {n.risk_level === "high" && n.label === "Transaction" && (
                        <circle cx={pos.x} cy={pos.y} r={r + 4} fill="none" stroke={T.red} strokeWidth={1} opacity={0.55}>
                          <animate attributeName="r" values={`${r + 2};${r + 6};${r + 2}`} dur="2.4s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite" />
                        </circle>
                      )}
                      <circle cx={pos.x} cy={pos.y} r={r} fill={color} opacity={0.92} stroke={n.risk_level ? riskColor(n.risk_level) : "none"} strokeWidth={n.risk_level ? 2 : 0} />
                      <text x={pos.x} y={pos.y + r + 11} textAnchor="middle" fontSize={8.5} fill={T.textSub} fontFamily="JetBrains Mono" style={{ pointerEvents: "none" }}>
                        {n.label === "Transaction" ? (n.title ?? n.id.slice(0, 6)) : n.label === "Country" ? (n.code ?? n.title) : (n.account_number ?? n.title ?? n.id.slice(0, 8))}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Inspector */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 620, overflowY: "auto" }}>
              {!selectedNode ? (
                <div style={{ padding: 20, textAlign: "center", color: T.textMuted, fontSize: 12, background: T.glassSoft, borderRadius: 12, border: `1px solid ${T.border}` }}>
                  <Icon name="network" size={26} color={T.violet} />
                  <p style={{ marginTop: 10 }}>Klik entitas pada graph untuk memeriksa hubungannya.</p>
                  <p style={{ marginTop: 6, fontSize: 11 }}>Akun → Transaksi → Akun / Perangkat / Merchant / Negara</p>
                </div>
              ) : (
                <>
                  <div style={{ padding: 16, background: T.violetDim, borderRadius: 12, border: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: typeColor(selectedNode.label), background: `${typeColor(selectedNode.label)}14`, border: `1px solid ${typeColor(selectedNode.label)}35`, padding: "3px 8px", borderRadius: 5 }}>
                        {selectedNode.label.toUpperCase()}
                      </span>
                      {selectedNode.risk_level && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: riskColor(selectedNode.risk_level), background: `${riskColor(selectedNode.risk_level)}14`, border: `1px solid ${riskColor(selectedNode.risk_level)}40`, padding: "3px 7px", borderRadius: 4, fontFamily: "'JetBrains Mono',monospace" }}>
                          {RISK_LABEL[selectedNode.risk_level]}
                        </span>
                      )}
                    </div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 10, wordBreak: "break-all" }}>{selectedNode.title ?? selectedNode.id}</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <InspectorRow label="ID" value={selectedNode.id} mono />
                      {selectedNode.account_number != null && <InspectorRow label="Account" value={selectedNode.account_number} mono />}
                      {selectedNode.amount != null && <InspectorRow label="Amount" value={formatMoney(selectedNode.amount, selectedNode.currency ?? "IDR")} />}
                      {selectedNode.fraud_score != null && <InspectorRow label="Fraud Score" value={selectedNode.fraud_score.toFixed(2)} mono />}
                      {selectedNode.status && <InspectorRow label="Status" value={selectedNode.status} mono />}
                      {selectedNode.category && <InspectorRow label="Category" value={selectedNode.category} />}
                      {selectedNode.code && <InspectorRow label="Code" value={selectedNode.code} mono />}
                      {selectedNode.ip_address && <InspectorRow label="IP" value={selectedNode.ip_address} mono />}
                      {selectedNode.is_blacklisted != null && <InspectorRow label="Blacklisted" value={selectedNode.is_blacklisted ? "YES" : "NO"} mono />}
                    </div>
                  </div>

                  <div style={{ padding: 14, background: T.glassSoft, borderRadius: 12, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.textMuted, marginBottom: 8, letterSpacing: "0.1em" }}>HUBUNGAN ({selectedEdges.length})</div>
                    {selectedEdges.length === 0 ? (
                      <p style={{ fontSize: 11, color: T.textMuted }}>Tidak ada hubungan langsung.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {selectedEdges.map((e: GraphEdge) => {
                          const otherId = e.source === selectedId ? e.target : e.source
                          const other = nodeById.get(otherId)
                          return (
                            <div key={e.id} onClick={() => setSelectedId(otherId)} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, cursor: "pointer", padding: "6px 8px", borderRadius: 8, background: T.violetDim, border: `1px solid ${T.border}` }}>
                              <Tag color={typeColor(other?.label ?? "")}>{e.label}</Tag>
                              <span style={{ color: T.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {other?.label === "Transaction" ? (other.title ?? other.id.slice(0, 10)) : other?.label === "Country" ? (other.code ?? other.title) : (other?.account_number ?? other?.title ?? otherId.slice(0, 10))}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 14 }}>
          {[["Account", T.violet], ["Transaction", T.cyan], ["Device", T.amber], ["Merchant", T.pink], ["Country", T.indigo]].map(([label, c]) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: c as string }} />{label}
            </span>
          ))}
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", border: `2px solid ${T.red}` }} />High risk
          </span>
          <span style={{ fontSize: 10, color: T.textMuted, marginLeft: "auto" }}>{graph?.nodes.length ?? 0} node · {graph?.edges.length ?? 0} edge · {status === "live" ? "LIVE" : "POLLING"}</span>
        </div>
      </GlassCard>
    </div>
  )
}

// ─── Simple deterministic force-directed layout ──────────────────────────────

function layoutGraph(nodes: GraphNode[], edges: GraphEdge[]): Record<string, Pos> {
  const positions: Record<string, Pos> = {}
  const velocities: Record<string, { x: number; y: number }> = {}
  const n = nodes.length

  // Initial positions on a circle (deterministic).
  nodes.forEach((node, i) => {
    const angle = (i / Math.max(1, n)) * Math.PI * 2
    const radius = Math.min(W, H) * 0.34
    positions[node.id] = { x: W / 2 + Math.cos(angle) * radius, y: H / 2 + Math.sin(angle) * radius * 0.8 }
    velocities[node.id] = { x: 0, y: 0 }
  })

  const adjacency = new Map<string, string[]>()
  edges.forEach((e) => {
    if (!adjacency.has(e.source)) adjacency.set(e.source, [])
    if (!adjacency.has(e.target)) adjacency.set(e.target, [])
    adjacency.get(e.source)!.push(e.target)
    adjacency.get(e.target)!.push(e.source)
  })

  const k = Math.sqrt((W * H) / Math.max(1, n)) * 0.9
  const iterations = 140

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = positions[nodes[i].id]
        const b = positions[nodes[j].id]
        let dx = a.x - b.x
        let dy = a.y - b.y
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.01
        const force = (k * k) / dist
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        velocities[nodes[i].id].x += fx
        velocities[nodes[i].id].y += fy
        velocities[nodes[j].id].x -= fx
        velocities[nodes[j].id].y -= fy
      }
    }
    // Springs
    edges.forEach((e) => {
      const a = positions[e.source]
      const b = positions[e.target]
      if (!a || !b) return
      let dx = a.x - b.x
      let dy = a.y - b.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
      const force = (dist - k * 0.85) * 0.04
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      velocities[e.source].x -= fx
      velocities[e.source].y -= fy
      velocities[e.target].x += fx
      velocities[e.target].y += fy
    })
    // Centering + damping + bounds
    nodes.forEach((node) => {
      const v = velocities[node.id]
      const p = positions[node.id]
      v.x += (W / 2 - p.x) * 0.008
      v.y += (H / 2 - p.y) * 0.008
      v.x *= 0.82
      v.y *= 0.82
      p.x += v.x
      p.y += v.y
      p.x = Math.max(40, Math.min(W - 40, p.x))
      p.y = Math.max(40, Math.min(H - 40, p.y))
    })
  }

  return positions
}

function InspectorRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { T } = useTheme()
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ fontSize: 11, color: T.textMuted }}>{label}</span>
      <span style={{ fontSize: 11, color: T.text, fontWeight: 600, textAlign: "right", fontFamily: mono ? "'JetBrains Mono',monospace" : "inherit", wordBreak: "break-all" }}>{value}</span>
    </div>
  )
}

function filterStyle(T: ReturnType<typeof useTheme>["T"]): CSSProperties {
  return {
    fontSize: 12, padding: "7px 10px", borderRadius: 8, background: T.glassCard,
    border: `1px solid ${T.border}`, color: T.text, fontFamily: "inherit", cursor: "pointer", outline: "none",
  }
}
