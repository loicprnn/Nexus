import { Suspense, lazy, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { IconBell, IconSearch, IconArrowUpRight, IconArrowDownRight } from '@tabler/icons-react'
import Sparkline from '../components/ui/Sparkline'
import Gauge from '../components/ui/Gauge'
import CountUp from '../components/ui/CountUp'
import { containerVariants, itemVariants } from '../components/ui/Reveal'
import { useAuth } from '../contexts/AuthContext'
import {
  useQuotes,
  useFearGreed,
  useIndicator,
  useDailyBrief,
  useChunkedQuotes,
} from '../hooks/useMarketData'
import { computeNexusScore } from '../lib/nexusScore'
import {
  FAVORIS_SYMBOLS,
  MOVERS_UNIVERSE,
  TRADABLE_UNIVERSE,
  WORLD_MARKETS,
} from '../lib/api/symbols'
import { formatPrice, formatPct } from '../lib/format'

// Globe pulls in three.js — lazy-load so it stays out of the initial bundle.
const MarketGlobe = lazy(() => import('../components/markets/MarketGlobe'))
const WORLD_SYMBOLS = WORLD_MARKETS.map((m) => m.symbol)

// --- Light theme palette -----------------------------------------------------
const ORANGE = '#F97316' // accent principal, jauge, chiffres clés
const EMERALD = ORANGE // (alias conservé pour les usages existants)
const BRIGHT = '#22C55E' // hausses / positif
const DOWN = '#EF4444' // baisses
const LIGHT = '#AAAAAA' // labels
const BORDER = '#E8E8E0' // bordures claires

// Card wrapper: white bg, subtle border + soft shadow, optional 2px orange top
// bar on important cards, and the staggered fade-in entrance.
function Card({ bg = '#FFFFFF', topBar = false, className = '', children }) {
  return (
    <motion.div
      variants={itemVariants}
      className={`relative flex flex-col overflow-hidden rounded-card ${className}`}
      style={{
        backgroundColor: bg,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06), 0 0 1px rgba(0, 0, 0, 0.04)',
      }}
    >
      {topBar && <div className="absolute inset-x-0 top-0 z-10 h-[2px]" style={{ backgroundColor: ORANGE }} />}
      <div className="relative flex flex-1 flex-col">{children}</div>
    </motion.div>
  )
}

// The only two text sizes on a card: 11px uppercase label + 52px bold number.
// The number is the first thing the eye lands on, so it dominates the card.
function Label({ children }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: LIGHT }}>
      {children}
    </p>
  )
}
function Num({ value, format, color = ORANGE }) {
  return (
    <p className="mt-2 text-[52px] font-bold leading-none tracking-tight" style={{ color }}>
      {value == null ? '—' : <CountUp value={value} format={format} duration={1} />}
    </p>
  )
}
function Delta({ change, suffix = '%' }) {
  if (change == null) return null
  const up = change >= 0
  return (
    <span
      className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-medium"
      style={{ color: up ? BRIGHT : DOWN }}
    >
      {up ? <IconArrowUpRight size={12} stroke={2.5} /> : <IconArrowDownRight size={12} stroke={2.5} />}
      {up ? '+' : ''}{change.toFixed(2)}{suffix}
    </span>
  )
}

