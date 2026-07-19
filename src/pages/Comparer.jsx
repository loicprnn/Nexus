import { useMemo, useState } from 'react'
import { IconX, IconPlus, IconSparkles, IconArrowUpRight, IconArrowDownRight } from '@tabler/icons-react'
import { motion, useReducedMotion } from 'framer-motion'
import PageContainer from '../components/ui/PageContainer'
import Sparkline from '../components/ui/Sparkline'
import { useQuotes } from '../hooks/useMarketData'
import { TRADABLE_UNIVERSE, SYMBOL_NAMES } from '../lib/api/symbols'
import { formatPrice, formatPct } from '../lib/format'
import { askClaude } from '../lib/api/claude'

// Distinct categorical hues (one per asset) — emerald first (brand), then amber,
// violet, sky — chosen to stay legible when overlaid on the comparison chart.
const SERIES_COLORS = ['#F97316', '#F59E0B', '#A855F7', '#38BDF8']
const MAX_ASSETS = 4

// Trading-day counts per range for the daily performance chart.
const RANGES = [
  { key: '1M', size: 22 },
  { key: '3M', size: 66 },
  { key: '6M', size: 132 },
  { key: '1A', size: 252 },
]

// Overlaid, rebased (% from start) performance lines with a neon glow. Each
// asset keeps its own colour; a dashed zero baseline anchors the comparison.
function PerformanceChart({ series }) {
  const reduce = useReducedMotion()
  if (!series.length) {
    return <p className="py-10 text-center text-[12px] text-secondary">Données indisponibles</p>
  }
  const W = 800
  const H = 240
  const pad = 8
  const vals = series.flatMap((s) => s.data)
  const min = Math.min(0, ...vals)
  const max = Math.max(0, ...vals)
  const span = max - min || 1
  const xOf = (i, len) => pad + (len <= 1 ? 0 : (i / (len - 1)) * (W - 2 * pad))
  const yOf = (v) => pad + (1 - (v - min) / span) * (H - 2 * pad)
  const zeroY = yOf(0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: H }}>
      <line
        x1={pad}
        x2={W - pad}
        y1={zeroY}
        y2={zeroY}
        stroke="#2A2A2A"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      {series.map((s) => {
        const pts = s.data.map((v, i) => `${xOf(i, s.data.length).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')
        return (
          <motion.polyline
            key={s.sym}
            points={pts}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
          />
        )
      })}
    </svg>
  )
}

// Standard deviation of period-over-period returns of the intraday series,
// expressed in %. A simple, transparent volatility proxy for the session.
function sessionVolatility(series) {
  if (!series || series.length < 3) return null
  const returns = []
  for (let i = 1; i < series.length; i++) {
    if (series[i - 1]) returns.push((series[i] - series[i - 1]) / series[i - 1])
  }
  if (!returns.length) return null
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length
  return Math.sqrt(variance) * 100
}

function sessionPerf(series) {
  if (!series || series.length < 2 || !series[0]) return null
  return ((series[series.length - 1] - series[0]) / series[0]) * 100
}

const ANALYSIS_SYSTEM = [
  "Tu es l'analyste de Nexus, une application d'analyse financière.",
  'Compare les actifs fournis en français, de façon factuelle, pédagogique et structurée.',
  "Mets en perspective performance, variation du jour et volatilité, et explique ce que",
  'ces écarts impliquent en termes de risque/rendement. Reste éducatif et général :',
  "tu ne donnes JAMAIS de conseil d'achat/vente ni de recommandation personnalisée.",
  "Appuie-toi UNIQUEMENT sur les chiffres fournis ; n'invente aucune donnée.",
  'Longueur : 3 à 5 phrases. Pas de titre, pas de liste, pas de Markdown, pas d\'emoji.',
].join(' ')

export default function Comparer() {
  const [symbols, setSymbols] = useState(['AAPL', 'MSFT'])
  const [analysis, setAnalysis] = useState({ text: '', loading: false, error: null })

  const [range, setRange] = useState('1M')

  const { data: quotes, loading } = useQuotes(symbols, { sparkline: true })
  const bySymbol = useMemo(
    () => Object.fromEntries((quotes ?? []).map((q) => [q.symbol, q])),
    [quotes],
  )

  // Daily series for the selected range → rebased performance lines.
  const rangeSize = RANGES.find((r) => r.key === range)?.size ?? 22
  const { data: histQuotes, loading: histLoading } = useQuotes(symbols, {
    sparkline: true,
    interval: '1day',
    outputsize: rangeSize,
  })
  const perfSeries = useMemo(() => {
    const hist = Object.fromEntries((histQuotes ?? []).map((q) => [q.symbol, q.series]))
    return symbols
      .map((sym, i) => {
        const s = hist[sym]
        if (!s || s.length < 2 || !s[0]) return null
        const base = s[0]
        return {
          sym,
          color: SERIES_COLORS[i % SERIES_COLORS.length],
          data: s.map((v) => (v / base - 1) * 100),
        }
      })
      .filter(Boolean)
  }, [histQuotes, symbols])

  const available = TRADABLE_UNIVERSE.filter((t) => !symbols.includes(t.symbol))

  const addSymbol = (sym) => {
    if (sym && symbols.length < MAX_ASSETS && !symbols.includes(sym)) {
      setSymbols([...symbols, sym])
      setAnalysis({ text: '', loading: false, error: null })
    }
  }
  const removeSymbol = (sym) => {
    if (symbols.length > 2) {
      setSymbols(symbols.filter((s) => s !== sym))
      setAnalysis({ text: '', loading: false, error: null })
    }
  }

  const rows = symbols.map((sym, i) => {
    const q = bySymbol[sym]
    const vol = q ? sessionVolatility(q.series) : null
    const perf = q ? sessionPerf(q.series) : null
    return { sym, name: SYMBOL_NAMES[sym] ?? sym, color: SERIES_COLORS[i % SERIES_COLORS.length], q, vol, perf }
  })

  const runAnalysis = async () => {
    const ready = rows.filter((r) => r.q)
    if (ready.length < 2) return
    setAnalysis({ text: '', loading: true, error: null })
    const lines = ready.map((r) => {
      const parts = [
        `${r.name} (${r.sym}) : cours ${formatPrice(r.q.price)} ${r.q.currency}`,
        `variation du jour ${formatPct(r.q.changePct)}`,
      ]
      if (r.perf != null) parts.push(`performance de la séance ${formatPct(r.perf)}`)
      if (r.vol != null) parts.push(`volatilité intraséance ${r.vol.toFixed(2)}%`)
      return `- ${parts.join(', ')}.`
    })
    const content = `Compare ces actifs à partir des données du jour :\n${lines.join('\n')}\n\nRédige l'analyse comparative.`
    try {
      const text = await askClaude({
        system: ANALYSIS_SYSTEM,
        messages: [{ role: 'user', content }],
        maxTokens: 500,
      })
      setAnalysis({ text, loading: false, error: null })
    } catch (error) {
      setAnalysis({ text: '', loading: false, error: error?.message || 'Erreur' })
    }
  }

  return (
    <PageContainer
      title="Comparer"
      description="Confrontez 2 à 4 actifs : cours, variation, performance de séance et volatilité — avec une analyse comparative générée par Nexus."
    >
      {/* Selection */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {rows.map((r) => (
          <span
            key={r.sym}
            className="inline-flex items-center gap-2 rounded-full border-hairline border-border bg-card px-3 py-1.5 text-[13px]"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
            <span className="font-medium text-primary">{r.sym}</span>
            <span className="text-secondary">{r.name}</span>
            {symbols.length > 2 && (
              <button
                type="button"
                onClick={() => removeSymbol(r.sym)}
                className="text-secondary transition-colors hover:text-down"
                aria-label={`Retirer ${r.sym}`}
              >
                <IconX size={14} stroke={1.5} />
              </button>
            )}
          </span>
        ))}

        {symbols.length < MAX_ASSETS && available.length > 0 && (
          <label className="inline-flex items-center gap-1.5 rounded-full border-hairline border-border bg-card px-3 py-1.5 text-[13px] text-secondary">
            <IconPlus size={14} stroke={1.5} />
            <select
              value=""
              onChange={(e) => addSymbol(e.target.value)}
              className="cursor-pointer bg-transparent text-[13px] text-primary outline-none"
            >
              <option value="" disabled>
                Ajouter un actif
              </option>
              {available.map((t) => (
                <option key={t.symbol} value={t.symbol} className="bg-card">
                  {t.symbol} — {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto nexus-card">
        <table className="w-full min-w-[680px] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-secondary">
              <th className="px-4 py-3 font-normal">Actif</th>
              <th className="px-4 py-3 text-right font-normal">Cours</th>
              <th className="px-4 py-3 text-right font-normal">Var. jour</th>
              <th className="px-4 py-3 text-right font-normal">Perf. séance</th>
              <th className="px-4 py-3 text-right font-normal">Volatilité</th>
              <th className="px-4 py-3 text-right font-normal">Séance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sym} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                    <div className="min-w-0">
                      <p className="font-medium text-primary">{r.sym}</p>
                      <p className="truncate text-[11px] text-secondary">{r.name}</p>
                    </div>
                  </div>
                </td>
                {!r.q ? (
                  <td colSpan={5} className="px-4 py-3 text-right text-secondary">
                    {loading ? 'Chargement…' : 'Indisponible'}
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3 text-right font-mono">{formatPrice(r.q.price)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${r.q.changePct >= 0 ? 'text-up' : 'text-down'}`}>
                      <span className="inline-flex items-center justify-end gap-0.5">
                        {r.q.changePct >= 0 ? <IconArrowUpRight size={13} stroke={1.5} /> : <IconArrowDownRight size={13} stroke={1.5} />}
                        {formatPct(r.q.changePct)}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${r.perf == null ? 'text-secondary' : r.perf >= 0 ? 'text-up' : 'text-down'}`}>
                      {r.perf == null ? '—' : formatPct(r.perf)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-secondary">
                      {r.vol == null ? '—' : `${r.vol.toFixed(2)}%`}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Sparkline data={r.q.series} color={r.color} width={120} height={36} />
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Comparative performance chart */}
      <div className="mt-4 nexus-card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-primary">Performance comparée (rebasée à 0)</span>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                className={[
                  'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
                  range === r.key
                    ? 'bg-accent text-white'
                    : 'text-secondary hover:bg-hover hover:text-primary',
                ].join(' ')}
              >
                {r.key}
              </button>
            ))}
          </div>
        </div>

        {histLoading && perfSeries.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-secondary">Chargement de l'historique…</p>
        ) : (
          <PerformanceChart series={perfSeries} />
        )}

        {perfSeries.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {perfSeries.map((s) => {
              const last = s.data[s.data.length - 1]
              return (
                <span key={s.sym} className="inline-flex items-center gap-1.5 text-[12px]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="font-medium text-primary">{s.sym}</span>
                  <span className={last >= 0 ? 'text-up' : 'text-down'}>
                    {last >= 0 ? '+' : ''}
                    {last.toFixed(2)}%
                  </span>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Claude analysis */}
      <div className="mt-4 nexus-card p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary">
            <IconSparkles size={15} stroke={1.5} className="text-accent" />
            Analyse comparative Nexus
          </span>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={analysis.loading || rows.filter((r) => r.q).length < 2}
            className="rounded-full bg-accent px-3.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {analysis.loading ? 'Analyse…' : 'Générer l\'analyse'}
          </button>
        </div>

        {analysis.error ? (
          <p className="mt-3 text-[13px] text-down">Erreur : {analysis.error}</p>
        ) : analysis.text ? (
          <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-primary">{analysis.text}</p>
        ) : (
          <p className="mt-3 text-[13px] leading-relaxed text-secondary">
            Cliquez pour obtenir une lecture comparative en langage naturel des actifs sélectionnés,
            fondée sur les chiffres ci-dessus. Information éducative, sans conseil personnalisé.
          </p>
        )}
      </div>
    </PageContainer>
  )
}
