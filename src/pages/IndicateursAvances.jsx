import { IconArrowUpRight, IconArrowDownRight, IconMinus } from '@tabler/icons-react'
import PageContainer from '../components/ui/PageContainer'
import Sparkline from '../components/ui/Sparkline'
import CountUp from '../components/ui/CountUp'
import Badge from '../components/ui/Badge'
import { useIndicator, useFearGreed } from '../hooks/useMarketData'

// Advanced risk/volatility indicators. Every series is sourced from FRED through
// the keyless server proxy (the Twelve Data free plan doesn't serve indices like
// the VIX, but FRED publishes its daily close as VIXCLS). Each card maps the
// latest reading to a qualitative "régime" so the page reads as analysis, not
// just numbers. `zones` is an ordered list of thresholds, evaluated low-to-high.
const RISK = { calm: '#22C55E', neutral: '#F97316', warning: '#F59E0B', stress: '#EF4444' }

const INDICATORS = [
  {
    id: 'VIXCLS',
    label: 'VIX — volatilité implicite',
    note: "Volatilité attendue du S&P 500 à 30 jours. L'« indice de la peur ».",
    fmt: (v) => v.toFixed(2),
    unit: 'pts',
    zones: [
      { max: 15, tag: 'Calme', color: RISK.calm },
      { max: 20, tag: 'Normal', color: RISK.neutral },
      { max: 30, tag: 'Tendu', color: RISK.warning },
      { max: Infinity, tag: 'Stress', color: RISK.stress },
    ],
  },
  {
    id: 'T10Y2Y',
    label: 'Courbe des taux 10A − 2A',
    note: 'Spread des Treasuries. Négatif = courbe inversée, signal historique de récession.',
    fmt: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`,
    unit: 'pp',
    zones: [
      { max: 0, tag: 'Inversée', color: RISK.stress },
      { max: 0.5, tag: 'Plate', color: RISK.warning },
      { max: Infinity, tag: 'Normale', color: RISK.calm },
    ],
  },
  {
    id: 'T10Y3M',
    label: 'Courbe des taux 10A − 3M',
    note: 'Spread suivi de près par la Fed pour évaluer le risque de récession.',
    fmt: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`,
    unit: 'pp',
    zones: [
      { max: 0, tag: 'Inversée', color: RISK.stress },
      { max: 0.5, tag: 'Plate', color: RISK.warning },
      { max: Infinity, tag: 'Normale', color: RISK.calm },
    ],
  },
  {
    id: 'BAMLH0A0HYM2',
    label: 'Spread High Yield',
    note: 'Prime de risque des obligations à haut rendement vs Treasuries. Mesure le stress crédit.',
    fmt: (v) => v.toFixed(2),
    unit: 'pp',
    zones: [
      { max: 3.5, tag: 'Serré', color: RISK.calm },
      { max: 5, tag: 'Normal', color: RISK.neutral },
      { max: 7, tag: 'Élargi', color: RISK.warning },
      { max: Infinity, tag: 'Stress', color: RISK.stress },
    ],
  },
  {
    id: 'T10YIE',
    label: "Anticipations d'inflation 10A",
    note: "Point mort d'inflation à 10 ans implicite dans les Treasuries (breakeven).",
    fmt: (v) => `${v.toFixed(2)} %`,
    unit: '',
    zones: [
      { max: 2, tag: 'Maîtrisée', color: RISK.calm },
      { max: 2.75, tag: 'Proche cible', color: RISK.neutral },
      { max: Infinity, tag: 'Élevée', color: RISK.warning },
    ],
  },
  {
    id: 'DTWEXBGS',
    label: 'Dollar US (indice large)',
    note: 'Indice pondéré du dollar. Un dollar fort pèse sur les actifs risqués et émergents.',
    fmt: (v) => v.toFixed(1),
    unit: '',
    zones: [{ max: Infinity, tag: 'Niveau', color: RISK.neutral }],
  },
]

function zoneFor(zones, value) {
  return zones.find((z) => value <= z.max) ?? zones[zones.length - 1]
}

function Delta({ change, unit }) {
  const flat = Math.abs(change) < 0.005
  const Icon = flat ? IconMinus : change > 0 ? IconArrowUpRight : IconArrowDownRight
  return (
    <span className="inline-flex items-center gap-0.5 text-[12px] text-secondary">
      <Icon size={13} stroke={1.5} />
      {change >= 0 ? '+' : ''}
      {change.toFixed(2)}
      {unit ? ` ${unit}` : ''}
    </span>
  )
}

function IndicatorCard({ id, label, note, fmt, unit, zones }) {
  const { data, loading, error } = useIndicator(id)
  const zone = data ? zoneFor(zones, data.value) : null

  return (
    <div className="nexus-card flex flex-col gap-3 p-6">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-semibold text-primary">{label}</span>
        {zone && <Badge color={zone.color}>{zone.tag}</Badge>}
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
            <span className="text-[28px] font-semibold leading-none">
              <CountUp value={data.value} format={fmt} />
              {unit && <span className="ml-1 text-[13px] font-normal text-secondary">{unit}</span>}
            </span>
            <Delta change={data.change} unit={unit} />
          </div>
          <Sparkline data={data.series} color={zone?.color ?? '#F97316'} width={260} height={48} />
          <span className="text-[10px] text-secondary">Dernière donnée : {data.date}</span>
        </>
      )}

      <p className="mt-auto text-[11px] leading-relaxed text-secondary">{note}</p>
    </div>
  )
}

// Put/Call gauge reuses CNN's options sub-indicator (0-100, already proxied for
// the Fear & Greed widget) — a free, real read without a dedicated options feed.
function PutCallCard() {
  const { data, loading } = useFearGreed()
  const score = data?.putCall
  const known = score != null
  const high = known && score >= 60 // CNN scores HIGH = call-heavy = greedy
  const color = !known ? '#F97316' : high ? RISK.warning : score <= 40 ? RISK.stress : RISK.neutral
  const tag = !known ? '' : high ? 'Optimiste' : score <= 40 ? 'Couverture' : 'Neutre'

  return (
    <div className="nexus-card flex flex-col gap-3 p-6">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-semibold text-primary">Put/Call (options)</span>
        {tag && <Badge color={color}>{tag}</Badge>}
      </div>

      {loading ? (
        <span className="py-4 text-center text-[12px] text-secondary">Chargement…</span>
      ) : !known ? (
        <span className="py-4 text-center text-[12px] text-secondary">Données indisponibles</span>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-[28px] font-semibold leading-none" style={{ color }}>
            <CountUp value={score} />
          </span>
          <span className="text-[13px] text-secondary">/ 100</span>
        </div>
      )}

      <p className="mt-auto text-[11px] leading-relaxed text-secondary">
        Sous-indicateur CNN du ratio Put/Call. Un score bas (couverture massive en puts)
        traduit la peur ; un score haut, l'appétit pour le risque.
      </p>
    </div>
  )
}

export default function IndicateursAvances() {
  return (
    <PageContainer
      title="Indicateurs avancés"
      description="Volatilité, courbes des taux, stress crédit et anticipations d'inflation — avec lecture du régime de marché. Données FRED et CNN."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INDICATORS.map((ind) => (
          <IndicatorCard key={ind.id} {...ind} />
        ))}
        <PutCallCard />
      </div>
    </PageContainer>
  )
}
