import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  IconSearch,
  IconSparkles,
  IconArrowUpRight,
  IconArrowDownRight,
  IconChartCandle,
  IconBuildingSkyscraper,
  IconMoodSmile,
  IconBuildingBank,
} from '@tabler/icons-react'
import { motion, useReducedMotion } from 'framer-motion'
import PageContainer from '../components/ui/PageContainer'
import Sparkline from '../components/ui/Sparkline'
import CountUp from '../components/ui/CountUp'
import { useQuotes, useFearGreed, useIndicator, useFundamentals } from '../hooks/useMarketData'
import { TRADABLE_UNIVERSE, SYMBOL_NAMES } from '../lib/api/symbols'
import { formatPrice, formatPct } from '../lib/format'
import { getAssetAnalysis } from '../lib/api/claude'
import {
  sessionPerf,
  sessionVolatility,
  rangePosition,
  trendGap,
  technicalSub,
  sentimentSub,
  macroSub,
  computeAssetScore,
  scoreColor,
  scoreLabel,
} from '../lib/assetScore'

// One quantitative metric line inside a dimension block.
function Metric({ label, value, tone = 'neutral' }) {
  const color =
    tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-primary'
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[12px] text-secondary">{label}</span>
      <span className={`font-mono text-[13px] ${color}`}>{value}</span>
    </div>
  )
}

// A dimension card (Technique / Fondamental / Sentiment / Macro).
function DimensionBlock({ icon: Icon, title, sub, children }) {
  return (
    <div className="rounded-card border-hairline border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary">
          <Icon size={15} stroke={1.5} className="text-accent" />
          {title}
        </span>
        {sub != null && (
          <span className="font-mono text-[12px] text-secondary">{Math.round(sub)}/100</span>
        )}
      </div>
      <div className="divide-y divide-border/50">{children}</div>
    </div>
  )
}

