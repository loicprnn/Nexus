import { useMemo } from 'react'
import { IconCalendarEvent } from '@tabler/icons-react'
import PageContainer from '../components/ui/PageContainer'

// Economic calendar. There is no free, key-less calendar API, so the schedule is
// generated from the well-known recurring cadence of the major US releases (NFP =
// first Friday, CPI mid-month, PCE end of month, etc.), which follow predictable
// monthly rules. Central-bank meetings (Fed/BCE) don't follow a simple rule, so
// they're listed from each institution's published 2026 schedule and filtered to
// the visible window. Everything is computed forward from today and grouped by
// day, with an impact colour code.

const WINDOW_DAYS = 42

const IMPACT = {
  high: { tag: 'Élevé', color: '#EF4444' },
  medium: { tag: 'Moyen', color: '#F59E0B' },
  low: { tag: 'Faible', color: '#10B981' },
}

// Snap a date onto a weekday (push Sat/Sun to the following Monday) — most US
// macro prints land on business days.
function snapWeekday(d) {
  const day = d.getDay()
  if (day === 6) d.setDate(d.getDate() + 2)
  else if (day === 0) d.setDate(d.getDate() + 1)
  return d
}

function firstFriday(year, month) {
  const d = new Date(year, month, 1)
  const offset = (5 - d.getDay() + 7) % 7
  d.setDate(1 + offset)
  return d
}

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Recurring monthly US macro releases, generated per (year, month).
function monthlyReleases(year, month) {
  const ev = [
    { day: () => firstFriday(year, month), region: 'US', title: "Rapport sur l'emploi (NFP)", detail: "Créations d'emplois non agricoles et taux de chômage.", time: '14:30', impact: 'high' },
    { day: () => snapWeekday(new Date(year, month, 12)), region: 'US', title: 'Inflation CPI', detail: 'Indice des prix à la consommation, total et sous-jacent.', time: '14:30', impact: 'high' },
    { day: () => snapWeekday(new Date(year, month, 13)), region: 'US', title: 'Prix à la production (PPI)', detail: 'Pressions inflationnistes en amont.', time: '14:30', impact: 'medium' },
    { day: () => snapWeekday(new Date(year, month, 16)), region: 'US', title: 'Ventes au détail', detail: 'Santé de la consommation des ménages.', time: '14:30', impact: 'medium' },
    { day: () => snapWeekday(new Date(year, month, 25)), region: 'US', title: 'Confiance des consommateurs', detail: 'Indice du Conference Board.', time: '16:00', impact: 'low' },
    { day: () => snapWeekday(new Date(year, month, 28)), region: 'US', title: 'Inflation PCE', detail: "Mesure d'inflation préférée de la Fed.", time: '14:30', impact: 'high' },
  ]
  // Quarterly GDP (premières estimations fin janv./avr./juil./oct.).
  if ([0, 3, 6, 9].includes(month)) {
    ev.push({ day: () => snapWeekday(new Date(year, month, 27)), region: 'US', title: 'PIB (estimation trimestrielle)', detail: 'Croissance annualisée du trimestre précédent.', time: '14:30', impact: 'high' })
  }
  return ev.map((e) => ({ date: iso(e.day()), region: e.region, title: e.title, detail: e.detail, time: e.time, impact: e.impact }))
}

// Central-bank meeting days (dates de décision) — calendriers officiels 2026.
const CENTRAL_BANKS = [
  { date: '2026-01-28', region: 'US', title: 'Décision de la Fed (FOMC)', detail: 'Taux directeur et conférence de presse.', time: '20:00', impact: 'high' },
  { date: '2026-01-29', region: 'EU', title: 'Décision de la BCE', detail: 'Taux directeurs de la zone euro.', time: '14:15', impact: 'high' },
  { date: '2026-03-12', region: 'EU', title: 'Décision de la BCE', detail: 'Taux directeurs et projections macro.', time: '14:15', impact: 'high' },
  { date: '2026-03-18', region: 'US', title: 'Décision de la Fed (FOMC)', detail: 'Taux directeur, projections et dot plot.', time: '20:00', impact: 'high' },
  { date: '2026-04-16', region: 'EU', title: 'Décision de la BCE', detail: 'Taux directeurs de la zone euro.', time: '14:15', impact: 'high' },
  { date: '2026-04-29', region: 'US', title: 'Décision de la Fed (FOMC)', detail: 'Taux directeur et conférence de presse.', time: '20:00', impact: 'high' },
  { date: '2026-06-04', region: 'EU', title: 'Décision de la BCE', detail: 'Taux directeurs et projections macro.', time: '14:15', impact: 'high' },
  { date: '2026-06-17', region: 'US', title: 'Décision de la Fed (FOMC)', detail: 'Taux directeur, projections et dot plot.', time: '20:00', impact: 'high' },
  { date: '2026-07-23', region: 'EU', title: 'Décision de la BCE', detail: 'Taux directeurs de la zone euro.', time: '14:15', impact: 'high' },
  { date: '2026-07-29', region: 'US', title: 'Décision de la Fed (FOMC)', detail: 'Taux directeur et conférence de presse.', time: '20:00', impact: 'high' },
  { date: '2026-09-10', region: 'EU', title: 'Décision de la BCE', detail: 'Taux directeurs et projections macro.', time: '14:15', impact: 'high' },
  { date: '2026-09-16', region: 'US', title: 'Décision de la Fed (FOMC)', detail: 'Taux directeur, projections et dot plot.', time: '20:00', impact: 'high' },
  { date: '2026-10-28', region: 'US', title: 'Décision de la Fed (FOMC)', detail: 'Taux directeur et conférence de presse.', time: '20:00', impact: 'high' },
  { date: '2026-10-29', region: 'EU', title: 'Décision de la BCE', detail: 'Taux directeurs de la zone euro.', time: '14:15', impact: 'high' },
  { date: '2026-12-09', region: 'US', title: 'Décision de la Fed (FOMC)', detail: 'Taux directeur, projections et dot plot.', time: '20:00', impact: 'high' },
  { date: '2026-12-17', region: 'EU', title: 'Décision de la BCE', detail: 'Taux directeurs et projections macro.', time: '14:15', impact: 'high' },
]

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

