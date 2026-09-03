// ─── Live connection badge ────────────────────────────────────────────────────
// Shows the realtime transport state (SSE live / polling fallback / offline)
// plus the last-updated timestamp, so the analyst can trust the screen.

import { useTheme } from "../App"
import type { LiveStatus } from "../lib/live"
import { formatDateTime } from "../lib/format"

const CONFIG: Record<LiveStatus, { label: string; color: string; bg: string; border: string }> = {
  connecting: { label: "CONNECTING", color: "", bg: "", border: "" },
  live: { label: "LIVE", color: "", bg: "", border: "" },
  polling: { label: "POLLING", color: "", bg: "", border: "" },
  off: { label: "OFFLINE", color: "", bg: "", border: "" },
}

export function LiveBadge({ status, lastUpdated }: { status: LiveStatus; lastUpdated: Date | null }) {
  const { T } = useTheme()
  const cfg = CONFIG[status]
  const color = status === "live" ? T.emerald : status === "polling" ? T.amber : status === "connecting" ? T.violet : T.red
  const bg = status === "live" ? T.emeraldDim : status === "polling" ? T.amberDim : status === "connecting" ? T.violetDim : T.redDim
  const border = status === "live" ? `${T.emerald}40` : status === "polling" ? `${T.amber}40` : status === "connecting" ? T.borderHi : `${T.red}40`

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: 10,
        fontFamily: "'JetBrains Mono',monospace",
        fontWeight: 700,
        letterSpacing: "0.08em",
        color,
        background: bg,
        border: `1px solid ${border}`,
        padding: "4px 10px",
        borderRadius: 20,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 8px ${color}`,
          animation: status === "live" || status === "connecting" ? "pulse-glow 2s infinite" : "none",
        }}
      />
      {cfg.label}
      {lastUpdated && (
        <span style={{ color: T.textMuted, fontWeight: 500, letterSpacing: "0.02em" }}>
          · {formatDateTime(lastUpdated)}
        </span>
      )}
    </span>
  )
}