// Horizontal 0-100 sub-score bar used in the score breakdown. The fill grows in
// on mount; the figure counts up alongside it.
function ScoreBar({ label, value }) {
  const reduce = useReducedMotion()
  const v = value == null ? 0 : Math.round(value)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-secondary">{label}</span>
        <span className="font-mono text-primary">
          {value == null ? '—' : <CountUp value={v} duration={0.8} />}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${v}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

export default function Analyse() {
  const [searchParams] = useSearchParams()
  // Preselect the asset from a ?symbol= query (e.g. Dashboard quick search).
  const initialSymbol = (() => {
    const s = (searchParams.get('symbol') || '').toUpperCase()
    return TRADABLE_UNIVERSE.some((t) => t.symbol === s) ? s : 'AAPL'
  })()
  const [symbol, setSymbol] = useState(initialSymbol)
  const [analysis, setAnalysis] = useState({ text: '', loading: false, error: null })

  const symbols = useMemo(() => [symbol], [symbol])
  const { data: quotes, loading: quoteLoading } = useQuotes(symbols, { sparkline: true })
  const quote = quotes?.[0] ?? null

  const { data: fng } = useFearGreed()
  const { data: vix } = useIndicator('VIXCLS')
  const { data: curve } = useIndicator('T10Y2Y')
  const { data: cpi } = useIndicator('CPIAUCSL', { yoy: true })

  const { data: fundamentals, loading: fundLoading } = useFundamentals(symbol)

  const meta = TRADABLE_UNIVERSE.find((t) => t.symbol === symbol)
  const name = SYMBOL_NAMES[symbol] ?? symbol

  // P/E = live price (Twelve Data) ÷ annual diluted EPS (SEC EDGAR).
  const peValue =
    quote?.price != null && fundamentals?.eps
      ? (quote.price / fundamentals.eps).toFixed(2)
      : '—'

  // --- Quantitative dimensions ---
  const series = quote?.series
  const perf = sessionPerf(series)
  const trend = trendGap(series)
  const vol = sessionVolatility(series)
  const rangePos = rangePosition(series)

  const techScore = technicalSub(series)
  const sentiScore = sentimentSub({ fearGreed: fng?.score, vix: vix?.value })
  const macroScore = macroSub({ yieldCurve: curve?.value, cpi: cpi?.value })
  const score = computeAssetScore({
    technique: techScore,
    sentiment: sentiScore,
    macro: macroScore,
  })
  const sColor = scoreColor(score)

  const runAnalysis = async () => {
    if (!quote) return
    setAnalysis({ text: '', loading: true, error: null })
    try {
      const text = await getAssetAnalysis({
        symbol,
        name,
        price: quote.price,
        changePct: quote.changePct,
        currency: quote.currency,
        perf,
        trend,
        volatility: vol,
        rangePos,
        fearGreed: fng?.score,
        vix: vix?.value,
        yieldCurve: curve?.value,
        cpi: cpi?.value,
        score,
      })
      setAnalysis({ text, loading: false, error: null })
    } catch (error) {
      setAnalysis({ text: '', loading: false, error: error?.message || 'Erreur' })
    }
  }

  const changeUp = quote && quote.changePct >= 0

  return (
    <PageContainer
      title="Analyse"
      description="Analyse complète d'un actif en quatre axes — technique, fondamental, sentiment et macro — avec un score global /10 et une synthèse générée par Nexus."
      actions={
        <label className="inline-flex shrink-0 items-center gap-2 rounded-card border-hairline border-border bg-card px-3 py-2 text-[13px] text-secondary">
          <IconSearch size={15} stroke={1.5} />
          <select
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value)
              setAnalysis({ text: '', loading: false, error: null })
            }}
            className="cursor-pointer bg-transparent text-[13px] text-primary outline-none"
          >
            {TRADABLE_UNIVERSE.map((t) => (
              <option key={t.symbol} value={t.symbol} className="bg-card">
                {t.symbol} — {t.name}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {/* Header + score */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Identity + price */}
        <div className="rounded-card border-hairline border-border bg-card p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-semibold text-primary">{symbol}</span>
                {meta?.kind && (
                  <span className="rounded-full border-hairline border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-secondary">
                    {meta.kind}
                  </span>
                )}
              </div>
              <p className="truncate text-[13px] text-secondary">{name}</p>
            </div>
            <div className="text-right">
              {quote ? (
                <>
                  <p className="font-mono text-[22px] font-semibold text-primary">
                    <CountUp value={quote.price} format={formatPrice} />{' '}
                    <span className="text-[12px] text-secondary">{quote.currency}</span>
                  </p>
                  <p
                    className={`inline-flex items-center justify-end gap-0.5 font-mono text-[13px] ${
                      changeUp ? 'text-up' : 'text-down'
                    }`}
                  >
                    {changeUp ? (
                      <IconArrowUpRight size={14} stroke={1.5} />
                    ) : (
                      <IconArrowDownRight size={14} stroke={1.5} />
                    )}
                    {formatPct(quote.changePct)}
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-secondary">
                  {quoteLoading ? 'Chargement…' : 'Indisponible'}
                </p>
              )}
            </div>
          </div>
          {quote?.series?.length > 1 && (
            <div className="mt-4">
              <Sparkline
                data={quote.series}
                color={changeUp ? '#22C55E' : '#EF4444'}
                width={620}
                height={64}
              />
            </div>
          )}
        </div>

        {/* Global score */}
        <div className="rounded-card border-hairline border-border bg-card p-5">
          <p className="nexus-label">Score global Nexus</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-[44px] font-semibold leading-none" style={{ color: sColor }}>
              {score == null ? '—' : <CountUp value={score} format={(v) => v.toFixed(1)} duration={1.1} />}
            </span>
            <span className="pb-1 text-[14px] text-secondary">/ 10</span>
          </div>
          <p className="mt-1 text-[13px] font-medium" style={{ color: sColor }}>
            {scoreLabel(score)}
          </p>
          <div className="mt-4 space-y-2.5">
            <ScoreBar label="Technique" value={techScore} />
            <ScoreBar label="Sentiment" value={sentiScore} />
            <ScoreBar label="Macro" value={macroScore} />
          </div>
        </div>
      </div>

      {/* Four dimension blocks */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <DimensionBlock icon={IconChartCandle} title="Technique" sub={techScore}>
          <Metric
            label="Performance séance"
            value={perf == null ? '—' : formatPct(perf)}
            tone={perf == null ? 'neutral' : perf >= 0 ? 'up' : 'down'}
          />
          <Metric
            label="Tendance intraséance"
            value={trend == null ? '—' : formatPct(trend)}
            tone={trend == null ? 'neutral' : trend >= 0 ? 'up' : 'down'}
          />
          <Metric label="Volatilité" value={vol == null ? '—' : `${vol.toFixed(2)}%`} />
          <Metric
            label="Position dans le range"
            value={rangePos == null ? '—' : `${Math.round(rangePos * 100)}%`}
          />
        </DimensionBlock>

        <DimensionBlock icon={IconBuildingSkyscraper} title="Fondamental">
          {meta?.kind === 'ETF' ? (
            <p className="py-2 text-[13px] leading-relaxed text-secondary">
              Données non disponibles (ETF non couvert par SEC EDGAR).
            </p>
          ) : fundLoading ? (
            <p className="py-2 text-[12px] text-secondary">Chargement des données fondamentales…</p>
          ) : fundamentals?.kind === 'stock' && fundamentals.metrics?.length ? (
            <div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1">
                {[{ label: 'PER (P/E)', value: peValue }, ...fundamentals.metrics].map((m) => (
                  <div key={m.label}>
                    <p className="text-[11px] text-secondary">{m.label}</p>
                    <p className="mt-0.5 text-[18px] font-semibold text-primary">{m.value ?? '—'}</p>
                  </div>
                ))}
              </div>
              <p className="pt-3 text-[11px] text-secondary">
                Filings 10-K/10-Q · SEC EDGAR
                {fundamentals.fiscalYear ? ` · exercice ${fundamentals.fiscalYear}` : ''}
              </p>
            </div>
          ) : (
            <p className="py-2 text-[13px] leading-relaxed text-secondary">Données non disponibles</p>
          )}
        </DimensionBlock>

        <DimensionBlock icon={IconMoodSmile} title="Sentiment de marché" sub={sentiScore}>
          <Metric
            label="Fear & Greed"
            value={fng?.score == null ? '—' : `${fng.score}/100${fng.label ? ` · ${fng.label}` : ''}`}
          />
          <Metric label="VIX" value={vix?.value == null ? '—' : vix.value.toFixed(2)} />
          <p className="pt-3 text-[12px] leading-relaxed text-secondary">
            Climat de risque global du marché — il conditionne l'appétit pour cet actif.
          </p>
        </DimensionBlock>

        <DimensionBlock icon={IconBuildingBank} title="Macro" sub={macroScore}>
          <Metric
            label="Courbe 10a-2a"
            value={curve?.value == null ? '—' : `${curve.value >= 0 ? '+' : ''}${curve.value.toFixed(2)} pp`}
            tone={curve?.value == null ? 'neutral' : curve.value >= 0 ? 'up' : 'down'}
          />
          <Metric
            label="Inflation (CPI a/a)"
            value={cpi?.value == null ? '—' : `${cpi.value.toFixed(1)}%`}
          />
          <p className="pt-3 text-[12px] leading-relaxed text-secondary">
            Régime de taux et d'inflation — la toile de fond commune à tous les actifs.
          </p>
        </DimensionBlock>
      </div>

      {/* Claude synthesis */}
      <div className="mt-4 rounded-card border-hairline border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary">
            <IconSparkles size={15} stroke={1.5} className="text-accent" />
            Synthèse Nexus
          </span>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={analysis.loading || !quote}
            className="rounded-full bg-accent px-3.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {analysis.loading ? 'Analyse…' : "Générer l'analyse"}
          </button>
        </div>

        {analysis.error ? (
          <p className="mt-3 text-[13px] text-down">Erreur : {analysis.error}</p>
        ) : analysis.text ? (
          <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-primary">
            {analysis.text}
          </p>
        ) : (
          <p className="mt-3 text-[13px] leading-relaxed text-secondary">
            Cliquez pour obtenir une lecture structurée en quatre axes (technique, fondamental,
            sentiment, macro) fondée sur les chiffres ci-dessus, et l'explication du score global.
            Information éducative, sans conseil personnalisé.
          </p>
        )}
      </div>
    </PageContainer>
  )
}
