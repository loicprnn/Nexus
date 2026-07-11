import { cached, TTL } from './cache'

// CNN Fear & Greed Index via proxy (browser headers set in vite.config.js to
// avoid CNN's 418 bot block). Score 0-100 with a textual rating.

const RATING_FR = {
  'extreme fear': 'Peur extrême',
  fear: 'Peur',
  neutral: 'Neutre',
  greed: 'Avidité',
  'extreme greed': 'Avidité extrême',
}

export function getFearGreed() {
  // Cache key carries a version: bumped when the returned shape changes (added
  // history / put-call series) so stale-shaped cached values aren't reused.
  return cached('fng:cnn:v2', TTL.FEAR_GREED, async () => {
    const res = await fetch('/api/fng/index/fearandgreed/graphdata')
    if (!res.ok) throw new Error(`Fear & Greed: HTTP ${res.status}`)
    const json = await res.json()
    const fg = json?.fear_and_greed
    if (!fg) throw new Error('Fear & Greed: réponse vide')
    const score = Math.round(fg.score)
    const rating = (fg.rating ?? '').toLowerCase()
    // CNN's graphdata also carries each sub-indicator (0-100). We surface the
    // put/call options gauge so the Nexus Score can use a real, free Put/Call
    // reading without an extra data source.
    const putCall = json?.put_call_options?.score

    // Historical series (CNN ships ~1 year of daily points). Keep the last 30 for
    // the Sentiment page's 30-day Fear & Greed chart.
    const histRaw = Array.isArray(json?.fear_and_greed_historical?.data)
      ? json.fear_and_greed_historical.data
      : []
    const history = histRaw.slice(-30).map((p) => ({
      date: new Date(p.x).toISOString().slice(0, 10),
      value: Math.round(p.y),
    }))

    // Put/Call sub-indicator history. `.data[].y` is the RAW ratio (~0.7–1.1),
    // not the 0-100 gauge — exactly what a Put/Call ratio chart should show.
    const pcRaw = Array.isArray(json?.put_call_options?.data)
      ? json.put_call_options.data
      : []
    const putCallSeries = pcRaw.slice(-30).map((p) => p.y)
    const putCallRatio = pcRaw.length ? pcRaw[pcRaw.length - 1].y : null

    return {
      score,
      rating,
      label: RATING_FR[rating] ?? 'Neutre',
      previousClose: Math.round(fg.previous_close ?? score),
      putCall: putCall != null ? Math.round(putCall) : null,
      history,
      putCallSeries,
      putCallRatio,
    }
  })
}
