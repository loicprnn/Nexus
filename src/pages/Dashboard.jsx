import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { IconBell, IconSearch, IconArrowUpRight, IconArrowDownRight } from '@tabler/icons-react'
import Sparkline from '../components/ui/Sparkline'
import Gauge from '../components/ui/Gauge'
import CountUp from '../components/ui/CountUp'
import { containerVariants, itemVariants } from '../components/ui/Reveal'
import { useAuth } from '../contexts/AuthContext'
import { useQuotes, useFearGreed, useIndicator, useDailyBrief } from '../hooks/useMarketData'
import { computeNexusScore } from '../lib/nexusScore'
import { FAVORIS_SYMBOLS, MOVERS_UNIVERSE, TRADABLE_UNIVERSE } from '../lib/api/symbols'
import { formatPrice, formatPct } from '../lib/format'

// --- Green identity palette --------------------------------------------------
const EMERALD = '#10B981' // accent principal, jauge
const BRIGHT = '#22C55E' // hausses / positif
const DOWN = '#EF4444' // baisses
const LIGHT = '#86EFAC' // labels
const BORDER = '#065F46' // bordures subtiles

// Card wrapper: green-tinted background, subtle green border, optional 2px
// emerald top bar, and the staggered fade-in entrance.
function Card({ bg, topBar = false, className = '', children }) {
  return (
    <motion.div
      variants={itemVariants}
      className={`relative flex flex-col overflow-hidden rounded-card ${className}`}
      style={{ backgroundColor: bg, border: `0.5px solid ${BORDER}` }}
    >
      {topBar && <div className="absolute inset-x-0 top-0 z-10 h-[2px]" style={{ backgroundColor: EMERALD }} />}
      <div className="relative flex flex-1 flex-col">{children}</div>
    </motion.div>
  )
}

// The only two text sizes on a card: 11px uppercase label + 36px bold number.
function Label({ children }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: LIGHT, opacity: 0.5 }}>
      {children}
    </p>
  )
}
function Num({ value, format, color = '#FFFFFF' }) {
  return (
    <p className="mt-1.5 text-[36px] font-bold leading-none tracking-tight" style={{ color }}>
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
    <Card bg={bg}>
      <div className="p-4 pb-1">
        <Label>{label}</Label>
        <Num value={value} format={format} color={color} />
        <Delta change={change} suffix={changeSuffix} />
      </div>
      {/* Chart occupies the lower ~60% of the card */}
      <div className="min-h-0 flex-1">
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
    <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col px-4 py-4 sm:px-6">
      {/* Header */}
      <header className="mb-3 flex items-center justify-between gap-4">
        <h1 className="shrink-0 text-[20px] font-bold leading-tight">
          Bonjour, <span style={{ color: EMERALD }}>{firstName}</span>
        </h1>

        <div className="relative mx-4 w-full max-w-sm">
          <div
            className="flex items-center gap-2 rounded-full px-4 py-2"
            style={{ backgroundColor: '#0A1A0A', border: `0.5px solid ${BORDER}` }}
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
              style={{ backgroundColor: '#0A1A0A', border: `0.5px solid ${BORDER}` }}
            >
              {results.map((t) => (
                <button
                  key={t.symbol}
                  onClick={() => goAsset(t.symbol)}
                  className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-[#0D2818]"
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
            style={{ backgroundColor: '#0A1A0A', border: `0.5px solid ${BORDER}` }}
            aria-label="Notifications"
          >
            <IconBell size={16} stroke={1.5} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: EMERALD }} />
          </button>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold text-white"
              style={{ backgroundColor: EMERALD }}
            >
              {initials}
            </span>
          )}
        </div>
      </header>

      {/* Strict 2-column grid, gap 12px — fits one screen */}
      <motion.div
        className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[auto_1fr_1fr_1.2fr] gap-3"
        variants={containerVariants}
        initial={reduce ? false : 'hidden'}
        animate="show"
      >
        {/* Brief — full width, AI dark green + emerald top bar */}
        <Card bg="#0D2818" topBar className="col-span-2">
          <div className="p-4">
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

        {/* Nexus Score — gauge only, score centered inside */}
        <Card bg="#0A2010">
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
            <Label>Nexus Score</Label>
            <Gauge value={score ?? 0} max={100} color={EMERALD} size={150} />
          </div>
        </Card>

        {/* Fear & Greed */}
        <Metric
          bg="#1A1200"
          label="Fear & Greed"
          value={fgScore}
          format={(v) => Math.round(v).toString()}
          color={fgFear ? DOWN : LIGHT}
          series={fgSeries}
          sparkColor={fgFear ? DOWN : BRIGHT}
        />

        {/* VIX */}
        <Metric
          bg="#0D1F0D"
          label="VIX — Volatilité"
          value={vix.data?.value}
          format={(v) => v.toFixed(2)}
          change={vix.data?.prev ? (vix.data.change / vix.data.prev) * 100 : null}
          series={vix.data?.series}
          sparkColor={BRIGHT}
        />

        {/* Yield curve */}
        <Metric
          bg="#022C22"
          label="Courbe 10A-2A"
          value={curve.data?.value}
          format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`}
          color={curve.data?.value == null ? '#FFFFFF' : curve.data.value >= 0 ? BRIGHT : DOWN}
          change={curve.data?.change}
          changeSuffix=" pp"
          series={curve.data?.series}
          sparkColor={EMERALD}
        />

        {/* Favoris */}
        <Card bg="#0A1A0A">
          <div className="flex flex-1 flex-col p-4">
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
        <Card bg="#0A2010">
          <div className="flex flex-1 flex-col p-4">
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
