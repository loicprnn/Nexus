import { cached, TTL } from './cache'

// Financial Modeling Prep via the secure server proxy (/api/fmp). The API key
// stays server-side; this module just shapes requests and normalises the
// response into a small, display-ready { kind, name, metrics[] } object.
// Fundamentals change slowly, so results are cached for a day (TTL.MACRO).

const PROXY = '/api/fmp'

async function fmp(endpoint, symbol) {
  const res = await fetch(`${PROXY}?endpoint=${endpoint}&symbol=${encodeURIComponent(symbol)}`)
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error || json?.['Error Message'] || `FMP HTTP ${res.status}`)
  if (json && json['Error Message']) throw new Error(json['Error Message'])
  return json
}

const first = (x) => (Array.isArray(x) ? x[0] : x)
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

// Compact money: 3.21 Bn$ -> "3,21 Md $", 450M -> "450 M $".
function money(n) {
  if (!isNum(n)) return null
  const abs = Math.abs(n)
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)} Bn $`
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)} Md $`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)} M $`
  return `${Math.round(n)} $`
}
const pct = (n, mul = 1) => (isNum(n) ? `${(n * mul).toFixed(2)} %` : null)
const ratio = (n) => (isNum(n) ? n.toFixed(2) : null)

// Fundamentals for a stock OR ETF. Returns
// { kind:'stock'|'etf', name, metrics:[{label, value}] }. Missing fields surface
// as `value: null` so the UI can show "—" without failing.
export function getFundamentals(symbol) {
  return cached(`fmp:fund:${symbol}`, TTL.MACRO, async () => {
    const profile = first(await fmp('profile', symbol))
    if (!profile || !profile.symbol) throw new Error('Aucune donnée fondamentale')
    const name = profile.companyName ?? symbol

    if (profile.isEtf) {
      let etf = null
      try {
        etf = first(await fmp('etf-info', symbol))
      } catch {
        etf = null
      }
      const divYield =
        isNum(etf?.dividendYield)
          ? pct(etf.dividendYield, 1)
          : isNum(profile.lastDiv) && isNum(profile.price) && profile.price > 0
            ? pct((profile.lastDiv / profile.price) * 100)
            : null
      return {
        kind: 'etf',
        name,
        metrics: [
          { label: 'Frais (TER)', value: isNum(etf?.expenseRatio) ? `${etf.expenseRatio.toFixed(2)} %` : null },
          { label: 'Encours (AUM)', value: money(etf?.aum) ?? money(profile.mktCap) },
          {
            label: 'Positions',
            value: isNum(etf?.holdingsCount)
              ? String(etf.holdingsCount)
              : Array.isArray(etf?.holdings)
                ? String(etf.holdings.length)
                : null,
          },
          { label: 'Rendement (div.)', value: divYield },
        ],
      }
    }

    // Stock: profile + TTM ratios + latest annual income statement.
    let ratios = null
    let income = null
    try {
      ratios = first(await fmp('ratios', symbol))
    } catch {
      ratios = null
    }
    try {
      income = first(await fmp('income', symbol))
    } catch {
      income = null
    }
    const cur = profile.currency || 'USD'
    return {
      kind: 'stock',
      name,
      metrics: [
        { label: 'PER (P/E)', value: ratio(ratios?.peRatioTTM) },
        { label: 'BPA (EPS)', value: isNum(income?.eps) ? `${income.eps.toFixed(2)} ${cur}` : null },
        { label: 'Revenus (annuel)', value: money(income?.revenue) },
        { label: 'Marge nette', value: pct(ratios?.netProfitMarginTTM, 100) },
        { label: 'Dette / Capitaux', value: ratio(ratios?.debtEquityRatioTTM) },
      ],
    }
  })
}
