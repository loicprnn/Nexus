import { Suspense, lazy, useMemo, useState } from 'react'
import { IconWorld, IconLayoutGrid } from '@tabler/icons-react'
import PageContainer from '../components/ui/PageContainer'
import MarketGrid from '../components/markets/MarketGrid'
import { useChunkedQuotes } from '../hooks/useMarketData'
import { WORLD_MARKETS } from '../lib/api/symbols'
import { formatPct } from '../lib/format'

// The globe pulls in three.js — load it only when the 3D view is shown so it
// stays out of the initial bundle.
const MarketGlobe = lazy(() => import('../components/markets/MarketGlobe'))

const SYMBOLS = WORLD_MARKETS.map((m) => m.symbol)

function ModeToggle({ mode, onChange }) {
  const opt = (value, label, Icon) => {
    const active = mode === value
    return (
      <button
        type="button"
        onClick={() => onChange(value)}
        className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[13px] transition-colors ${
          active ? 'bg-accent text-white' : 'text-secondary hover:text-primary'
        }`}
      >
        <Icon size={15} stroke={1.5} />
        {label}
      </button>
    )
  }
  return (
    <div className="inline-flex rounded-card border-hairline border-border bg-card p-1">
      {opt('3d', '3D', IconWorld)}
      {opt('2d', '2D', IconLayoutGrid)}
    </div>
  )
}

function Legend() {
  const dot = (color, label) => (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-secondary">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
  return (
    <div className="flex flex-wrap items-center gap-4">
      {dot('#22C55E', 'En hausse')}
      {dot('#EF4444', 'En baisse')}
      {dot('#555555', 'Indisponible')}
    </div>
  )
}

export default function Markets() {
  const [mode, setMode] = useState('3d')
  const [hovered, setHovered] = useState(null)
  // 22 symbols can't be fetched at once on Twelve Data's free tier (8/min), so
  // pull them in throttled, staggered chunks; markers fill in over the first
  // couple of minutes, then stay cached.
  const { data, loading } = useChunkedQuotes(SYMBOLS, { chunkSize: 6 })

  // Merge live quotes onto the static market catalog (graceful when missing).
  const markets = useMemo(() => {
    const bySymbol = Object.fromEntries((data ?? []).map((q) => [q.symbol, q]))
    return WORLD_MARKETS.map((m) => {
      const q = bySymbol[m.symbol]
      return { ...m, price: q?.price ?? null, changePct: q?.changePct ?? null }
    })
  }, [data])

  const stats = useMemo(() => {
    const live = markets.filter((m) => m.changePct != null)
    if (!live.length) return null
    const up = live.filter((m) => m.changePct >= 0).length
    const sorted = [...live].sort((a, b) => b.changePct - a.changePct)
    return { up, down: live.length - up, best: sorted[0], worst: sorted[sorted.length - 1] }
  }, [markets])

  return (
    <PageContainer
      title="Markets"
      description="Globe 3D interactif. Performances des grandes places financières en temps réel, survolez un marqueur pour le détail."
      actions={<ModeToggle mode={mode} onChange={setMode} />}
    >
      {/* Focus / summary strip */}
      <div className="mb-3 flex min-h-[20px] flex-wrap items-center gap-x-6 gap-y-1 text-[12px]">
        {hovered ? (
          <span className="text-primary">
            <span className="font-semibold">{hovered.index}</span>
            <span className="text-secondary"> · {hovered.city}</span>
            {hovered.changePct != null && (
              <span className={hovered.changePct >= 0 ? 'text-up' : 'text-down'}>
                {'  '}
                {formatPct(hovered.changePct)}
              </span>
            )}
          </span>
        ) : stats ? (
          <>
            <span className="text-secondary">
              <span className="text-up">{stats.up} en hausse</span>
              {' · '}
              <span className="text-down">{stats.down} en baisse</span>
            </span>
            {stats.best && (
              <span className="text-secondary">
                Top&nbsp;
                <span className="text-primary">{stats.best.index}</span>{' '}
                <span className="text-up">{formatPct(stats.best.changePct)}</span>
              </span>
            )}
            {stats.worst && (
              <span className="text-secondary">
                Pire&nbsp;
                <span className="text-primary">{stats.worst.index}</span>{' '}
                <span className="text-down">{formatPct(stats.worst.changePct)}</span>
              </span>
            )}
          </>
        ) : (
          <span className="text-secondary">
            {loading ? 'Chargement des cotations…' : 'Cotations momentanément indisponibles'}
          </span>
        )}
      </div>

      {mode === '3d' ? (
        <div className="nexus-card relative h-[62vh] min-h-[420px] overflow-hidden">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-[12px] text-secondary">
                Chargement du globe…
              </div>
            }
          >
            <MarketGlobe markets={markets} onHover={setHovered} />
          </Suspense>
          <div className="pointer-events-none absolute bottom-3 left-4">
            <Legend />
          </div>
        </div>
      ) : (
        <>
          <MarketGrid markets={markets} onHover={setHovered} />
          <div className="mt-4">
            <Legend />
          </div>
        </>
      )}

      <p className="mt-3 text-[11px] text-secondary">
        Performances en direct via Twelve Data — chaque place est approximée par son ETF
        pays coté aux États-Unis (USD). Hauteur des marqueurs proportionnelle à l'amplitude
        de la variation.
      </p>
    </PageContainer>
  )
}
