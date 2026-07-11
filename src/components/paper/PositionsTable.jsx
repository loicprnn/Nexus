import { IconArrowUpRight, IconArrowDownRight, IconX } from '@tabler/icons-react'
import { formatPrice, formatPct, formatMoney } from '../../lib/format'
import { BASE_CURRENCY } from '../../lib/paperTrading'

// Open positions with live valuation and a quick-sell shortcut per row.
export default function PositionsTable({ positions, onQuickSell }) {
  if (!positions.length) {
    return (
      <div className="nexus-card flex h-full min-h-[160px] items-center justify-center p-6 text-center text-[12px] text-secondary">
        Aucune position ouverte. Passez un premier ordre pour commencer.
      </div>
    )
  }

  return (
    <div className="nexus-card overflow-hidden">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b-hairline border-border text-secondary">
            <th className="px-4 py-2.5 text-left font-medium">Instrument</th>
            <th className="px-4 py-2.5 text-right font-medium">Qté</th>
            <th className="px-4 py-2.5 text-right font-medium">PRU</th>
            <th className="px-4 py-2.5 text-right font-medium">Cours</th>
            <th className="px-4 py-2.5 text-right font-medium">Valeur</th>
            <th className="px-4 py-2.5 text-right font-medium">P&L</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const up = (p.pnl ?? 0) >= 0
            const Icon = up ? IconArrowUpRight : IconArrowDownRight
            return (
              <tr key={p.symbol} className="border-b-hairline border-border/60 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-primary">{p.symbol}</div>
                  <div className="text-[11px] text-secondary">{p.name}</div>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-primary">
                  {formatPrice(p.qty)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-secondary">
                  {formatPrice(p.avgPrice)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-primary">
                  {p.price != null ? formatPrice(p.price) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-primary">
                  {p.marketValue != null ? formatMoney(p.marketValue) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {p.pnl != null ? (
                    <div className={`flex items-center justify-end gap-0.5 font-mono ${up ? 'text-up' : 'text-down'}`}>
                      <Icon size={13} stroke={1.5} />
                      <span>{formatMoney(p.pnl, { signed: true })}</span>
                      {p.pnlPct != null && (
                        <span className="ml-1 text-[11px] opacity-80">({formatPct(p.pnlPct)})</span>
                      )}
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onQuickSell(p)}
                    title={`Vendre ${p.symbol}`}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-secondary transition-colors hover:bg-hover hover:text-down"
                  >
                    <IconX size={14} stroke={1.5} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="px-4 py-2 text-[10px] text-secondary">
        Valeurs en {BASE_CURRENCY}. PRU = prix de revient unitaire moyen.
      </div>
    </div>
  )
}
