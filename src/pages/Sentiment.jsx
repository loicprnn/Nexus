import { useMemo, useState } from 'react'
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconMinus,
  IconSparkles,
} from '@tabler/icons-react'
import { motion, useReducedMotion } from 'framer-motion'
import PageContainer from '../components/ui/PageContainer'
import Gauge from '../components/ui/Gauge'
import CountUp from '../components/ui/CountUp'
import Sparkline from '../components/ui/Sparkline'
import { useFearGreed, useIndicator, useQuotes } from '../hooks/useMarketData'
import { getSectorSentiment } from '../lib/api/claude'

// Sentiment dashboard. Headline is CNN's Fear & Greed index (0-100); the VIX
// comes from FRED (VIXCLS). Adds a 30-day Fear & Greed history, a Put/Call ratio
// widget (CNN options sub-indicator history) and a Claude-scored sector read
// built from the day's sector-ETF performance.

// Sector ETFs (US-listed → served by Twelve Data). One batch = 5 credits.
const SECTORS = [
  { key: 'tech', label: 'Technologie', symbol: 'XLK' },
  { key: 'energy', label: 'Énergie', symbol: 'XLE' },
  { key: 'finance', label: 'Finance', symbol: 'XLF' },
  { key: 'health', label: 'Santé', symbol: 'XLV' },
  { key: 'consumer', label: 'Consommation', symbol: 'XLP' },
]
const SECTOR_SYMBOLS = SECTORS.map((s) => s.symbol)

function fearGreedColor(score) {
  if (score == null) return '#10B981'
  if (score < 25) return '#EF4444'
  if (score < 45) return '#F59E0B'
  if (score < 55) return '#10B981'
  return '#22C55E'
}

// 0-100 sentiment → design-system color (shared by sector bars).
function sentimentColor(v) {
  if (v == null) return '#10B981'
  if (v >= 60) return '#22C55E'
  if (v >= 45) return '#10B981'
  if (v >= 30) return '#F59E0B'
  return '#EF4444'
}

function reading(score) {
  if (score == null) return ''
  if (score < 25)
    return "Peur extrême : les investisseurs vendent dans la panique. Historiquement, ces zones ont souvent coïncidé avec des points bas — un contre-indicateur à surveiller."
  if (score < 45)
    return 'Peur : prudence dominante sur les marchés. La couverture (puts) et la demande de cash augmentent.'
  if (score < 55)
    return 'Sentiment neutre : ni euphorie ni panique. Le marché attend des catalyseurs.'
  if (score < 75)
    return "Avidité : appétit pour le risque marqué. Les actifs risqués sont recherchés, la complaisance s'installe."
  return "Avidité extrême : euphorie généralisée. Ces phases appellent à la prudence — le risque de retournement augmente."
}

// Put/Call ratio → plain-French interpretation. >1 = puts dominants (aversion).
function putCallReading(ratio) {
  if (ratio == null) return '—'
  if (ratio >= 1) return 'Puts dominants : couverture et aversion au risque marquées.'
  if (ratio >= 0.8) return 'Légère prudence : équilibre options proche de la normale.'
  if (ratio >= 0.6) return 'Appétit pour le risque : les calls prennent le dessus.'
  return 'Avidité : forte demande de calls, complaisance possible.'
}

function Delta({ change, unit }) {
  const flat = Math.abs(change) < 0.005
  const Icon = flat ? IconMinus : change > 0 ? IconArrowUpRight : IconArrowDownRight
  const color = flat ? 'text-secondary' : change > 0 ? 'text-up' : 'text-down'
  return (
    <span className={`inline-flex items-center gap-0.5 text-[12px] ${color}`}>
      <Icon size={13} stroke={1.5} />
      {change >= 0 ? '+' : ''}
      {change.toFixed(2)}
      {unit ? ` ${unit}` : ''}
    </span>
  )
}

