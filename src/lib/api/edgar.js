import { cached, TTL } from './cache'

// SEC EDGAR fundamentals via the secure server proxy (/api/edgar). Free, official,
// no API key. Covers US-listed companies that file 10-K/10-Q with the SEC; ETFs
// and non-US assets aren't in EDGAR and surface as "non disponible".
//
// Flow: ticker → CIK (company_tickers directory), then the company's full XBRL
// facts (companyfacts), from which we extract the latest annual income figures
// and most-recent balance-sheet items.

const PROXY = '/api/edgar'

async function edgar(params) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${PROXY}?${qs}`)
  if (!res.ok) {
    const j = await res.json().catch(() => null)
    throw new Error(j?.error || `EDGAR HTTP ${res.status}`)
  }
  return res.json()
}

// ticker (upper) → 10-digit CIK. Cached a day (the directory rarely changes).
async function getCikMap() {
  return cached('edgar:ciks', TTL.MACRO, async () => {
    const json = await edgar({ endpoint: 'tickers' })
    const map = {}
    for (const row of Object.values(json)) {
      if (row?.ticker) map[row.ticker.toUpperCase()] = String(row.cik_str).padStart(10, '0')
    }
    return map
  })
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

// Pick a value from a us-gaap concept. `unit` selects the unit bucket
// (USD, USD/shares…). `annual` keeps only 10-K (full fiscal year) entries; else
// the most recent point of any filing (for instantaneous balance-sheet items).
// Returns the entry with the latest period end, or null.
function pick(facts, concept, { unit = 'USD', annual = false } = {}) {
  const buckets = facts?.[concept]?.units
  const rows = buckets?.[unit]
  if (!Array.isArray(rows) || !rows.length) return null
  const filtered = annual ? rows.filter((r) => r.form === '10-K' && r.fp === 'FY') : rows
  const pool = filtered.length ? filtered : rows
  let best = null
  for (const r of pool) {
    if (!isNum(r.val)) continue
    if (!best || r.end > best.end) best = r
  }
  return best
}

// First non-null pick across a list of concept fallbacks (XBRL tagging varies).
function pickFirst(facts, concepts, opts) {
  for (const c of concepts) {
    const got = pick(facts, c, opts)
    if (got) return got
  }
  return null
}

const REVENUE = [
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'Revenues',
  'SalesRevenueNet',
]
const EPS = ['EarningsPerShareDiluted', 'EarningsPerShareBasic']
const EQUITY = [
  'StockholdersEquity',
  'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
]
const LT_DEBT = ['LongTermDebtNoncurrent', 'LongTermDebt']
const CUR_DEBT = ['LongTermDebtCurrent', 'DebtCurrent', 'ShortTermBorrowings']

// Compact money: "3.21 Bn $", "94.0 Md $", "450 M $".
function money(n) {
  if (!isNum(n)) return null
  const abs = Math.abs(n)
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)} Bn $`
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1)} Md $`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(0)} M $`
  return `${Math.round(n)} $`
}

// Raw fundamentals for a US-listed stock. Returns { name, fiscalYear, eps,
// metrics:[{label,value}] } (without P/E — the caller adds it from the live
// price). Throws if the ticker has no EDGAR coverage (ETF / non-US).
export function getFundamentals(symbol) {
  return cached(`edgar:fund:${symbol}`, TTL.MACRO, async () => {
    const ciks = await getCikMap()
    const cik = ciks[symbol.toUpperCase()]
    if (!cik) throw new Error('Hors couverture EDGAR') // ETF / non-US

    const data = await edgar({ endpoint: 'companyfacts', cik })
    const facts = data?.facts?.['us-gaap']
    if (!facts) throw new Error('Aucune donnée fondamentale')

    const revenue = pickFirst(facts, REVENUE, { annual: true })
    const netIncome = pick(facts, 'NetIncomeLoss', { annual: true })
    const eps = pickFirst(facts, EPS, { unit: 'USD/shares', annual: true })

    // No core income figures → not an operating company we can profile (e.g. a
    // fund that files but has no 10-K income statement). Surface as unavailable.
    if (!revenue && !netIncome && !eps) {
      throw new Error('Données fondamentales indisponibles')
    }
    const equity = pickFirst(facts, EQUITY, {}) // latest balance-sheet point
    const ltDebt = pickFirst(facts, LT_DEBT, {})
    const curDebt = pickFirst(facts, CUR_DEBT, {})

    const totalDebt =
      ltDebt || curDebt ? (ltDebt?.val ?? 0) + (curDebt?.val ?? 0) : null
    const netMargin =
      isNum(netIncome?.val) && isNum(revenue?.val) && revenue.val !== 0
        ? (netIncome.val / revenue.val) * 100
        : null
    const debtEquity =
      isNum(totalDebt) && isNum(equity?.val) && equity.val !== 0
        ? totalDebt / equity.val
        : null

    return {
      kind: 'stock',
      name: data.entityName || symbol,
      fiscalYear: revenue?.fy ?? netIncome?.fy ?? null,
      eps: eps?.val ?? null,
      metrics: [
        { label: 'Revenus (annuel)', value: money(revenue?.val) },
        { label: 'Bénéfice net', value: money(netIncome?.val) },
        { label: 'Marge nette', value: isNum(netMargin) ? `${netMargin.toFixed(2)} %` : null },
        { label: 'BPA (EPS)', value: isNum(eps?.val) ? `${eps.val.toFixed(2)} $` : null },
        { label: 'Dette totale', value: money(totalDebt) },
        { label: 'Capitaux propres', value: money(equity?.val) },
      ],
    }
  })
}
