import { IconArrowUpRight, IconArrowDownRight } from '@tabler/icons-react'
import Gauge from '../ui/Gauge'
import Sparkline from '../ui/Sparkline'
import CountUp from '../ui/CountUp'
import {
  useQuotes,
  useCryptos,
  useFearGreed,
  useIndicator,
  useDailyBrief,
} from '../../hooks/useMarketData'
import {
  FAVORIS_SYMBOLS,
  MOVERS_UNIVERSE,
  COMMODITIES_SYMBOLS,
  CRYPTO_COINS,
} from '../../lib/api/symbols'
import { formatPrice } from '../../lib/format'
import { computeNexusScore } from '../../lib/nexusScore'

// Live data sources: Yahoo Finance (quotes/series), CoinGecko (crypto),
// CNN Fear & Greed. Macro/FRED, Claude brief and paper trading land in later
// steps and remain placeholders below.

const UP = '#22C55E'
const DOWN = '#EF4444'

function Change({ value, className = '' }) {
  const positive = value >= 0
  const Icon = positive ? IconArrowUpRight : IconArrowDownRight
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[12px] ${
        positive ? 'text-up' : 'text-down'
      } ${className}`}
    >
      <Icon size={13} stroke={1.5} />
      {positive ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  )
}

function QuoteRow({ symbol, name, price, change }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="min-w-0">
        <div className="truncate text-[13px] text-primary">{symbol}</div>
        {name && <div className="truncate text-[11px] text-secondary">{name}</div>}
      </div>
      <div className="flex flex-col items-end">
        <span className="font-mono text-[13px] text-primary">{formatPrice(price)}</span>
        <Change value={change} />
      </div>
    </div>
  )
}

function List({ children }) {
  return <div className="divide-y divide-border">{children}</div>
}

// Shared loading / error / empty handling for data-backed widgets.
function WidgetState({ loading, error, empty, children }) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-[12px] text-secondary">Chargement…</span>
      </div>
    )
  }
  if (error || empty) {
    return (
      <div className="flex h-full items-center justify-center px-2 text-center">
        <span className="text-[12px] text-secondary">
          Données indisponibles
        </span>
      </div>
    )
  }
  return children
}

function bySymbol(quotes) {
  return Object.fromEntries((quotes ?? []).map((q) => [q.symbol, q]))
}

// --- Marché global -----------------------------------------------------

export function NexusScoreWidget() {
  const fg = useFearGreed()
  const vix = useIndicator('VIXCLS')
  const curve = useIndicator('T10Y2Y')
  const cpi = useIndicator('CPIAUCSL', { yoy: true })

  const { score, blurb } = computeNexusScore({
    vix: vix.data?.value,
    fearGreed: fg.data?.score,
    yieldCurve: curve.data?.value,
    cpi: cpi.data?.value,
    putCall: fg.data?.putCall,
  })

  const loading = fg.loading && vix.loading && curve.loading && cpi.loading
  const hasData = score != null

  // Compact by design: only the gauge (score inside) and the regime label below.
  // The full weighted breakdown lives on the Indicateurs avancés / Sentiment pages.
  return (
    <WidgetState loading={loading} empty={!hasData}>
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <Gauge value={score ?? 0} label="Nexus Score" color="#F97316" size={132} />
        <p className="max-w-[200px] text-center text-[12px] text-secondary">{blurb}</p>
      </div>
    </WidgetState>
  )
}

export function FearGreedWidget() {
  const { data, loading, error } = useFearGreed()
  const value = data?.score
  const color =
    value == null
      ? '#888888'
      : value < 25
        ? DOWN
        : value < 45
          ? '#F59E0B'
          : value < 55
            ? '#888888'
            : UP
  return (
    <WidgetState loading={loading} error={error} empty={value == null}>
      <div className="flex h-full flex-col items-center justify-center">
        <Gauge value={value ?? 0} label={data?.label ?? ''} color={color} />
      </div>
    </WidgetState>
  )
}

export function VixWidget() {
  // FRED VIXCLS (CBOE Volatility Index daily close) through our secure proxy.
  // Reliable where Yahoo's ^VIX endpoint gets IP-rate-limited (HTTP 429).
  const { data, loading, error } = useIndicator('VIXCLS')
  const price = data?.value
  const changePct = data?.prev ? (data.change / data.prev) * 100 : 0
  return (
    <WidgetState loading={loading} error={error} empty={price == null}>
      {price != null && (
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-baseline justify-between">
            <span className="text-[34px] font-semibold leading-none">
              <CountUp value={price} format={formatPrice} />
            </span>
            <Change value={changePct} />
          </div>
          <Sparkline
            data={data.series}
            color={changePct >= 0 ? UP : DOWN}
            width={220}
            height={56}
          />
          <p className="text-[11px] text-secondary">Volatilité implicite S&P 500 · clôture</p>
        </div>
      )}
    </WidgetState>
  )
}

// --- Actifs ------------------------------------------------------------

export function FavorisWidget() {
  const symbols = FAVORIS_SYMBOLS.map((s) => s.symbol)
  const { data, loading, error } = useQuotes(symbols)
  const map = bySymbol(data)
  const rows = FAVORIS_SYMBOLS.filter((f) => map[f.symbol])
  return (
    <WidgetState loading={loading} error={error} empty={rows.length === 0}>
      <List>
        {rows.map((f) => (
          <QuoteRow
            key={f.symbol}
            symbol={f.symbol}
            name={f.name}
            price={map[f.symbol].price}
            change={map[f.symbol].changePct}
          />
        ))}
      </List>
    </WidgetState>
  )
}

export function TopMoversWidget() {
  const { data, loading, error } = useQuotes(MOVERS_UNIVERSE)
  const movers = [...(data ?? [])]
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 4)
  return (
    <WidgetState loading={loading} error={error} empty={movers.length === 0}>
      <List>
        {movers.map((m) => (
          <QuoteRow key={m.symbol} symbol={m.symbol} price={m.price} change={m.changePct} />
        ))}
      </List>
    </WidgetState>
  )
}

export function CryptoWidget() {
  const ids = CRYPTO_COINS.map((c) => c.id)
  const { data, loading, error } = useCryptos(ids)
  const map = Object.fromEntries((data ?? []).map((c) => [c.id, c]))
  const rows = CRYPTO_COINS.filter((c) => map[c.id])
  return (
    <WidgetState loading={loading} error={error} empty={rows.length === 0}>
      <List>
        {rows.map((c) => (
          <QuoteRow
            key={c.id}
            symbol={c.symbol}
            name={c.name}
            price={map[c.id].price}
            change={map[c.id].changePct}
          />
        ))}
      </List>
    </WidgetState>
  )
}

export function CommoditiesWidget() {
  const symbols = COMMODITIES_SYMBOLS.map((s) => s.symbol)
  const { data, loading, error } = useQuotes(symbols)
  const map = bySymbol(data)
  const rows = COMMODITIES_SYMBOLS.filter((c) => map[c.symbol])
  return (
    <WidgetState loading={loading} error={error} empty={rows.length === 0}>
      <List>
        {rows.map((c) => (
          <QuoteRow
            key={c.symbol}
            symbol={c.name}
            price={map[c.symbol].price}
            change={map[c.symbol].changePct}
          />
        ))}
      </List>
    </WidgetState>
  )
}

// --- Horaires ----------------------------------------------------------

export function MarketHoursWidget() {
  const exchanges = [
    { name: 'NYSE', open: true, info: 'Ferme dans 3h 12m' },
    { name: 'LSE', open: true, info: 'Ferme dans 1h 40m' },
    { name: 'Euronext', open: true, info: 'Ferme dans 1h 55m' },
    { name: 'Tokyo', open: false, info: 'Ouvre dans 6h 20m' },
    { name: 'Hong Kong', open: false, info: 'Ouvre dans 5h 05m' },
  ]
  return (
    <List>
      {exchanges.map((ex) => (
        <div key={ex.name} className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${ex.open ? 'bg-up' : 'bg-down'}`}
              style={ex.open ? { boxShadow: '0 0 6px #22C55E' } : undefined}
            />
            <span className="text-[13px] text-primary">{ex.name}</span>
          </div>
          <span className="text-[11px] text-secondary">{ex.info}</span>
        </div>
      ))}
    </List>
  )
}

