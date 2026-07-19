import { cached, TTL } from './cache'

// Twelve Data via the secure server proxy (/api/twelvedata). The API key is
// injected server-side and never reaches the client. This is the PRIMARY price
// source; symbols Twelve Data can't serve (or a full failure) are handled by the
// Yahoo fallback in quotes.js.

const PROXY = '/api/twelvedata'

function num(x) {
  if (x == null || x === '') return null
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}

// Map our catalog (Yahoo-style) symbols to Twelve Data symbology, but ONLY for
// instrument classes the (free) plan can actually serve: US equities and forex.
// Indices (`^…`), futures (`=F`) and foreign listings (`.AS`) return null and go
// straight to the Yahoo fallback. This is deliberate: on the free plan those
// classes error out, and since Twelve Data's 8-credits/minute budget is shared,
// wasting credits on doomed index/futures calls would also starve the equity
// quotes. (A paid plan could enable indices — extend this map then.)
export function toTwelveData(sym) {
  if (!sym) return null
  if (/^[A-Z]{1,6}$/.test(sym)) return sym // US equities: AAPL, MSFT…
  if (sym.endsWith('=X')) {
    const base = sym.slice(0, -2)
    if (/^[A-Z]{6}$/.test(base)) return `${base.slice(0, 3)}/${base.slice(3)}` // EURUSD=X -> EUR/USD
  }
  return null
}

async function proxyJson(params) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${PROXY}?${qs}`)
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(json?.error || json?.message || `Twelve Data HTTP ${res.status}`)
  }
  // Twelve Data signals many failures with HTTP 200 + {status:'error'}.
  if (json && json.status === 'error' && !json.symbol) {
    throw new Error(json.message || 'Twelve Data error')
  }
  return json
}

// Normalise a /quote or /time_series response into a map keyed by the requested
// Twelve Data symbol. Single-symbol requests return a flat object; multi-symbol
// requests return an object already keyed by symbol.
function keyBySymbol(json, tdSymbols) {
  if (!json) return {}
  if (tdSymbols.length === 1) return { [tdSymbols[0]]: json }
  return json
}

function parseQuote(q) {
  if (!q || q.status === 'error') return null
  const price = num(q.close ?? q.price)
  if (price == null) return null
  const prevClose = num(q.previous_close)
  let changePct = num(q.percent_change)
  if (changePct == null) changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0
  let change = num(q.change)
  if (change == null) change = prevClose != null ? price - prevClose : 0
  return {
    price,
    prevClose,
    change,
    changePct,
    currency: q.currency ?? 'USD',
    // Minimal 2-point series so sparklines render even without intraday data;
    // replaced by the real intraday series when `sparkline` is requested.
    series: prevClose != null ? [prevClose, price] : [price],
  }
}

// Real intraday close series per symbol (oldest-first), for sparkline widgets.
async function fetchSeries(tdSymbols, { interval = '5min', outputsize = 78 } = {}) {
  const json = await proxyJson({
    endpoint: 'time_series',
    symbol: tdSymbols.join(','),
    interval,
    outputsize: String(outputsize),
  })
  const map = new Map()
  const keyed = keyBySymbol(json, tdSymbols)
  for (const td of tdSymbols) {
    const entry = keyed[td]
    if (!entry || entry.status === 'error' || !Array.isArray(entry.values)) continue
    const closes = entry.values
      .map((v) => num(v.close))
      .filter((v) => v != null)
      .reverse() // Twelve Data returns newest-first
    if (closes.length) map.set(td, closes)
  }
  return map
}

// OHLC candles (oldest-first) for ONE symbol, for the Analyse candlestick chart.
// Returns [] for symbols Twelve Data can't serve (indices, foreign listings) so
// the caller can fall back to the line view. Cached like quotes.
export function getOhlcSeries(symbol, { interval = '1day', outputsize = 60 } = {}) {
  const td = toTwelveData(symbol)
  if (!td) return Promise.resolve([])
  const key = `td:ohlc:${td}:${interval}:${outputsize}`
  return cached(key, TTL.QUOTES, async () => {
    const json = await proxyJson({
      endpoint: 'time_series',
      symbol: td,
      interval,
      outputsize: String(outputsize),
    })
    const entry = keyBySymbol(json, [td])[td]
    if (!entry || entry.status === 'error' || !Array.isArray(entry.values)) return []
    return entry.values
      .map((v) => ({
        time: v.datetime,
        open: num(v.open),
        high: num(v.high),
        low: num(v.low),
        close: num(v.close),
      }))
      .filter((b) => b.open != null && b.high != null && b.low != null && b.close != null)
      .reverse() // Twelve Data returns newest-first
  })
}

// Batched quotes for original (Yahoo-style) symbols. Returns standard quote
// objects { symbol, price, prevClose, change, changePct, currency, series } for
// the symbols Twelve Data could serve. Symbols it can't serve are simply absent
// from the result (the caller falls back to Yahoo for those). Throws only on a
// total failure (e.g. rate-limit / bad key), so the caller can fall back wholesale.
export function getQuotes(symbols, { sparkline = false, interval, outputsize } = {}) {
  if (!symbols?.length) return Promise.resolve([])
  const pairs = symbols.map((s) => [s, toTwelveData(s)]).filter(([, td]) => td)
  if (!pairs.length) return Promise.resolve([])
  const tdSymbols = pairs.map(([, td]) => td)
  const origByTd = new Map(pairs.map(([orig, td]) => [td, orig]))

  const key = `td:${tdSymbols.join(',')}:${sparkline ? 's' : 'q'}:${interval ?? ''}:${outputsize ?? ''}`
  return cached(key, TTL.QUOTES, async () => {
    const quoteJson = await proxyJson({ endpoint: 'quote', symbol: tdSymbols.join(',') })
    const quoteMap = keyBySymbol(quoteJson, tdSymbols)

    let seriesMap = null
    if (sparkline) {
      try {
        seriesMap = await fetchSeries(tdSymbols, { interval, outputsize })
      } catch {
        seriesMap = null // sparkline is best-effort; price already obtained
      }
    }

    const out = []
    for (const td of tdSymbols) {
      const parsed = parseQuote(quoteMap[td])
      if (!parsed) continue
      const real = seriesMap?.get(td)
      if (real && real.length >= 2) parsed.series = real
      out.push({ symbol: origByTd.get(td) ?? td, ...parsed })
    }
    return out
  })
}
