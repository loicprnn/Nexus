// Status pill — light coloured background + same-hue text, 6px radius, tiny
// bold uppercase label. Used across Indicateurs, Sentiment and Calendrier so
// every status tag (Élevé, Normal, Prudent, Tendu…) reads identically.
//
// Four tones cover the whole app:
//   danger  → rouge   (risque élevé, stress, inversion)
//   warning → orange  (vigilance, tension modérée)
//   neutral → gris    (faible, plat, indéterminé)
//   success → vert    (normal, calme, sain)
const TONES = {
  danger: { bg: '#FEE2E2', fg: '#DC2626' },
  warning: { bg: '#FFF4EE', fg: '#F97316' },
  neutral: { bg: '#F3F4F6', fg: '#6B7280' },
  success: { bg: '#F0FDF4', fg: '#16A34A' },
}

// Map a French status word to a tone. Falls back to neutral for anything
// unrecognised so a badge never renders unstyled.
const LABEL_TONES = [
  [/(élevé|elevé|stress|invers|surchauff|extrême|panique|danger|forte)/i, 'danger'],
  [/(tendu|vigilance|prudent|moyen|modér|serré|élargi|attention)/i, 'warning'],
  [/(faible|plat|neutre|indéterminé|inconnu|stable)/i, 'neutral'],
  [/(normal|calme|sain|maîtris|proche cible|cible|détendu|confiance)/i, 'success'],
]

export function toneForLabel(label = '') {
  for (const [re, tone] of LABEL_TONES) if (re.test(label)) return tone
  return 'neutral'
}

// Render a status pill. Pass `tone` explicitly, or let it be inferred from the
// label text. An optional `color` override wins over everything (for callers
// that already compute an exact hue, e.g. gauge zones).
export default function Badge({ children, tone, color, className = '' }) {
  const resolved = tone || toneForLabel(String(children))
  const base = TONES[resolved] ?? TONES.neutral
  const fg = color || base.fg
  const bg = color ? `${color}1A` : base.bg
  return (
    <span
      className={`inline-flex items-center rounded-[6px] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.04em] ${className}`}
      style={{ backgroundColor: bg, color: fg }}
    >
      {children}
    </span>
  )
}
