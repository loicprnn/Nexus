import { cached, TTL } from './cache'

// CoinGecko public API via proxy. `coins/markets` returns price, 24h change,
// market cap and an optional 7d sparkline in one call.
const BASE = '/api/coingecko/api/v3'

export function getCryptoMarkets(ids, { sparkline = false } = {}) {
  const idParam = ids.join(',')
  const key = `cg:${idParam}:${sparkline}`
  return cached(key, TTL.QUOTES, async () => {
    const url =
      `${BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(idParam)}` +
      `&order=market_cap_desc&sparkline=${sparkline}&price_change_percentage=24h`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`CoinGecko: HTTP ${res.status}`)
    const data = await res.json()
    return data.map((c) => ({
      id: c.id,
      symbol: (c.symbol ?? '').toUpperCase(),
      name: c.name,
      price: c.current_price,
      changePct: c.price_change_percentage_24h ?? 0,
      marketCap: c.market_cap,
      series: c.sparkline_in_7d?.price ?? [],
    }))
  })
}
