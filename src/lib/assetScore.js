// Asset-level analysis score — a single 0-10 read on an instrument, composed of
// three dimensions that are each backed by a free live source:
//   • technique  — intraday price action (momentum, trend, position in range)
//   • sentiment  — market mood (CNN Fear & Greed + VIX)
//   • macro      — regime (yield curve 10y-2y + CPI year-over-year)
//
// Fundamentals are deliberately NOT scored: no free feed gives us per-asset
// fundamentals, and Nexus never fabricates figures. The fundamental dimension is
// instead covered qualitatively by Claude in the written synthesis.
//
// Weights are renormalised over whatever dimensions have live data, so a missing
// feed redistributes its weight rather than zeroing the score.

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)

// --- Technical metrics from an intraday close series (oldest-first) ---------

// Session performance: first → last, in %.
export function sessionPerf(series) {
  if (!series || series.length < 2 || !series[0]) return null
  return ((series[series.length - 1] - series[0]) / series[0]) * 100
}

// Standard deviation of period-over-period returns, in % — an intraday
// volatility proxy for the session.
export function sessionVolatility(series) {
  if (!series || series.length < 3) return null
  const returns = []
  for (let i = 1; i < series.length; i++) {
    if (series[i - 1]) returns.push((series[i] - series[i - 1]) / series[i - 1])
  }
  if (!returns.length) return null
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length
  return Math.sqrt(variance) * 100
}

// Position of the latest price within the session's [min, max] range (0..1).
export function rangePosition(series) {
  if (!series || series.length < 2) return null
  const min = Math.min(...series)
  const max = Math.max(...series)
  if (max === min) return 0.5
  return (series[series.length - 1] - min) / (max - min)
}

// Trend gap: average of the last third vs the first third of the session, in %.
// A smoother momentum read than a raw first→last comparison.
export function trendGap(series) {
  if (!series || series.length < 6) return null
  const n = series.length
  const third = Math.max(1, Math.floor(n / 3))
  const early = avg(series.slice(0, third))
  const late = avg(series.slice(n - third))
  if (!early) return null
  return ((late - early) / early) * 100
}

// --- Per-dimension 0-100 sub-scores (100 = healthiest / most constructive) ---

// Low implied volatility is healthy. ~12 → 100, ~40 → 0.
const vixSub = (vix) => clamp(100 - (vix - 12) * (100 / 28))
// 10y-2y spread: steep curve healthy, inversion = recession risk. 0 → 50.
const yieldCurveSub = (spread) => clamp(50 + spread * 30)
// CPI yoy: ~2% target healthiest; distance either way lowers the score.
const cpiSub = (yoy) => clamp(100 - Math.abs(yoy - 2) * (100 / 6))

// Technical sub-score: blends session momentum, trend gap and range position.
// A flat session lands near 50.
export function technicalSub(series) {
  const perf = sessionPerf(series)
  const gap = trendGap(series)
  const pos = rangePosition(series)
  const parts = []
  if (perf != null) parts.push(clamp(50 + perf * 12)) // ±~4% spans the scale
  if (gap != null) parts.push(clamp(50 + gap * 12))
  if (pos != null) parts.push(clamp(pos * 100))
  return parts.length ? avg(parts) : null
}

// Market sentiment sub-score: CNN Fear & Greed (already 0-100) blended with VIX.
export function sentimentSub({ fearGreed, vix } = {}) {
  const parts = []
  if (fearGreed != null) parts.push(clamp(fearGreed))
  if (vix != null) parts.push(vixSub(vix))
  return parts.length ? avg(parts) : null
}

// Macro regime sub-score: yield curve + inflation.
export function macroSub({ yieldCurve, cpi } = {}) {
  const parts = []
  if (yieldCurve != null) parts.push(yieldCurveSub(yieldCurve))
  if (cpi != null) parts.push(cpiSub(cpi))
  return parts.length ? avg(parts) : null
}

const DIM_WEIGHTS = { technique: 0.45, sentiment: 0.25, macro: 0.3 }

// Combine the three 0-100 sub-scores into a single 0-10 score (1 decimal),
// renormalising over the dimensions that have data.
export function computeAssetScore({ technique, sentiment, macro } = {}) {
  const dims = { technique, sentiment, macro }
  let weightSum = 0
  let acc = 0
  for (const k of Object.keys(DIM_WEIGHTS)) {
    if (dims[k] != null) {
      weightSum += DIM_WEIGHTS[k]
      acc += dims[k] * DIM_WEIGHTS[k]
    }
  }
  if (weightSum === 0) return null
  const score100 = acc / weightSum
  return Math.round((score100 / 10) * 10) / 10
}

// Score → design-system color (green / blue / amber / red).
export function scoreColor(score10) {
  if (score10 == null) return '#10B981'
  if (score10 >= 6.5) return '#22C55E'
  if (score10 >= 4.5) return '#10B981'
  if (score10 >= 3) return '#F59E0B'
  return '#EF4444'
}

// Score → short French label.
export function scoreLabel(score10) {
  if (score10 == null) return '—'
  if (score10 >= 6.5) return 'Constructif'
  if (score10 >= 4.5) return 'Neutre'
  if (score10 >= 3) return 'Prudent'
  return 'Défensif'
}
