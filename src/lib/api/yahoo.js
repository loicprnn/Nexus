import { cached, TTL } from './cache'

// Yahoo Finance via the dev/prod proxy (see vite.config.js / vercel.json).
// The `spark` endpoint returns price series + meta for MANY symbols in a
// single request — essential to stay under Yahoo's aggressive rate limit
// (per-symbol chart calls trigger 429s). No crumb/cookie required.

const SPARK = '/api/yahoo/v8/finance/spark'

function parseSparkEntry(entry) {
  const resp = entry?.response?.[0]
  if (!resp) return null
  const meta = resp.meta ?? {}
  const closes = (resp.indicators?.quote?.[0]?.close ?? []).filter(
    (v) => typeof v === 'number',
  )
  const price = meta.regularMarketPrice ?? closes[closes.length - 1] ?? null
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null
  if (price == null) return null
  const change = prevClose != null ? price - prevClose : 0
  const changePct = prevClose ? (change / prevClose) * 100 : 0
  return {
    symbol: entry.symbol ?? meta.symbol,
    price,
    prevClose,
    change,
    changePct,
    currency: meta.currency ?? 'USD',
    series: closes,
  }
}

// Batched quotes for a list of symbols. Cached as a group; a single bad
// symbol just drops out of the result. `range`/`interval` shape the series.
export function getQuotes(symbols, { range = '1d', interval = '5m' } = {}) {
  if (!symbols.length) return Promise.resolve([])
  const key = `ysp:${symbols.join(',')}:${range}:${interval}`
  return cached(key, TTL.QUOTES, async () => {
    const url =
      `${SPARK}?symbols=${encodeURIComponent(symbols.join(','))}` +
      `&range=${range}&interval=${interval}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Yahoo spark: HTTP ${res.status}`)
    const json = await res.json()
    const results = json?.spark?.result ?? []
    return results.map(parseSparkEntry).filter(Boolean)
  })
}

export async function getQuote(symbol, opts) {
  const [quote] = await getQuotes([symbol], opts)
  return quote ?? null
}