// --- Analyse IA --------------------------------------------------------

export function DailyBriefWidget() {
  const fg = useFearGreed()
  const vix = useIndicator('VIXCLS')
  const curve = useIndicator('T10Y2Y')

  // Brief generation waits until at least one input is available, so Claude
  // always has real numbers to work from. VIX comes from FRED (VIXCLS) — Yahoo's
  // ^VIX endpoint is unreliable (HTTP 429); we shape it like a quote for reuse.
  const fearGreed = fg.data
  const vixQuote = vix.data?.value != null ? { price: vix.data.value } : null
  const ready =
    fearGreed?.score != null || vixQuote?.price != null || curve.data?.value != null

  const { data, loading, error } = useDailyBrief({
    fearGreed,
    vix: vixQuote,
    curve: curve.data,
    ready,
  })

  const inputsLoading = fg.loading || vix.loading || curve.loading

  return (
    <div className="flex h-full flex-col gap-2">
      <span className="nexus-label">Brief du jour — Claude</span>
      {(!ready && inputsLoading) || loading ? (
        <p className="text-[13px] leading-relaxed text-secondary">Génération du brief…</p>
      ) : error || !data ? (
        <p className="text-[13px] leading-relaxed text-secondary">
          Brief momentanément indisponible.
        </p>
      ) : (
        <p className="text-[13px] leading-relaxed text-primary">{data}</p>
      )}
      <span className="mt-auto text-[11px] text-secondary">
        Généré par Claude · sentiment, VIX et courbe des taux
      </span>
    </div>
  )
}

// --- Paper Trading -----------------------------------------------------

export function PaperPerfWidget() {
  const series = [100, 101.2, 100.8, 102.4, 103.1, 102.6, 104.0, 104.7]
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[26px] font-semibold leading-none">
            <CountUp value={104720} format={formatPrice} />
          </div>
          <div className="mt-1 nexus-label">CHF · valeur du portefeuille</div>
        </div>
        <Change value={4.72} />
      </div>
      <Sparkline data={series} color={UP} width={220} height={56} />
      <p className="text-[11px] text-secondary">vs S&amp;P 500 : +1.1 pt</p>
    </div>
  )
}
