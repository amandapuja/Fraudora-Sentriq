// ─── Realtime client (Server-Sent Events with polling fallback) ───────────────
// Consumes GET /api/v1/stream/events with fetch() so the JWT can be sent
// via the Authorization header (native EventSource cannot set headers).
// If the stream cannot be established (no token, network issues), the
// client automatically falls back to interval polling so the dashboard
// keeps updating.

import { useEffect, useRef, useState } from "react"
import { API_URL, getToken } from "./api"
import type { LiveEvent, LiveEventType } from "./types"

export type LiveStatus = "connecting" | "live" | "polling" | "off"

interface ConnectOptions {
  onEvent: (event: LiveEvent) => void
  onStatus: (status: LiveStatus) => void
  onTick?: () => void
  pollIntervalMs?: number
}

const MAX_BACKOFF_MS = 15000

export function connectLiveStream(options: ConnectOptions): () => void {
  const { onEvent, onStatus, onTick, pollIntervalMs = 4000 } = options
  let cancelled = false
  let abortController: AbortController | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let backoffMs = 1000

  const enterPolling = () => {
    if (cancelled || pollTimer) return
    onStatus("polling")
    pollTimer = setInterval(() => onTick?.(), pollIntervalMs)
  }

  const scheduleReconnect = () => {
    if (cancelled || pollTimer) return
    onStatus("connecting")
    reconnectTimer = setTimeout(open, backoffMs)
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
  }

  const open = () => {
    if (cancelled) return
    const token = getToken()
    if (!token) {
      // No session -> polling fallback (guest mode still gets updates).
      enterPolling()
      return
    }

    onStatus("connecting")
    abortController = new AbortController()

    fetch(`${API_URL}/stream/events`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (cancelled) return

        if (!response.ok || !response.body) {
          if (response.status === 401) {
            // Token rejected -> fall back to polling.
            enterPolling()
            return
          }
          throw new Error(`stream http ${response.status}`)
        }

        backoffMs = 1000
        onStatus("live")

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const chunks = buffer.split("\n\n")
          buffer = chunks.pop() ?? ""

          for (const chunk of chunks) {
            const parsed = parseSseChunk(chunk)
            if (parsed) onEvent(parsed)
          }
        }
      })
      .catch((err) => {
        if (cancelled) return
        if (err?.name === "AbortError") return
        // Stream dropped -> reconnect with backoff (or polling after N tries).
        if (backoffMs >= MAX_BACKOFF_MS) {
          enterPolling()
          return
        }
        scheduleReconnect()
      })
  }

  open()

  return () => {
    cancelled = true
    if (abortController) abortController.abort()
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (pollTimer) clearInterval(pollTimer)
  }
}

function parseSseChunk(chunk: string): LiveEvent | null {
  const lines = chunk.split("\n")
  let type: LiveEventType | null = null
  let data = ""

  for (const line of lines) {
    if (line.startsWith("event:")) type = line.slice(6).trim() as LiveEventType
    else if (line.startsWith("data:")) data += line.slice(5).trim()
  }

  if (!data) return null
  try {
    const parsed = JSON.parse(data) as LiveEvent
    return { type: parsed.type ?? type ?? "stream.connected", data: parsed.data }
  } catch {
    return null
  }
}

// ─── React hook ───────────────────────────────────────────────────────────────

export function useLiveEvents(options: { refresh: () => void; enabled?: boolean }) {
  const [status, setStatus] = useState<LiveStatus>("connecting")
  const [lastEvent, setLastEvent] = useState<LiveEvent | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const refreshRef = useRef(options.refresh)
  refreshRef.current = options.refresh

  useEffect(() => {
    if (options.enabled === false) return

    let mounted = true
    const handleEvent = (event: LiveEvent) => {
      if (!mounted) return
      setLastEvent(event)
      setLastUpdated(new Date())
      // Any domain event means data changed; refresh dashboard data.
      refreshRef.current()
    }

    const stop = connectLiveStream({
      onEvent: handleEvent,
      onStatus: (s) => {
        if (mounted) setStatus(s)
      },
      onTick: () => refreshRef.current(),
      pollIntervalMs: 4000,
    })

    // Initial load.
    refreshRef.current()

    return () => {
      mounted = false
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.enabled])

  return { status, lastEvent, lastUpdated }
}
