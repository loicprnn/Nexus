import { useMemo, useState } from 'react'
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatPrice } from '../../lib/format'

const UP = '#22C55E' // chandelier haussier (close ≥ open)
const DOWN = '#EF4444' // chandelier baissier (close < open)
const ORANGE = '#F97316' // ligne / accent actif

// Custom candlestick shape. We feed the Bar a floating value [low, high], so
// Recharts hands us the pixel box spanning low→high (y = high, y+height = low).
// Open/close are then placed proportionally inside that box — no dependency on
// internal axis scales, which is the robust way to draw candles in Recharts.
function Candle({ x, y, width, height, payload }) {
  const { open, high, low, close } = payload
  const color = close >= open ? UP : DOWN
  const range = high - low || 1
  const perPx = height / range
  const cx = x + width / 2
  const yOpen = y + (high - open) * perPx
  const yClose = y + (high - close) * perPx
  const bodyTop = Math.min(yOpen, yClose)
  const bodyH = Math.max(1, Math.abs(yClose - yOpen))
  const bw = Math.max(1, Math.min(width * 0.7, 14))
  return (
    <g>
      <line x1={cx} x2={cx} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={cx - bw / 2} y={bodyTop} width={bw} height={bodyH} fill={color} rx={1} />
    </g>
  )
}

function ChartTooltip({ active, payload, mode }) {
  if (!active || !payload?.length) return null
  const c = payload[0].payload
  return (
    <div
      className="rounded-[8px] bg-card px-3 py-2 text-[11px]"
      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
    >
      <div className="mb-1 text-secondary">{c.label}</div>
      {mode === 'candle' ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-primary">
          <span className="text-secondary">O</span>
          <span className="text-right">{formatPrice(c.open)}</span>
          <span className="text-secondary">H</span>
          <span className="text-right">{formatPrice(c.high)}</span>
          <span className="text-secondary">B</span>
          <span className="text-right">{formatPrice(c.low)}</span>
          <span className="text-secondary">C</span>
          <span className="text-right">{formatPrice(c.close)}</span>
        </div>
      ) : (
        <div className="font-mono text-primary">{formatPrice(c.close)}</div>
      )}
    </div>
  )
}

// Discrete pill toggle between a line (area + gradient fill) and Japanese
// candlesticks. `data` is an OHLC array (oldest-first) already indexed with `i`.
export default function PriceChart({ data }) {
  const [mode, setMode] = useState('line')

  // Floating [low, high] range fed to the candle Bar.
  const chartData = useMemo(() => data.map((d) => ({ ...d, range: [d.low, d.high] })), [data])

  const min = Math.min(...data.map((d) => d.low))
  const max = Math.max(...data.map((d) => d.high))
  const pad = (max - min) * 0.08 || 1
  const domain = [min - pad, max + pad]

  const pill = (value, label) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
        mode === value ? 'text-white' : 'text-secondary hover:text-primary'
      }`}
      style={mode === value ? { backgroundColor: ORANGE } : undefined}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <div className="inline-flex rounded-full bg-hover p-0.5">
          {pill('line', 'Ligne')}
          {pill('candle', 'Chandeliers')}
        </div>
      </div>

      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="analyse-line-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ORANGE} stopOpacity={0.22} />
                <stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="i"
              tickFormatter={(i) => data[i]?.label ?? ''}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#AAAAAA', fontSize: 10 }}
              minTickGap={40}
            />
            <YAxis
              domain={domain}
              orientation="right"
              width={52}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#AAAAAA', fontSize: 10 }}
              tickFormatter={(v) => formatPrice(v)}
            />
            <Tooltip
              cursor={{ stroke: '#D0D0CC', strokeWidth: 1 }}
              content={<ChartTooltip mode={mode} />}
            />
            {mode === 'line' ? (
              <Area
                type="monotone"
                dataKey="close"
                stroke={ORANGE}
                strokeWidth={2}
                fill="url(#analyse-line-fill)"
                isAnimationActive={false}
                dot={false}
              />
            ) : (
              <Bar dataKey="range" shape={<Candle />} isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
