import { motion, useReducedMotion } from 'framer-motion'
import CountUp from './CountUp'

// Semicircular 0–max gauge. Track + colored value arc + centered number.
// On mount the value arc sweeps in and the number counts up. Honors
// prefers-reduced-motion (renders final state, no animation).
export default function Gauge({
  value = 0,
  max = 100,
  color = '#F97316',
  label,
  size = 160,
}) {
  const reduce = useReducedMotion()
  const clamped = Math.max(0, Math.min(value, max))
  const ratio = clamped / max

  const stroke = 10
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  // Semicircle: 180° (π) sweep from left to right.
  const circumference = Math.PI * r

  const height = size / 2 + stroke

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
        {/* Track — light grey on the light theme */}
        <path
          d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
          fill="none"
          stroke="#F0F0F0"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <motion.path
          d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduce ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - ratio) }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        />
      </svg>
      <div className="-mt-8 flex flex-col items-center">
        <span className="text-[32px] font-semibold leading-none" style={{ color }}>
          <CountUp value={clamped} format={(v) => Math.round(v).toString()} />
        </span>
        {label && <span className="mt-1 nexus-label">{label}</span>}
      </div>
    </div>
  )
}
