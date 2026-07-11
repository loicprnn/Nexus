import { IconArrowUpRight, IconArrowDownRight } from '@tabler/icons-react'
import { formatPrice, formatPct } from '../../lib/format'

// Flat 2D view of the same world-market data — a responsive grid of cards.
// Acts as the no-WebGL fallback and the "2D" mode of the Markets page.
export default function MarketGrid({ markets, onHover }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {markets.map((m) => {
        const has = m.changePct != null && !Number.isNaN(m.changePct)
        const positive = has && m.changePct >= 0
        const Icon = positive ? IconArrowUpRight : IconArrowDownRight
        return (
          <div
            key={m.symbol}
            onMouseEnter={() => onHover?.(m)}
            onMouseLeave={() => onHover?.(null)}
            className="nexus-card flex flex-col gap-3 p-4 transition-colors hover:bg-hover"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="truncate text-[14px] font-semibold text-primary">{m.index}</span>
                  {m.etf && <span className="font-mono text-[10px] text-secondary">{m.etf}</span>}
                </div>
                <div className="truncate text-[11px] text-secondary">
                  {m.city} · {m.country}
                </div>
              </div>
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: !has ? '#555555' : positive ? '#22C55E' : '#EF4444' }}
              />
            </div>
            <div className="flex items-end justify-between">
              <span className="font-mono text-[16px] text-primary">
                {has ? formatPrice(m.price) : '—'}
              </span>
              {has ? (
                <span
                  className={`inline-flex items-center gap-0.5 text-[13px] ${
                    positive ? 'text-up' : 'text-down'
                  }`}
                >
                  <Icon size={14} stroke={1.5} />
                  {formatPct(m.changePct)}
                </span>
              ) : (
                <span className="text-[11px] text-secondary">Indisponible</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
