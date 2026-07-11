// Number formatting. de-CH locale uses the apostrophe thousands separator
// (e.g. 67'410), matching the app's Swiss-franc framing.
const LOCALE = 'de-CH'

// Price formatter with sensible decimals: more precision for sub-1 assets.
export function formatPrice(value) {
  if (value == null || Number.isNaN(value)) return '—'
  const abs = Math.abs(value)
  const decimals = abs >= 1000 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatPct(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

// Money formatter for portfolio amounts: apostrophe grouping, fixed decimals.
// `signed` prepends a + for positive figures (P&L display).
export function formatMoney(value, { decimals = 2, signed = false } = {}) {
  if (value == null || Number.isNaN(value)) return '—'
  const sign = signed && value > 0 ? '+' : ''
  return (
    sign +
    new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)
  )
}
