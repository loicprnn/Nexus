import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useChunkedQuotes, useIndicator } from './useMarketData'
import {
  loadAlerts,
  createAlert as createAlertApi,
  setAlertActive as setAlertActiveApi,
  deleteAlert as deleteAlertApi,
  evaluateAlert,
  alertSymbols,
} from '../lib/alerts'

// CRUD over the user's alerts (Supabase when signed in, else localStorage).
// Optimistic local state keeps the UI snappy; persistence runs in the backend.
export function useAlerts() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadAlerts(userId)
      .then((data) => {
        if (!cancelled) {
          setAlerts(data)
          setError(null)
        }
      })
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [userId])

  const create = useCallback(
    async ({ type, config }) => {
      const alert = await createAlertApi(userId, { type, config })
      setAlerts((prev) => [alert, ...prev])
      return alert
    },
    [userId],
  )

  const toggle = useCallback(
    async (id, active) => {
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, active } : a)))
      await setAlertActiveApi(userId, id, active)
    },
    [userId],
  )

  const remove = useCallback(
    async (id) => {
      setAlerts((prev) => prev.filter((a) => a.id !== id))
      await deleteAlertApi(userId, id)
    },
    [userId],
  )

  return { alerts, loading, error, create, toggle, remove }
}

// Watches live data for the active alerts and calls `onTrigger(alert, message)`
// on the RISING EDGE (condition newly met), respecting a per-alert cooldown so a
// value hovering around the threshold doesn't spam notifications.
const COOLDOWN_MS = 30 * 60 * 1000 // 30 min between re-fires of the same alert

export function useAlertMonitor(alerts, onTrigger) {
  const active = useMemo(() => alerts.filter((a) => a.active), [alerts])
  const symbols = useMemo(() => alertSymbols(active), [active])

  const { data: quotes } = useChunkedQuotes(symbols, { chunkSize: 6 })
  const vix = useIndicator('VIXCLS')

  const onTriggerRef = useRef(onTrigger)
  onTriggerRef.current = onTrigger
  // Per-alert state: { met: boolean, firedAt: number } to detect rising edges.
  const stateRef = useRef({})

  useEffect(() => {
    const ctx = {
      quotes: Object.fromEntries((quotes ?? []).map((q) => [q.symbol, q])),
      vix: vix.data?.value ?? null,
    }

    for (const alert of active) {
      const { triggered, message } = evaluateAlert(alert, ctx)
      const prev = stateRef.current[alert.id] ?? { met: false, firedAt: 0 }
      const now = Date.now()
      // Rising edge + not in cooldown.
      if (triggered && !prev.met && now - prev.firedAt > COOLDOWN_MS) {
        onTriggerRef.current?.(alert, message)
        stateRef.current[alert.id] = { met: true, firedAt: now }
      } else {
        stateRef.current[alert.id] = { ...prev, met: triggered }
      }
    }
  }, [quotes, vix.data, active])
}
