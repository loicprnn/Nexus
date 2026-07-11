import { useEffect, useMemo, useRef, useState } from 'react'
import { getQuotes } from '../lib/api/quotes'
import { getFundamentals } from '../lib/api/edgar'
import { getCryptoMarkets } from '../lib/api/coingecko'
import { getFearGreed } from '../lib/api/fearGreed'
import { getIndicator, getYoY } from '../lib/api/fred'
import { getDailyBrief } from '../lib/api/claude'
import { cached, TTL } from '../lib/api/cache'

// On failure, retry well before the normal TTL so a transient upstream error
// (e.g. a temporary rate-limit) recovers in under a minute instead of waiting
// the full refresh window.
const RETRY_MS = 30 * 1000

// Generic polling hook. Runs `fetcher` on mount, then reschedules itself: at
// `intervalMs` after a success, or sooner (RETRY_MS) after a failure. Returns
// { data, loading, error }; `loading` is only true on the first load so
// refreshes don't flash skeletons. `key` resets state when it changes.
function usePolling(fetcher, intervalMs, key) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    let cancelled = false
    let timer = null
    setState({ data: null, loading: true, error: null })

    const run = async () => {
      let delay = intervalMs
      try {
        const data = await fetcherRef.current()
        if (!cancelled) setState({ data, loading: false, error: null })
      } catch (error) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error }))
        delay = RETRY_MS
      }
      if (!cancelled) timer = setTimeout(run, delay)
    }

    run()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, intervalMs])

  return state
}

export function useQuotes(symbols, opts) {
  const key = `quotes:${symbols.join(',')}:${opts?.sparkline ? 's' : 'q'}`
  return usePolling(() => getQuotes(symbols, opts), TTL.QUOTES, key)
}

// Live quotes for a LARGE symbol list under a strict per-minute API budget.
// Twelve Data's free tier allows only 8 credits/minute (1 credit per symbol), so
// a 20+ symbol batch 429s outright. This splits the list into chunks of
// `chunkSize` and starts each chunk `staggerMs` apart, merging quotes as they
// arrive (so markers fill in waves rather than all-or-nothing). Each chunk then
// refreshes on its own TTL.QUOTES cadence, staying staggered so the per-minute
// budget is never blown again. Values persist via the localStorage cache, so a
// later visit shows the full set instantly. Returns { data, loading } like
// useQuotes; `loading` clears once the first chunk lands.
export function useChunkedQuotes(
  symbols,
  { chunkSize = 6, staggerMs = 62 * 1000, sparkline = false } = {},
) {
  const symKey = symbols.join(',')
  const [bySymbol, setBySymbol] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const timers = []
    setBySymbol({})
    setLoading(true)

    const chunks = []
    for (let i = 0; i < symbols.length; i += chunkSize) {
      chunks.push(symbols.slice(i, i + chunkSize))
    }

    chunks.forEach((chunk, i) => {
      const run = async () => {
        let delay = TTL.QUOTES
        try {
          const data = await getQuotes(chunk, { sparkline })
          if (!cancelled) {
            setBySymbol((prev) => {
              const next = { ...prev }
              for (const q of data) next[q.symbol] = q
              return next
            })
            setLoading(false)
          }
        } catch {
          delay = RETRY_MS // transient (often a 429) — retry sooner than the TTL
        }
        if (!cancelled) timers.push(setTimeout(run, delay))
      }
      timers.push(setTimeout(run, i * staggerMs))
    })

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symKey, chunkSize, staggerMs, sparkline])

  const data = useMemo(() => Object.values(bySymbol), [bySymbol])
  return { data, loading }
}

// Company / ETF fundamentals from Financial Modeling Prep (cached ~1 day).
export function useFundamentals(symbol) {
  const key = `fmp:${symbol}`
  return usePolling(() => getFundamentals(symbol), TTL.MACRO, key)
}

export function useCryptos(ids, opts) {
  const key = `crypto:${ids.join(',')}`
  return usePolling(() => getCryptoMarkets(ids, opts), TTL.QUOTES, key)
}

export function useFearGreed() {
  return usePolling(() => getFearGreed(), TTL.FEAR_GREED, 'fng')
}

// FRED macro indicator. `yoy: true` computes year-over-year % (for CPI etc.).
export function useIndicator(seriesId, { yoy = false } = {}) {
  const key = `fred:${seriesId}:${yoy ? 'yoy' : 'level'}`
  return usePolling(
    () => (yoy ? getYoY(seriesId) : getIndicator(seriesId)),
    TTL.MACRO,
    key,
  )
}

// Coarse cache signature so the Claude brief is generated at most ~once a day
// (and once per meaningful market move) rather than on every data refresh.
// This keeps Anthropic API usage — and cost — minimal on the public deploy.
function briefSignature({ fearGreed, vix, curve }) {
  const day = new Date().toISOString().slice(0, 10)
  const fg = fearGreed?.score != null ? Math.round(fearGreed.score / 5) * 5 : 'x'
  const vx = vix?.price != null ? Math.round(vix.price) : 'x'
  const cv = curve?.value != null ? Math.round(curve.value * 10) / 10 : 'x'
  return `${day}:${fg}:${vx}:${cv}`
}

// Daily market brief generated by Claude from the live macro/sentiment context.
// Waits for `context.ready` before calling; caches by a coarse daily signature.
export function useDailyBrief(context) {
  const ready = Boolean(context?.ready)
  const sig = ready ? briefSignature(context) : null
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const contextRef = useRef(context)
  contextRef.current = context

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    cached(`brief:${sig}`, TTL.BRIEF, () => getDailyBrief(contextRef.current))
      .then((text) => {
        if (!cancelled) setState({ data: text, loading: false, error: null })
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, ready])

  return state
}
