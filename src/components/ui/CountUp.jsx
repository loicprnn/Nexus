import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Animated number that counts up from 0 (or a previous value) to `value` on
// mount and whenever `value` changes. `format` controls rendering so it works
// with prices, percentages, scores, money, etc. Kept light: a short ease-out
// tween via requestAnimationFrame, no layout thrash. Honors
// prefers-reduced-motion by jumping straight to the final value.
export default function CountUp({
  value,
  format = (v) => Math.round(v).toString(),
  duration = 1,
  className,
}) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value ?? 0)
  const fromRef = useRef(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (value == null || Number.isNaN(value)) return
    if (reduce) {
      setDisplay(value)
      return
    }
    const from = fromRef.current
    const to = value
    if (from === to) {
      setDisplay(to)
      return
    }
    const start = performance.now()
    const ms = Math.max(120, duration * 1000)
    const easeOut = (t) => 1 - Math.pow(1 - t, 3)

    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms)
      setDisplay(from + (to - from) * easeOut(t))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      fromRef.current = to // so a re-trigger counts from the last target
    }
  }, [value, duration, reduce])

  if (value == null || Number.isNaN(value)) {
    return <span className={className}>—</span>
  }
  return <span className={className}>{format(display)}</span>
}
