// Nexus Score — a single 0-100 "market health / risk appetite" gauge composed
// of five weighted macro & sentiment inputs, all backed by a free live source.
// Higher = risk-on (healthier), lower = risk-off (stress). The journal of
// weights below is the source of truth; each input is mapped to its own 0-100
// sub-score, then combined.
//
// Weights are renormalised over the inputs that actually have live data, so a
// temporarily missing feed never zeroes the score — it just redistributes its
// weight across the rest. Every input is surfaced in `components` so the
// composition stays fully transparent in the UI.

export const SCORE_WEIGHTS = {
  vix: 0.22,
  fearGreed: 0.22,
  yieldCurve: 0.22,
  cpi: 0.17,
  putCall: 0.17,
}

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

// --- Per-input mappers: raw value -> 0-100 (100 = healthiest / most risk-on) --

// Low implied volatility is healthy. ~12 → 100, ~40 → 0.
const vixSub = (vix) => clamp(100 - (vix - 12) * (100 / 28))

// CNN Fear & Greed is already 0-100 (high = greed = risk-on). Used as-is.
const fearGreedSub = (score) => clamp(score)

// 10y-2y spread: steep curve healthy, inversion = recession risk.
// 0 → 50, +1.67 → 100, -1.67 → 0.
const yieldCurveSub = (spread) => clamp(50 + spread * 30)

// CPI year-over-year: ~2% target is healthiest; distance in either direction
// (hot inflation OR deflation) lowers the score. 2% → 100, 8% or -4% → 0.
const cpiSub = (yoy) => clamp(100 - Math.abs(yoy - 2) * (100 / 6))

// CNN's put/call sub-indicator is already 0-100 (high = low put/call = greed).
const putCallSub = (score) => clamp(score)

const META = {
  vix: { label: 'VIX', hint: 'Volatilité implicite' },
  fearGreed: { label: 'Fear & Greed', hint: 'Sentiment CNN' },
  yieldCurve: { label: 'Courbe des taux', hint: 'Spread 10a-2a' },
  cpi: { label: 'Inflation (CPI)', hint: 'Glissement annuel' },
  putCall: { label: 'Put/Call', hint: 'Ratio options CBOE' },
}

function classify(score) {
  if (score == null) return ''
  if (score >= 65) return 'Risk-on — appétit pour le risque'
  if (score >= 45) return 'Neutre — marché équilibré'
  return 'Risk-off — aversion au risque'
}

// Compute the composite score from whatever raw inputs are available.
// `inputs` keys (any may be null/undefined): vix, fearGreed, yieldCurve, cpi,
// putCall. Returns { score, blurb, components, coverage } where `components`
// lists every input (available or not) with its 0-100 sub-score and effective
// (renormalised) weight, for a transparent breakdown.
export function computeNexusScore(inputs = {}) {
  const subScores = {
    vix: inputs.vix != null ? vixSub(inputs.vix) : null,
    fearGreed: inputs.fearGreed != null ? fearGreedSub(inputs.fearGreed) : null,
    yieldCurve: inputs.yieldCurve != null ? yieldCurveSub(inputs.yieldCurve) : null,
    cpi: inputs.cpi != null ? cpiSub(inputs.cpi) : null,
    putCall: inputs.putCall != null ? putCallSub(inputs.putCall) : null,
  }

  const availableWeight = Object.keys(SCORE_WEIGHTS).reduce(
    (sum, k) => (subScores[k] != null ? sum + SCORE_WEIGHTS[k] : sum),
    0,
  )

  const components = Object.keys(SCORE_WEIGHTS).map((k) => {
    const available = subScores[k] != null
    return {
      key: k,
      label: META[k].label,
      hint: META[k].hint,
      raw: inputs[k] ?? null,
      subScore: available ? Math.round(subScores[k]) : null,
      weight: SCORE_WEIGHTS[k],
      // Effective weight after renormalising over available inputs.
      effectiveWeight: available && availableWeight > 0 ? SCORE_WEIGHTS[k] / availableWeight : 0,
      available,
    }
  })

  let score = null
  if (availableWeight > 0) {
    const weighted = components.reduce(
      (sum, c) => (c.available ? sum + c.subScore * c.effectiveWeight : sum),
      0,
    )
    score = Math.round(weighted)
  }

  return {
    score,
    blurb: classify(score),
    components,
    coverage: availableWeight, // share of nominal weight covered by live data
  }
}
