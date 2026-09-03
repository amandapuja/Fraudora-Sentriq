// ─── New-alert toasts ─────────────────────────────────────────────────────────
// Pops a notification whenever the realtime stream reports alert.created,
// so the analyst notices new fraud alerts even while on another tab.
// Clicking a toast jumps to the Alerts queue.

import { useCallback, useEffect, useRef, useState } from "react"
import { useTheme } from "../App"
import type { LiveEvent } from "../lib/types"
import { formatMoneyCompact, timeAgo } from "../lib/format"

export interface AlertToast {
  id: string
  alertId: string
  severity: string
  title: string
  detail: string
  createdAt: number
}

export function useAlertToasts(lastEvent: LiveEvent | null): {
  toasts: AlertToast[]
  dismiss: (id: string) => void
} {
  const [toasts, setToasts] = useState<AlertToast[]>([])
  const lastHandled = useRef<string>("")

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    if (!lastEvent || lastEvent.type !== "alert.created") return
    const payload = lastEvent.data as { alert?: { id?: string; severity?: string; risk_score?: number }; transaction?: { transaction_reference?: string; amount?: number; currency?: string } } | undefined
    const alert = payload?.alert
    if (!alert?.id) return
    // Guard against duplicate handling of the same event object.
    const key = JSON.stringify(lastEvent)
    if (lastHandled.current === key) return
    lastHandled.current = key

    const tx = payload?.transaction
    const id = `${alert.id}-${Date.now()}`
    const toast: AlertToast = {
      id,
      alertId: alert.id ?? "",
      severity: alert.severity ?? "medium",
      title: `New fraud alert · ${(alert.severity ?? "medium").toUpperCase()}`,
      detail: tx?.transaction_reference
        ? `${tx.transaction_reference} · ${formatMoneyCompact(tx.amount ?? 0, tx.currency ?? "IDR")}`
        : "Transaction flagged by the scoring engine",
      createdAt: Date.now(),
    }
    setToasts((prev) => [toast, ...prev].slice(0, 4))
  }, [lastEvent])

  // Auto-dismiss after 8 seconds.
  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => Date.now() - t.createdAt < 8000))
    }, 1000)
    return () => clearTimeout(timer)
  }, [toasts])

  return { toasts, dismiss }
}

export function ToastStack({
  toasts,
  onDismiss,
  onOpenAlerts,
}: {
  toasts: AlertToast[]
  onDismiss: (id: string) => void
  onOpenAlerts: () => void
}) {
  const { T } = useTheme()
  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 1200,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 360,
      }}
    >
      {toasts.map((toast) => {
        const color = toast.severity === "critical" || toast.severity === "high" ? T.red : toast.severity === "medium" ? T.amber : T.emerald
        return (
          <div
            key={toast.id}
            onClick={() => {
              onDismiss(toast.id)
              onOpenAlerts()
            }}
            style={{
              background: T.navBg,
              backdropFilter: T.blur,
              WebkitBackdropFilter: T.blur,
              border: `1px solid ${color}50`,
              borderLeft: `3px solid ${color}`,
              borderRadius: 12,
              padding: "12px 14px",
              boxShadow: "0 10px 36px rgba(0,0,0,0.18)",
              cursor: "pointer",
              animation: "fadeInUp 0.25s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color }}>{toast.title}</span>
              <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap" }}>
                {timeAgo(new Date(toast.createdAt))}
              </span>
            </div>
            <div style={{ fontSize: 12, color: T.textSub, marginTop: 3 }}>{toast.detail}</div>
          </div>
        )
      })}
    </div>
  )
}
