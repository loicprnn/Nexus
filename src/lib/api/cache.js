// TTL cache shared by all market-data clients.
// - In-memory layer for instant reuse within a session.
// - localStorage layer so a reload shows last-known values immediately
//   (and respects the free-tier refresh limits from the spec).
// - In-flight dedupe so concurrent callers share a single network request.

const MEM = new Map() // key -> { value, expires }
const INFLIGHT = new Map() // key -> Promise
const LS_PREFIX = 'nexus.cache.'

function lsGet(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function lsSet(key, entry) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry))
  } catch {
    // Quota or private mode — memory cache still works.
  }
}

// Returns the cached value if still fresh, otherwise null.
export function getCached(key) {
  const mem = MEM.get(key)
  if (mem && mem.expires > Date.now()) return mem.value
  const ls = lsGet(key)
  if (ls && ls.expires > Date.now()) {
    MEM.set(key, ls)
    return ls.value
  }
  return null
}

// Returns the last value even if stale (used as fallback when a refetch fails).
export function getStale(key) {
  const mem = MEM.get(key)
  if (mem) return mem.value
  const ls = lsGet(key)
  return ls ? ls.value : null
}

function setCached(key, value, ttlMs) {
  const entry = { value, expires: Date.now() + ttlMs }
  MEM.set(key, entry)
  lsSet(key, entry)
}

// Fetch through the cache. `fetcher` runs only on a miss; concurrent callers
// for the same key await the same promise. On failure, falls back to the last
// stale value if one exists, else rethrows.
export async function cached(key, ttlMs, fetcher) {
  const fresh = getCached(key)
  if (fresh != null) return fresh

  if (INFLIGHT.has(key)) return INFLIGHT.get(key)

  const promise = (async () => {
    try {
      const value = await fetcher()
      setCached(key, value, ttlMs)
      return value
    } catch (err) {
      const stale = getStale(key)
      if (stale != null) return stale
      throw err
    } finally {
      INFLIGHT.delete(key)
    }
  })()

  INFLIGHT.set(key, promise)
  return promise
}

// Refresh cadences from the cahier des charges (section 3.3).
export const TTL = {
  QUOTES: 15 * 60 * 1000, // prices: 15 min
  FEAR_GREED: 60 * 60 * 1000, // sentiment: 1 h
  MACRO: 24 * 60 * 60 * 1000, // FRED: 1 day
  BRIEF: 3 * 60 * 60 * 1000, // brief Claude: 3 h (limite les appels API)
}
