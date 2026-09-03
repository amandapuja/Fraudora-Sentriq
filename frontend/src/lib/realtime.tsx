// ─── Realtime context ─────────────────────────────────────────────────────────
// One shared SSE connection (with polling fallback) for the whole dashboard.
// Every domain event (transaction.created, alert.created, alert.updated,
// audit.created, ...) or polling tick bumps `tick`; each tab refetches its
// own data when `tick` changes, so screens stay in sync without manual
// browser refreshes and without each tab opening its own stream.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { useLiveEvents, type LiveStatus } from "./live"
import type { LiveEvent } from "./types"

export interface RealtimeValue {
  /** "connecting" | "live" | "polling" | "off" */
  status: LiveStatus
  /** Last parsed domain event (or null). */
  lastEvent: LiveEvent | null
  /** When the last event/tick arrived. */
  lastUpdated: Date | null
  /** Monotonic counter bumped on every event / poll tick. */
  tick: number
  /** Force a refresh now (e.g. after a local action). */
  refresh: () => void
}

const RealtimeContext = createContext<RealtimeValue>({
  status: "connecting",
  lastEvent: null,
  lastUpdated: null,
  tick: 0,
  refresh: () => undefined,
})

export function RealtimeProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    setTick((t) => t + 1)
  }, [])

  const { status, lastEvent, lastUpdated } = useLiveEvents({
    refresh,
    enabled,
  })

  const value = useMemo<RealtimeValue>(
    () => ({ status, lastEvent, lastUpdated, tick, refresh }),
    [status, lastEvent, lastUpdated, tick, refresh],
  )

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtime(): RealtimeValue {
  return useContext(RealtimeContext)
}
