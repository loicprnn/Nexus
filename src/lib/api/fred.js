import { cached, TTL } from './cache'

// FRED (Federal Reserve, St. Louis) via the secure server proxy (/api/fred).
// The API key lives ONLY server-side (process.env.FRED_API_KEY in api/fred.js +
// the Vite dev middleware) and is never present in the client bundle or any
// browser-visible URL. The proxy is always reachable, so the macro page is
// available unconditionally — if the server key is missing it returns an error
// that surfaces as "Données indisponibles".
const BASE = '/api/fred'

export const fredConfigured = true

// Latest `limit` observations of a series, oldest-first, '.' (missing) dropped.
function fetchObservations(seriesId, limit) {
  const key = `fred:${seriesId}:${limit}`
  return cached(key, TTL.MACRO, async () => {
    const url = `${BASE}?series_id=${encodeURIComponent(seriesId)}&limit=${limit}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`FRED ${seriesId}: HTTP ${res.status}`)
    const json = await res.json()
    return (json.observations ?? [])
      .map((o) => ({ date: o.date, value: o.value === '.' ? null : Number(o.value) }))
      .filter((o) => o.value != null)
      .reverse()
  })
}

// A single indicator: latest value, change vs previous observation, series.
export async function getIndicator(seriesId, { limit = 24 } = {}) {
  const obs = await fetchObservations(seriesId, limit)
  if (!obs.length) throw new Error(`FRED ${seriesId}: aucune donnée`)
  const series = obs.map((o) => o.value)
  const latest = series[series.length - 1]
  const prev = series.length > 1 ? series[series.length - 2] : latest
  return {
    seriesId,
    value: latest,
    prev,
    change: latest - prev,
    date: obs[obs.length - 1].date,
    series,
  }
}

// Year-over-year % change for monthly series (e.g. CPI). Needs 13+ months.
export async function getYoY(seriesId, { months = 18 } = {}) {
  const obs = await fetchObservations(seriesId, months)
  if (obs.length < 13) throw new Error(`FRED ${seriesId}: historique insuffisant`)
  const yoy = obs
    .map((o, i) => {
      const base = obs[i - 12]
      if (!base) return null
      return { date: o.date, value: ((o.value - base.value) / base.value) * 100 }
    })
    .filter(Boolean)
  const series = yoy.map((p) => p.value)
  const latest = series[series.length - 1]
  const prev = series.length > 1 ? series[series.length - 2] : latest
  return {
    seriesId,
    value: latest,
    prev,
    change: latest - prev,
    date: yoy[yoy.length - 1].date,
    series,
  }
}
