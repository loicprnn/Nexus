import { getQuery, sendJson } from './_utils.js'

// Secure FRED proxy. The API key lives ONLY in the server environment
// (process.env.FRED_API_KEY) and is injected here — it never reaches the client
// bundle nor any browser-visible URL. The client calls:
//   /api/fred?series_id=T10Y2Y&limit=24
// and we forward to the FRED observations endpoint with the key attached.

const UPSTREAM = 'https://api.stlouisfed.org/fred/series/observations'

export default async function handler(req, res) {
  const key = process.env.FRED_API_KEY
  if (!key) {
    return sendJson(res, 500, { error: 'FRED_API_KEY non configurée côté serveur' })
  }

  const query = getQuery(req)
  const seriesId = query.get('series_id')
  if (!seriesId) {
    return sendJson(res, 400, { error: 'Paramètre series_id requis' })
  }
  // Whitelist only the params we expose; everything else (incl. the key) is
  // server-controlled to avoid open-proxy abuse.
  const limit = query.get('limit') || '24'

  const upstream = new URL(UPSTREAM)
  upstream.searchParams.set('series_id', seriesId)
  upstream.searchParams.set('api_key', key)
  upstream.searchParams.set('file_type', 'json')
  upstream.searchParams.set('sort_order', 'desc')
  upstream.searchParams.set('limit', String(limit))

  try {
    const upstreamRes = await fetch(upstream)
    const json = await upstreamRes.json()
    if (!upstreamRes.ok) {
      return sendJson(res, upstreamRes.status, {
        error: `FRED HTTP ${upstreamRes.status}`,
      })
    }
    return sendJson(res, 200, json)
  } catch (err) {
    return sendJson(res, 502, { error: 'FRED injoignable', detail: String(err) })
  }
}
