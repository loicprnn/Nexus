import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Lightweight SVG sparkline with a gradient fill below the line and a neon glow
// on the stroke (CSS drop-shadow in the line's own color). No chart library.
// On mount the line "draws itself" left-to-right (animated pathLength) and the
// gradient fill fades in just behind it. Honors prefers-reduced-motion.
//
// `fill` makes the svg stretch to fill its container (used on the Dashboard where
// the chart occupies the lower ~60% of a card); otherwise it renders at `width`
// but never wider than its container.
export default function Sparkline({
  data = [],
  color = '#10B981',
  width = 140,
  height = 44,
  strokeWidth = 1.5,
  fill = false,
  glow = true,
}) {
  const gradientId = useId()
  const reduce = useReducedMotion()

  if (data.length < 2) {
    return <svg width={width} height={height} style={{ maxWidth: '100%' }} />
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)

  const points = data.map((value, i) => {
    const x = i * stepX
    const y = height - ((value - min) / range) * (height - strokeWidth) - strokeWidth / 2
    return [x, y]
  })

  const linePath = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const areaPath = `0,${height} ${linePath} ${width},${height}`

  const svgStyle = fill
    ? { width: '100%', height: '100%', maxWidth: '100%' }
    : { maxWidth: '100%' }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="block"
      style={svgStyle}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.polygon
        points={areaPath}
        fill={`url(#${gradientId})`}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.35, ease: 'easeOut' }}
      />
      <motion.polyline
        points={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        // Neon fluorescent glow in the line's own colour.
        style={glow ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined}
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: 'easeInOut' }}
      />
    </svg>
  )
}