// Compact single-metric card: label, number, delta, full-bleed sparkline.
function Metric({ bg, label, value, format, color, change, changeSuffix, series, sparkColor = EMERALD }) {
  return (
    <Card bg={bg} className="min-h-[200px]">
      <div className="px-6 pb-1 pt-6">
        <Label>{label}</Label>
        <Num value={value} format={format} color={color} />
        <Delta change={change} suffix={changeSuffix} />
      </div>
      {/* Chart occupies the lower part of the card, inset from the edges so the
          line stays cleanly inside the card (respect the 24px padding). */}
      <div className="min-h-0 flex-1 px-6 pb-6 pt-2">
        {series?.length > 1 && <Sparkline data={series} color={sparkColor} fill />}
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const { user } = useAuth()

  const fg = useFearGreed()
  const vix = useIndicator('VIXCLS')
  const curve = useIndicator('T10Y2Y')
  const cpi = useIndicator('CPIAUCSL', { yoy: true })
  const favQuotes = useQuotes(useMemo(() => FAVORIS_SYMBOLS.map((f) => f.symbol), []), {
    sparkline: true,
    interval: '1day',
    outputsize: 7,
  })
  const movers = useQuotes(MOVERS_UNIVERSE, { sparkline: true, interval: '1day', outputsize: 7 })
  const [briefOpen, setBriefOpen] = useState(false)

  // World markets for the interactive globe widget (throttled chunks — free tier).
  const worldQuotes = useChunkedQuotes(WORLD_SYMBOLS, { chunkSize: 6 })
  const [hoveredMarket, setHoveredMarket] = useState(null)
  const worldMarkets = useMemo(() => {
    const bySym = Object.fromEntries((worldQuotes.data ?? []).map((q) => [q.symbol, q]))
    return WORLD_MARKETS.map((m) => {
      const q = bySym[m.symbol]
      return { ...m, price: q?.price ?? null, changePct: q?.changePct ?? null }
    })
  }, [worldQuotes.data])

  const vixQuote = vix.data?.value != null ? { price: vix.data.value } : null
  const briefReady = fg.data?.score != null || vixQuote?.price != null || curve.data?.value != null
  const brief = useDailyBrief({ fearGreed: fg.data, vix: vixQuote, curve: curve.data, ready: briefReady })

  const { score } = computeNexusScore({
    vix: vix.data?.value,
    fearGreed: fg.data?.score,
    yieldCurve: curve.data?.value,
    cpi: cpi.data?.value,
    putCall: fg.data?.putCall,
  })

  const fgScore = fg.data?.score ?? null
  const fgFear = fgScore != null && fgScore < 45
  const fgSeries = (fg.data?.history ?? []).map((h) => h.value)

  const favBySym = useMemo(
    () => Object.fromEntries((favQuotes.data ?? []).map((q) => [q.symbol, q])),
    [favQuotes.data],
  )
  const topMovers = useMemo(
    () =>
      [...(movers.data ?? [])]
        .filter((q) => q.changePct != null)
        .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
        .slice(0, 4),
    [movers.data],
  )

  // User header
  const meta = user?.user_metadata ?? {}
  const displayName = meta.full_name || meta.name || (user?.email ? user.email.split('@')[0] : 'Invité')
  const firstName = displayName.split(/[ .@]/)[0]
  const initials =
    (displayName.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() ||
    (user?.email?.[0] || 'U').toUpperCase()
  const avatarUrl = meta.avatar_url || meta.picture || null

  // Quick search
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return TRADABLE_UNIVERSE.filter(
      (t) => t.symbol.toLowerCase().includes(s) || t.name.toLowerCase().includes(s),
    ).slice(0, 6)
  }, [q])
  const goAsset = (sym) => {
    setQ('')
    navigate(`/analyse?symbol=${sym}`)
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-4 sm:px-6">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between gap-4">
        <h1 className="shrink-0 text-[20px] font-bold leading-tight">
          Bonjour, <span style={{ color: EMERALD }}>{firstName}</span>
        </h1>

        <div className="relative mx-4 w-full max-w-sm">
          <div
            className="flex items-center gap-2 rounded-full px-4 py-2"
            style={{ backgroundColor: '#FFFFFF', border: `0.5px solid ${BORDER}` }}
          >
            <IconSearch size={15} stroke={1.5} className="shrink-0" style={{ color: LIGHT, opacity: 0.6 }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && results[0] && goAsset(results[0].symbol)}
              placeholder="Rechercher un actif…"
              className="w-full bg-transparent text-[13px] text-primary placeholder:text-secondary focus:outline-none"
            />
          </div>
          {results.length > 0 && (
            <div
              className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-card py-1"
              style={{ backgroundColor: '#FFFFFF', border: `0.5px solid ${BORDER}` }}
            >
              {results.map((t) => (
                <button
                  key={t.symbol}
                  onClick={() => goAsset(t.symbol)}
                  className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-hover"
                >
                  <span className="text-[13px] font-medium text-primary">{t.symbol}</span>
                  <span className="truncate pl-3 text-[12px] text-secondary">{t.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <button
            onClick={() => navigate('/alertes')}
            className="relative rounded-full p-2 text-secondary transition-colors hover:text-primary"
            style={{ backgroundColor: '#FFFFFF', border: `0.5px solid ${BORDER}` }}
            aria-label="Notifications"
          >
            <IconBell size={16} stroke={1.5} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: EMERALD }} />
          </button>
          {/* User block — avatar + name over role (Finexy style) */}
          <div className="flex items-center gap-2.5 pl-1">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                style={{ backgroundColor: EMERALD }}
              >
                {initials}
              </span>
            )}
            <div className="hidden leading-tight sm:block">
              <p className="text-[15px] font-bold text-primary">{firstName}</p>
              <p className="text-[12px]" style={{ color: LIGHT }}>Tableau de bord</p>
            </div>
          </div>
        </div>
      </header>

      {/* Strict 2-column grid, gap 12px */}
      <motion.div
        className="grid grid-cols-2 gap-3"
        variants={containerVariants}
        initial={reduce ? false : 'hidden'}
        animate="show"
      >
        {/* Brief — full width, AI dark green + emerald top bar */}
        <Card bg="#FFFFFF" topBar className="col-span-2">
          <div className="p-6">
            <Label>Brief du jour — Claude</Label>
            {(() => {
              const text =
                brief.loading || !briefReady
                  ? 'Génération du brief…'
                  : brief.data || 'Brief momentanément indisponible.'
              const isLong = Boolean(brief.data) && brief.data.length > 150
              return (
                <>
                  <p
                    className="mt-1.5 overflow-hidden text-[13px] leading-relaxed text-primary"
                    style={briefOpen ? undefined : { maxHeight: '2.7rem' }}
                  >
                    {text}
                  </p>
                  {isLong && (
                    <button
                      onClick={() => setBriefOpen((v) => !v)}
                      className="mt-1.5 text-[12px] font-semibold"
                      style={{ color: EMERALD }}
                    >
                      {briefOpen ? 'Réduire' : 'Lire la suite'}
                    </button>
                  )}
                </>
              )
            })()}
          </div>
        </Card>

        {/* Interactive 3D globe — full width, dedicated row */}
        <Card bg="#FFFFFF" className="col-span-2">
          <div className="flex items-center justify-between gap-3 px-6 pt-6">
            <Label>Marchés mondiaux</Label>
            <div className="text-[11px]">
              {hoveredMarket ? (
                <span>
                  <span className="font-semibold text-primary">{hoveredMarket.index}</span>
                  <span className="text-secondary"> · {hoveredMarket.city}</span>
                  {hoveredMarket.changePct != null && (
                    <span className={hoveredMarket.changePct >= 0 ? 'text-up' : 'text-down'}>
                      {'  '}
                      {formatPct(hoveredMarket.changePct)}
                    </span>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-3 text-secondary">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-up" />
                    Hausse
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-down" />
                    Baisse
                  </span>
                </span>
              )}
            </div>
          </div>
          <div className="relative h-[300px] w-full">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-[12px] text-secondary">
                  Chargement du globe…
                </div>
              }
            >
              <MarketGlobe markets={worldMarkets} onHover={setHoveredMarket} />
            </Suspense>
          </div>
        </Card>

        {/* Nexus Score — gauge only, score centered inside */}
        <Card bg="#FFFFFF">
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6">
            <Label>Nexus Score</Label>
            <Gauge value={score ?? 0} max={100} color={EMERALD} size={150} />
          </div>
        </Card>

        {/* Fear & Greed */}
        <Metric
          bg="#FFFFFF"
          label="Fear & Greed"
          value={fgScore}
          format={(v) => Math.round(v).toString()}
          color={fgFear ? DOWN : ORANGE}
          series={fgSeries}
          sparkColor={fgFear ? DOWN : ORANGE}
        />

        {/* VIX */}
        <Metric
          bg="#FFFFFF"
          label="VIX — Volatilité"
          value={vix.data?.value}
          format={(v) => v.toFixed(2)}
          change={vix.data?.prev ? (vix.data.change / vix.data.prev) * 100 : null}
          series={vix.data?.series}
          sparkColor={ORANGE}
        />

        {/* Yield curve */}
        <Metric
          bg="#FFFFFF"
          label="Courbe 10A-2A"
          value={curve.data?.value}
          format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`}
          color={curve.data?.value == null ? ORANGE : curve.data.value >= 0 ? BRIGHT : DOWN}
          change={curve.data?.change}
          changeSuffix=" pp"
          series={curve.data?.series}
          sparkColor={EMERALD}
        />

        {/* Favoris */}
        <Card bg="#FFFFFF">
          <div className="flex flex-1 flex-col p-6">
            <Label>Mes favoris</Label>
            <div className="mt-1 flex flex-1 flex-col justify-center divide-y" style={{ borderColor: `${BORDER}55` }}>
              {FAVORIS_SYMBOLS.slice(0, 4).map((f) => {
                const qd = favBySym[f.symbol]
                if (!qd) {
                  return (
                    <div key={f.symbol} className="flex items-center gap-2 py-1.5">
                      <span className="text-[13px] font-semibold text-primary">{f.symbol}</span>
                      <span className="flex-1 text-center font-mono text-[13px] text-secondary">—</span>
                    </div>
                  )
                }
                const up = qd.changePct >= 0
                return (
                  <div key={f.symbol} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-[13px] font-semibold text-primary">{f.symbol}</span>
                    <div className="h-6 w-16 shrink-0">
                      {qd.series?.length > 1 && (
                        <Sparkline data={qd.series} color={up ? BRIGHT : DOWN} width={64} height={24} />
                      )}
                    </div>
                    <span
                      className="w-16 shrink-0 text-right font-mono text-[12px]"
                      style={{ color: up ? BRIGHT : DOWN }}
                    >
                      {formatPct(qd.changePct)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        {/* Top movers */}
        <Card bg="#FFFFFF">
          <div className="flex flex-1 flex-col p-6">
            <Label>Top movers</Label>
            <div className="mt-1 flex flex-1 flex-col justify-center divide-y" style={{ borderColor: `${BORDER}55` }}>
              {topMovers.length === 0 ? (
                <p className="py-2 text-[12px] text-secondary">
                  {movers.loading ? 'Chargement…' : 'Indisponible'}
                </p>
              ) : (
                topMovers.map((m) => {
                  const up = m.changePct >= 0
                  return (
                    <div key={m.symbol} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="text-[13px] font-semibold text-primary">{m.symbol}</span>
                      <div className="h-6 w-16 shrink-0">
                        {m.series?.length > 1 && (
                          <Sparkline data={m.series} color={up ? BRIGHT : DOWN} width={64} height={24} />
                        )}
                      </div>
                      <span
                        className="w-16 shrink-0 text-right font-mono text-[12px]"
                        style={{ color: up ? BRIGHT : DOWN }}
                      >
                        {formatPct(m.changePct)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
