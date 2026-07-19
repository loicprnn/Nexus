import { useMemo } from 'react'
import { TRADABLE_UNIVERSE } from '../../lib/api/symbols'
import { BASE_CURRENCY } from '../../lib/paperTrading'
import { formatPrice, formatPct, formatMoney } from '../../lib/format'

// Order ticket: choose side, instrument and quantity, see the live price and the
// resulting cost, then submit. All validation feedback is surfaced inline.
export default function TradeTicket({
  selected,
  onSelect,
  quote,
  side,
  onSideChange,
  qty,
  onQtyChange,
  onSubmit,
  error,
  busy,
  cash,
  heldQty,
}) {
  const price = quote?.price ?? null
  const changePct = quote?.changePct ?? null
  const numericQty = Number(qty) || 0
  const total = price != null ? numericQty * price : null

  const groups = useMemo(() => {
    const by = {}
    for (const t of TRADABLE_UNIVERSE) (by[t.kind] ??= []).push(t)
    return by
  }, [])

  const sideBtn = (value, label, activeClass) => (
    <button
      type="button"
      onClick={() => onSideChange(value)}
      className={`flex-1 rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
        side === value ? activeClass : 'text-secondary hover:text-primary'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="nexus-card flex flex-col gap-4 p-4">
      <div className="text-[13px] font-semibold text-primary">Passer un ordre</div>

      {/* Side */}
      <div className="inline-flex rounded-card border-hairline border-border bg-bg p-1">
        {sideBtn('buy', 'Acheter', 'bg-up text-white')}
        {sideBtn('sell', 'Vendre', 'bg-down text-white')}
      </div>

      {/* Instrument */}
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-secondary">Instrument</span>
        <select
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
          className="rounded-[10px] border-hairline border-border bg-bg px-3 py-2 text-[13px] text-primary outline-none focus:border-accent"
        >
          {Object.entries(groups).map(([kind, items]) => (
            <optgroup key={kind} label={kind}>
              {items.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol} · {t.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {/* Live price */}
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wide text-secondary">Cours actuel</span>
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-[15px] text-primary">
            {price != null ? formatPrice(price) : '—'}
          </span>
          {changePct != null && (
            <span className={`font-mono text-[11px] ${changePct >= 0 ? 'text-up' : 'text-down'}`}>
              {formatPct(changePct)}
            </span>
          )}
        </span>
      </div>

      {/* Quantity */}
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-secondary">Quantité</span>
        <input
          type="number"
          min="0"
          step="1"
          value={qty}
          onChange={(e) => onQtyChange(e.target.value)}
          placeholder="0"
          className="rounded-[10px] border-hairline border-border bg-bg px-3 py-2 font-mono text-[13px] text-primary outline-none focus:border-accent"
        />
      </label>

      {/* Totals / availability */}
      <div className="flex flex-col gap-1 text-[12px]">
        <div className="flex justify-between">
          <span className="text-secondary">Montant</span>
          <span className="font-mono text-primary">
            {total != null ? `${formatMoney(total)} ${BASE_CURRENCY}` : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-secondary">
            {side === 'buy' ? 'Liquidités dispo.' : 'Quantité détenue'}
          </span>
          <span className="font-mono text-primary">
            {side === 'buy' ? `${formatMoney(cash)} ${BASE_CURRENCY}` : formatPrice(heldQty ?? 0)}
          </span>
        </div>
      </div>

      {error && <div className="text-[12px] text-down">{error}</div>}

      <button
        type="button"
        onClick={onSubmit}
        disabled={busy || Boolean(error) || numericQty <= 0}
        className={`rounded-[10px] px-3 py-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          side === 'buy'
            ? 'bg-up text-white hover:opacity-90'
            : 'bg-down text-white hover:opacity-90'
        }`}
      >
        {busy ? 'Exécution…' : side === 'buy' ? 'Acheter' : 'Vendre'}
      </button>
    </div>
  )
}