function MetricCard({ label, value, count, format, sub, valueColor }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border-hairline border-border bg-card p-6">
      <span className="nexus-label">{label}</span>
      <span
        className="text-[26px] font-semibold leading-none"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {count != null ? <CountUp value={count} format={format} /> : value}
      </span>
      {sub && <span className="mt-1 text-[12px] text-secondary">{sub}</span>}
    </div>
  )
}

// Responsive 0-100 area chart with a left-to-right draw-in. Fixed 0-100 scale so
// the Fear/Greed bands are comparable across the window.
function HistoryChart({ data, color }) {
  const reduce = useReducedMotion()
  if (!data || data.length < 2) {
    return <p className="py-8 text-center text-[12px] text-secondary">Historique indisponible</p>
  }
  const w = 800
  const h = 140
  const pad = 6
  const stepX = (w - pad * 2) / (data.length - 1)
  const yOf = (v) => h - pad - (v / 100) * (h - pad * 2)
  const pts = data.map((d, i) => [pad + i * stepX, yOf(d.value)])
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${pad},${h} ${line} ${w - pad},${h}`
  // Reference bands (25 = peur extrême, 55 = avidité).
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: h }}>
      <defs>
        <linearGradient id="fg-hist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[25, 50, 75].map((lvl) => (
        <line
          key={lvl}
          x1={pad}
          x2={w - pad}
          y1={yOf(lvl)}
          y2={yOf(lvl)}
          stroke="#2A2A2A"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      ))}
      <polygon points={area} fill="url(#fg-hist)" />
      <motion.polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeInOut' }}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export default function Sentiment() {
  const { data: fg, loading: fgLoading, error: fgError } = useFearGreed()
  const { data: vix } = useIndicator('VIXCLS')
  const { data: sectorQuotes } = useQuotes(SECTOR_SYMBOLS)

  const score = fg?.score ?? null
  const color = fearGreedColor(score)
  const prevClose = fg?.previousClose
  const delta = score != null && prevClose != null ? score - prevClose : null

  const bySymbol = useMemo(
    () => Object.fromEntries((sectorQuotes ?? []).map((q) => [q.symbol, q])),
    [sectorQuotes],
  )

  const [sectors, setSectors] = useState({ data: null, loading: false, error: null })

  const runSectorAnalysis = async () => {
    const payload = SECTORS.map((s) => ({
      label: s.label,
      changePct: bySymbol[s.symbol]?.changePct ?? null,
    }))
    if (!payload.some((p) => p.changePct != null)) return
    setSectors({ data: null, loading: true, error: null })
    try {
      const result = await getSectorSentiment({ sectors: payload, mood: score })
      setSectors({ data: result, loading: false, error: null })
    } catch (error) {
      setSectors({ data: null, loading: false, error: error?.message || 'Erreur' })
    }
  }

  const ratio = fg?.putCallRatio ?? null

  return (
    <PageContainer title="Sentiment">
      {/* Headline + reading */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col items-center justify-center gap-3 rounded-card border-hairline border-border bg-card p-6 lg:col-span-1">
          <span className="nexus-label">Fear &amp; Greed Index</span>
          {fgLoading ? (
            <span className="py-10 text-[13px] text-secondary">Chargement…</span>
          ) : fgError || score == null ? (
            <span className="py-10 text-[13px] text-secondary">Données indisponibles</span>
          ) : (
            <>
              <Gauge value={score} max={100} color={color} label={fg.label} size={200} />
              {delta != null && (
                <div className="flex items-center gap-2 text-[12px] text-secondary">
                  <span>Clôture préc. {prevClose}</span>
                  <Delta change={delta} unit="pts" />
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-5 lg:col-span-2">
          <div className="rounded-card border-hairline border-border bg-card p-6">
            <span className="nexus-label">Lecture du marché</span>
            <p className="mt-2 text-[14px] leading-relaxed text-primary">
              {score == null ? 'Indicateur en cours de chargement…' : reading(score)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <MetricCard
              label="Score actuel"
              count={score ?? undefined}
              value="—"
              sub={fg?.label}
              valueColor={color}
            />
            <MetricCard
              label="Put/Call (options)"
              count={fg?.putCall ?? undefined}
              value="—"
              sub="Sous-indicateur CNN, 0-100"
            />
            <MetricCard
              label="VIX (volatilité)"
              count={vix?.value ?? undefined}
              format={(v) => v.toFixed(2)}
              value="—"
              sub={vix ? `Dernière donnée : ${vix.date}` : 'FRED · VIXCLS'}
              valueColor={vix ? (vix.value > 20 ? '#F59E0B' : '#22C55E') : undefined}
            />
          </div>
        </div>
      </div>

      {/* 30-day Fear & Greed history */}
      <div className="mt-5 rounded-card border-hairline border-border bg-card p-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="nexus-label">Fear &amp; Greed — 30 jours</span>
          {score != null && (
            <span className="font-mono text-[13px]" style={{ color }}>
              {score}/100 · {fg.label}
            </span>
          )}
        </div>
        <HistoryChart data={fg?.history} color={color} />
        {fg?.history?.length > 1 && (
          <div className="mt-2 flex justify-between text-[11px] text-secondary">
            <span>{fg.history[0].date}</span>
            <span>{fg.history[fg.history.length - 1].date}</span>
          </div>
        )}
      </div>

      {/* Put/Call ratio + sector sentiment */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Put/Call */}
        <div className="rounded-card border-hairline border-border bg-card p-6">
          <span className="nexus-label">Put/Call Ratio (CBOE)</span>
          <div className="mt-2 flex items-end gap-2">
            <span className="font-mono text-[28px] font-semibold leading-none text-primary">
              {ratio == null ? '—' : <CountUp value={ratio} format={(v) => v.toFixed(2)} />}
            </span>
            <span className="pb-1 text-[12px] text-secondary">ratio puts / calls</span>
          </div>
          <div className="mt-3">
            <Sparkline
              data={fg?.putCallSeries ?? []}
              color={ratio != null && ratio >= 1 ? '#EF4444' : '#22C55E'}
              width={420}
              height={56}
            />
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-secondary">{putCallReading(ratio)}</p>
        </div>

        {/* Sector sentiment via Claude */}
        <div className="rounded-card border-hairline border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary">
              <IconSparkles size={15} stroke={1.5} className="text-accent" />
              Sentiment par secteur
            </span>
            <button
              type="button"
              onClick={runSectorAnalysis}
              disabled={sectors.loading || (sectorQuotes?.length ?? 0) === 0}
              className="rounded-full bg-accent px-3.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sectors.loading ? 'Analyse…' : 'Scorer'}
            </button>
          </div>

          {sectors.error ? (
            <p className="mt-3 text-[13px] text-down">Erreur : {sectors.error}</p>
          ) : sectors.data ? (
            <div className="mt-4 space-y-3">
              {sectors.data.map((s) => {
                const v = Math.max(0, Math.min(100, Math.round(s.score)))
                return (
                  <div key={s.secteur}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className="text-primary">{s.secteur}</span>
                      <span className="font-mono text-secondary">{v}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-border">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: sentimentColor(v) }}
                        initial={{ width: 0 }}
                        animate={{ width: `${v}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    {s.note && <p className="mt-1 text-[11px] text-secondary">{s.note}</p>}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="mt-4 space-y-1.5">
              <p className="text-[13px] leading-relaxed text-secondary">
                Score de sentiment 0-100 par secteur, généré par Nexus à partir de la performance
                du jour des ETF sectoriels (XLK, XLE, XLF, XLV, XLP) et du climat de marché.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {SECTORS.map((s) => {
                  const q = bySymbol[s.symbol]
                  return (
                    <span
                      key={s.key}
                      className="inline-flex items-center gap-1.5 rounded-full border-hairline border-border px-2.5 py-1 text-[11px]"
                    >
                      <span className="text-secondary">{s.label}</span>
                      {q && (
                        <span className={q.changePct >= 0 ? 'text-up' : 'text-down'}>
                          {q.changePct >= 0 ? '+' : ''}
                          {q.changePct.toFixed(2)}%
                        </span>
                      )}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
