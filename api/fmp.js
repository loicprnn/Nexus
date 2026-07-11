import { getQuery, sendJson } from './_utils.js'

// Secure Financial Modeling Prep proxy. The API key lives ONLY server-side
// (process.env.FMP_API_KEY) and is injected here — never in the client bundle
// nor any browser-visible URL. The client calls e.g.:
//   /api/fmp?endpoint=profile&symbol=AAPL
//   /api/fmp?endpoint=ratios&symbol=AAPL
// Only a small whitelist of endpoints is forwarded to avoid open-proxy abuse.

const BASE = 'https://financialmodelingprep.com'

// endpoint name -> FMP path builder (symbol already validated/encoded).
const ENDPOINTS = {
  profile: (s) => `/api/v3/profile/${s}`,
  ratios: (s) => `/api/v3/ratios-ttm/${s}`,
  income: (s) => `/api/v3/income-statement/${s}?period=annual&limit=1`,
  'etf-info': (s) => `/api/v3/etf-info?symbol=${s}`,
}

export default async function handler(req, res) {
  const key = process.env.FMP_API_KEY
  if (!key) {
    return sendJson(res, 500, { error: 'FMP_API_KEY non configurée côté serveur' })
  }

  const query = getQuery(req)
  const endpoint = query.get('endpoint')
  if (!endpoint || !ENDPOINTS[endpoint]) {
    return sendJson(res, 400, { error: 'endpoint invalide' })
  }
  const symbol = (query.get('symbol') || '').toUpperCase()
  if (!/^[A-Z.\-]{1,12}$/.test(symbol)) {
    return sendJson(res, 400, { error: 'symbol invalide' })
  }

  const upstream = new URL(BASE + ENDPOINTS[endpoint](symbol))
  upstream.searchParams.set('apikey', key)

  try {
    const upstreamRes = await fetch(upstream)
    const json = await upstreamRes.json()
    return sendJson(res, upstreamRes.ok ? 200 : upstreamRes.status, json)
  } catch (err) {
    return sendJson(res, 502, { error: 'FMP injoignable', detail: String(err) })
  }
}
