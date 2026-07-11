import * as twelveData from './twelvedata'
import * as yahoo from './yahoo'

// Unified live-quote source. Twelve Data is the PRIMARY provider (keyed, served
// through the secure /api/twelvedata proxy). Yahoo Finance is kept ONLY as a
// fallback: it covers symbols Twelve Data can't serve on this plan (indices,
// futures, foreign listings) and steps in if Twelve Data fails entirely.
//
// Fallback is per-symbol: whatever Twelve Data returns is used as-is, and only
// the remaining symbols are requested from Yahoo. Input order is preserved.
export async function getQuotes(symbols, opts = {}) {
  if (!symbols?.length) return []

  let primary = []
  try {
    primary = await twelveData.getQuotes(symbols, opts)
  } catch {
    primary = [] // total Twelve Data failure -> everything falls back to Yahoo
  }

  const have = new Set(primary.map((q) => q.symbol))
  const missing = symbols.filter((s) => !have.has(s))

  let fallback = []
  if (missing.length) {
    try {
      fallback = await yahoo.getQuotes(missing, opts)
    } catch {
      fallback = [] // both sources down for these symbols
    }
  }

  const bySymbol = new Map([...primary, ...fallback].map((q) => [q.symbol, q]))
  return symbols.map((s) => bySymbol.get(s)).filter(Boolean)
}

export async function getQuote(symbol, opts) {
  const [quote] = await getQuotes([symbol], opts)
  return quote ?? null
}