function buildCalendar() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setDate(end.getDate() + WINDOW_DAYS)

  // Generate monthly releases for every month touched by the window.
  const releases = []
  const cursor = new Date(today.getFullYear(), today.getMonth(), 1)
  while (cursor <= end) {
    releases.push(...monthlyReleases(cursor.getFullYear(), cursor.getMonth()))
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const all = [...releases, ...CENTRAL_BANKS]
    .map((e) => ({ ...e, when: new Date(`${e.date}T00:00:00`) }))
    .filter((e) => e.when >= today && e.when <= end)
    .sort((a, b) => a.when - b.when || a.time.localeCompare(b.time))

  // Group by ISO date.
  const groups = []
  for (const e of all) {
    let g = groups.find((x) => x.date === e.date)
    if (!g) {
      const diff = Math.round((e.when - today) / 86400000)
      const rel = diff === 0 ? "Aujourd'hui" : diff === 1 ? 'Demain' : `Dans ${diff} jours`
      g = { date: e.date, label: DATE_FMT.format(e.when), rel, today: diff === 0, items: [] }
      groups.push(g)
    }
    g.items.push(e)
  }
  return groups
}

function RegionBadge({ region }) {
  return (
    <span className="rounded border-hairline border-border px-1.5 py-0.5 text-[10px] font-medium text-secondary">
      {region}
    </span>
  )
}

export default function Calendrier() {
  const groups = useMemo(buildCalendar, [])

  return (
    <PageContainer
      title="Calendrier économique"
      description="Publications macro à venir (CPI, NFP, PCE, PIB) et décisions de la Fed et de la BCE, par ordre chronologique et niveau d'impact."
    >
      {groups.length === 0 ? (
        <div className="rounded-card border-hairline border-border bg-card p-8 text-center text-[13px] text-secondary">
          Aucun événement programmé dans les {WINDOW_DAYS} prochains jours.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.date}>
              <div className="mb-2 flex items-center gap-2">
                <IconCalendarEvent size={15} stroke={1.5} className="text-secondary" />
                <span className="text-[13px] font-semibold capitalize text-primary">{g.label}</span>
                <span
                  className={`text-[11px] ${g.today ? 'font-medium text-accent' : 'text-secondary'}`}
                >
                  · {g.rel}
                </span>
              </div>
              <div className="overflow-hidden rounded-card border-hairline border-border bg-card">
                {g.items.map((e, i) => {
                  const imp = IMPACT[e.impact]
                  return (
                    <div
                      key={`${e.title}-${i}`}
                      className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border/60' : ''}`}
                    >
                      <span className="w-12 shrink-0 font-mono text-[12px] text-secondary">{e.time}</span>
                      <RegionBadge region={e.region} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-primary">{e.title}</p>
                        <p className="truncate text-[11px] text-secondary">{e.detail}</p>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ color: imp.color, backgroundColor: `${imp.color}1A` }}
                      >
                        {imp.tag}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-5 text-[11px] leading-relaxed text-secondary">
        Horaires en heure de Paris (CET/CEST). Les publications statistiques suivent leur cadence
        mensuelle habituelle ; les dates exactes peuvent varier légèrement — à confirmer auprès des
        sources officielles (BLS, BEA, Fed, BCE).
      </p>
    </PageContainer>
  )
}
