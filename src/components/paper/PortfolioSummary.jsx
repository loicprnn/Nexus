import { formatMoney, formatPct } from '../../lib/format'
import { BASE_CURRENCY } from '../../lib/paperTrading'
import CountUp from '../ui/CountUp'

// Top metrics strip: total equity, P&L, available cash, and performance vs the
// S&P 500. Colour follows sign (up green / down red). Headline figures count up
// on load (and animate to the new value as the portfolio updates).
function Metric({ label, count, format, value, sub, tone = 'neutral' }) {
  const toneClass =
    tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-primary'
  return (
    <div className="nexus-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-secondary">{label}</div>
      <div className={`mt-1 font-mono text-[20px] leading-tight ${toneClass}`}>
        {count != null ? <CountUp value={count} format={format} /> : value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-secondary">{sub}</div>}
    </div>
  )
}

export default function PortfolioSummary({
  equity,
  totalPnl,
  totalPnlPct,
  cash,
  benchmarkPct,
  alpha,
}) {
  const pnlTone = totalPnl > 0 ? 'up' : totalPnl < 0 ? 'down' : 'neutral'
  const alphaTone = alpha == null ? 'neutral' : alpha >= 0 ? 'up' : 'down'

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric
        label="Valeur totale"
        count={equity}
        format={(v) => `${formatMoney(v)} ${BASE_CURRENCY}`}
      />
      <Metric
        label="P&L total"
        count={totalPnl}
        format={(v) => formatMoney(v, { signed: true })}
        sub={formatPct(totalPnlPct)}
        tone={pnlTone}
      />
      <Metric
        label="Liquidités"
        count={cash}
        format={(v) => `${formatMoney(v)} ${BASE_CURRENCY}`}
      />
      <Metric
        label="vs S&P 500"
        count={alpha == null ? undefined : alpha}
        format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} pts`}
        value="—"
        sub={
          benchmarkPct == null
            ? 'Référence en cours…'
            : `Portef. ${formatPct(totalPnlPct)} · S&P ${formatPct(benchmarkPct)}`
        }
        tone={alphaTone}
      />
    </div>
  )
}
