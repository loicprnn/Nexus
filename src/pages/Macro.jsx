import { useEffect, useRef, useState } from 'react'
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconMinus,
  IconSparkles,
  IconRefresh,
} from '@tabler/icons-react'
import PageContainer from '../components/ui/PageContainer'
import Sparkline from '../components/ui/Sparkline'
import CountUp from '../components/ui/CountUp'
import { useIndicator } from '../hooks/useMarketData'
import { getMacroAnalysis } from '../lib/api/claude'

// Macro indicators from FRED. `fmt` renders the headline value; `yoy` switches
// the series to a year-over-year computation (CPI). `series` short note gives
// the reader the analytical "so what".
const INDICATORS = [
  {
    id: 'T10Y2Y',
    label: 'Courbe des taux 10Y-2Y',
    note: 'Spread 10 ans − 2 ans. Négatif = inversion, signal de récession.',
    fmt: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} pp`,
    color: '#10B981',
  },
  {
    id: 'DGS10',
    label: 'Taux US 10 ans',
    note: 'Rendement du Trésor américain à 10 ans.',
    fmt: (v) => `${v.toFixed(2)} %`,
    color: '#10B981',
  },
  {
    id: 'FEDFUNDS',
    label: 'Taux directeur Fed',
    note: 'Fed Funds Rate effectif.',
    fmt: (v) => `${v.toFixed(2)} %`,
    color: '#10B981',
  },
  {
    id: 'CPIAUCSL',
    label: 'Inflation US (CPI, a/a)',
    note: "Variation annuelle de l'indice des prix à la consommation.",
    fmt: (v) => `${v.toFixed(2)} %`,
    yoy: true,
    color: '#F59E0B',
  },
  {
    id: 'UNRATE',
    label: 'Chômage US',
    note: "Taux de chômage (population active).",
    fmt: (v) => `${v.toFixed(1)} %`,
    color: '#10B981',
  },
  {
    id: 'M2SL',
    label: 'Masse monétaire M2',
    note: 'Agrégat M2 — corrélé aux marchés sur le long terme.',
    fmt: (v) => `${(v / 1000).toFixed(2)} Tr $`, // M2 en milliers de milliards (tient sur une ligne)
    deltaSuffix: ' Md $',
    color: '#10B981',
  },
]

function Delta({ change, suffix = ' pp' }) {
  const flat = Math.abs(change) < 0.005
  const Icon = flat ? IconMinus : change > 0 ? IconArrowUpRight : IconArrowDownRight
  return (
    <span className="inline-flex items-center gap-0.5 text-[12px] text-secondary">
      <Icon size={13} stroke={1.5} />
      {change >= 0 ? '+' : ''}
      {change.toFixed(2)}
      {suffix}
    </span>
  )
}

function MacroCard({ id, label, note, fmt, yoy, color, deltaSuffix = ' pp' }) {
  const { data, loading, error } = useIndicator(id, { yoy })
  return (
    <div className="flex flex-col gap-3 rounded-card border-hairline border-border bg-card p-6">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-semibold text-primary">{label}</span>
        <span className="text-[10px] text-secondary">{data?.date ?? ''}</span>
      </div>

      {loading ? (
        <span className="py-4 text-center text-[12px] text-secondary">Chargement…</span>
      ) : error || !data ? (
        <span className="py-4 text-center text-[12px] text-secondary">
          Données indisponibles
        </span>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <span className="whitespace-nowrap text-[28px] font-semibold leading-none">
              <CountUp value={data.value} format={fmt} />
            </span>
            <Delta change={data.change} suffix={deltaSuffix} />
          </div>
          <Sparkline data={data.series} color={color} width={260} height={48} />
        </>
      )}

      <p className="mt-auto text-[11px] leading-relaxed text-secondary">{note}</p>
    </div>
  )
}

// Nexus macro synthesis — Claude crosses every indicator and concludes on the
// market regime. Generates once when the data is ready, with a manual refresh.
// The indicators are re-read via useIndicator, but those calls are cached and
// in-flight-deduped, so this shares the cards' data rather than refetching.
function MacroAnalysis() {
  const curve = useIndicator('T10Y2Y')
  const ten = useIndicator('DGS10')
  const fed = useIndicator('FEDFUNDS')
  const cpi = useIndicator('CPIAUCSL', { yoy: true })
  const unrate = useIndicator('UNRATE')
  const m2 = useIndicator('M2SL')

  const ready =
    curve.data?.value != null ||
    fed.data?.value != null ||
    cpi.data?.value != null ||
    unrate.data?.value != null

  const [state, setState] = useState({ text: '', loading: false, error: null })
  const didAuto = useRef(false)

  const generate = async () => {
    setState({ text: '', loading: true, error: null })
    try {
      const text = await getMacroAnalysis({
        yieldCurve: curve.data?.value,
        tenYear: ten.data?.value,
        fedRate: fed.data?.value,
        cpi: cpi.data?.value,
        unemployment: unrate.data?.value,
        m2: m2.data?.value,
        m2Change: m2.data?.change,
      })
      setState({ text, loading: false, error: null })
    } catch (error) {
      setState({ text: '', loading: false, error: error?.message || 'Erreur' })
    }
  }

  // Auto-generate once when the macro data first becomes available.
  useEffect(() => {
    if (ready && !didAuto.current) {
      didAuto.current = true
      generate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  return (
    <div className="mt-5 rounded-card border-hairline border-border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary">
          <IconSparkles size={15} stroke={1.5} className="text-accent" />
          Nexus Analysis — régime de marché
        </span>
        <button
          type="button"
          onClick={generate}
          disabled={state.loading || !ready}
          className="inline-flex items-center gap-1.5 rounded-full border-hairline border-border px-3 py-1.5 text-[12px] text-secondary transition-colors hover:bg-hover hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconRefresh size={14} stroke={1.5} />
          {state.loading ? 'Analyse…' : 'Rafraîchir'}
        </button>
      </div>

      {state.error ? (
        <p className="mt-3 text-[13px] text-down">Erreur : {state.error}</p>
      ) : state.text ? (
        <p className="mt-3 text-[14px] leading-relaxed text-primary">{state.text}</p>
      ) : (
        <p className="mt-3 text-[13px] leading-relaxed text-secondary">
          {state.loading
            ? 'Génération de la synthèse macro…'
            : 'Synthèse en attente des données macro.'}
        </p>
      )}
    </div>
  )
}

export default function Macro() {
  return (
    <PageContainer title="Macro">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {INDICATORS.map((ind) => (
          <MacroCard key={ind.id} {...ind} />
        ))}
      </div>
      <MacroAnalysis />
    </PageContainer>
  )
}
