import { formatPrice } from '../../lib/format'

// Reverse-chronological trade journal.
function timeLabel(ts) {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function TradeHistory({ trades }) {
  if (!trades.length) {
    return (
      <div className="nexus-card p-6 text-center text-[12px] text-secondary">
        Aucune transaction pour l'instant.
      </div>
    )
  }
  const ordered = [...trades].reverse()
  return (
    <div className="nexus-card divide-y divide-border/60">
      {ordered.map((t) => {
        const buy = t.side === 'buy'
        return (
          <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <span
                className={`rounded-[6px] px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                  buy ? 'bg-up/15 text-up' : 'bg-down/15 text-down'
                }`}
              >
                {buy ? 'Achat' : 'Vente'}
              </span>
              <span className="font-medium text-primary">{t.symbol}</span>
              <span className="text-[11px] text-secondary">{t.name}</span>
            </div>
            <div className="text-right">
              <div className="font-mono text-[12px] text-primary">
                {formatPrice(t.qty)} × {formatPrice(t.price)}
              </div>
              <div className="text-[10px] text-secondary">{timeLabel(t.ts)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
