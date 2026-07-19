// Scrolling ticker band fixed at the very top of the app.
// Continuous right-to-left CSS scroll that NEVER pauses. JetBrains Mono,
// green up / red down. Live quotes come from Twelve Data (US stocks + ETFs,
// the only symbols the free plan serves), fetched in throttled chunks to stay
// inside the 8 credits/min budget and cached 15 min.
//
// The full symbol catalog is ALWAYS rendered (prices fill in as each chunk
// lands), so the strip keeps a constant width and the scroll animation never
// restarts mid-loop.

import { useQuotes } from '../../hooks/useMarketData'
import { TICKER_SYMBOLS } from '../../lib/api/symbols'
import { formatPrice } from '../../lib/format'

const SYMBOLS = TICKER_SYMBOLS.map((s) => s.symbol)

function TickerItem({ label, price, change }) {
  const hasData = price != null && change != null
  const positive = (change ?? 0) >= 0
  return (
    <span className="inline-flex items-center gap-2 px-5">
      <span className="text-secondary">{label}</span>
      {hasData ? (
        <>
          <span className="text-primary">{formatPrice(price)}</span>
          <span className={positive ? 'text-up' : 'text-down'}>
            {positive ? '+' : ''}
            {change.toFixed(2)}%
          </span>
        </>
      ) : (
        <span className="text-secondary/50">—</span>
      )}
    </span>
  )
}

export default function TickerBand() {
  // One Twelve Data batch (≤8 credits) — Twelve Data is the reliable primary;
  // Yahoo (the orchestrator's fallback) frequently 429s from server IPs. The
  // catalog is kept small so the whole strip fits one call inside the free-tier
  // 8-credits/min budget and never starves the dashboard widgets.
  const { data } = useQuotes(SYMBOLS)

  // Map live quotes by symbol, then render the FULL catalog in order so the
  // strip width is stable from the first frame (placeholders until data lands).
  const bySymbol = Object.fromEntries((data ?? []).map((q) => [q.symbol, q]))
  const quotes = TICKER_SYMBOLS.map(({ symbol, label }) => {
    const q = bySymbol[symbol]
    return {
      symbol,
      label,
      price: q?.price ?? null,
      change: q?.changePct ?? null,
    }
  })

  // Duplicate the list so the -50% translate loops seamlessly.
  const items = [...quotes, ...quotes]

  return (
    <div className="h-9 shrink-0 overflow-hidden border-b border-border bg-ticker">
      <div className="flex h-full items-center whitespace-nowrap font-mono text-[12px] animate-ticker">
        {items.map((item, i) => (
          <TickerItem key={`${item.symbol}-${i}`} {...item} />
        ))}
      </div>
    </div>
  )
}
