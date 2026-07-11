import { getQuery, sendJson } from './_utils.js'

// Secure Twelve Data proxy. The API key lives ONLY server-side
// (process.env.TWELVE_DATA_KEY) and is injected here — never in the client
// bundle nor any browser-visible URL. The client calls:
//   /api/twelvedata?endpoint=quote&symbol=AAPL,MSFT
//   /api/twelvedata?endpoint=time_series&symbol=VIX&interval=5min&outputsize=78
// Only a small whitelist of endpoints/params is forwarded to avoid open-proxy
// abuse.

const BASE = 'https://api.twelvedata.com'
const ALLOWED_ENDPOINTS = new Set(['quote', 'time_series', 'price'])
const ALLOWED_PARAMS = ['symbol', 'interval', 'outputsize', 'type']

export default async function handler(req, res) {
  const key = process.env.TWELVE_DATA_KEY
  if (!key) {
    return sendJson(res, 500, { error: 'TWELVE_DATA_KEY non configurée côté serveur' })
  }

  const query = getQuery(req)
  const endpoint = query.get('endpoint')
  if (!endpoint || !ALLOWED_ENDPOINTS.has(endpoint)) {
    return sendJson(res, 400, { error: 'endpoint invalide' })
  }
  const symbol = query.get('symbol')
  if (!symbol) {
    return sendJson(res, 400, { error: 'Paramètre symbol requis' })
  }

  const upstream = new URL(`${BASE}/${endpoint}`)
  for (const p of ALLOWED_PARAMS) {
    const v = query.get(p)
    if (v != null && v !== '') upstream.searchParams.set(p, v)
  }
  upstream.searchParams.set('apikey', key)

  try {
    const upstreamRes = await fetch(upstream)
    const json = await upstreamRes.json()
    // Twelve Data returns HTTP 200 with a {status:"error"} body on many errors,
    // and 429 on rate-limit; relay the body so the client can fall back.
    return sendJson(res, upstreamRes.ok ? 200 : upstreamRes.status, json)
  } catch (err) {
    return sendJson(res, 502, { error: 'Twelve Data injoignable', detail: String(err) })
  }
}
