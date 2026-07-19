import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatMoney } from '../../lib/format'
import { BASE_CURRENCY } from '../../lib/paperTrading'

const UP = '#F97316' // mois positifs — orange
const DOWN = '#EF4444' // mois négatifs — rouge

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { label, pnl } = payload[0].payload
  return (
    <div
      className="rounded-[8px] bg-card px-3 py-2 text-[12px]"
      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
    >
      <div className="capitalize text-secondary">{label}</div>
      <div className="font-mono font-semibold" style={{ color: pnl >= 0 ? UP : DOWN }}>
        {pnl >= 0 ? '+' : ''}
        {formatMoney(pnl)} {BASE_CURRENCY}
      </div>
    </div>
  )
}

// Realised P&L per month as a bar chart — orange bars for winning months, red
// for losing ones. Empty (all-zero) history shows an inline hint instead.
export default function MonthlyPerformance({ data }) {
  const hasActivity = data.some((d) => Math.abs(d.pnl) > 0.005)

  return (
    <div className="nexus-card p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold text-primary">Performance mensuelle</h2>
        <span className="text-[11px] text-secondary">P&amp;L réalisé · {BASE_CURRENCY}</span>
      </div>

      {!hasActivity ? (
        <div className="flex h-[180px] items-center justify-center text-center text-[12px] text-secondary">
          Aucune plus-value réalisée pour l’instant. Clôturez des positions pour voir vos mois
          gagnants et perdants.
        </div>
      ) : (
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#AAAAAA', fontSize: 11 }}
                className="capitalize"
              />
              <YAxis hide />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<ChartTooltip />} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {data.map((d) => (
                  <Cell key={d.key} fill={d.pnl >= 0 ? UP : DOWN} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
