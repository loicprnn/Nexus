import { supabase } from './supabase'
import { SYMBOL_NAMES } from './api/symbols'

// Paper-trading engine + persistence (étape 7).
//
// The TRADE JOURNAL is the source of truth: positions, average cost and P&L are
// all DERIVED from the ordered list of buys/sells (see derivePositions). Cash is
// also tracked explicitly so the available balance is O(1).
//
// Two backends, mirroring lib/dashboard.js:
//   - authenticated  -> Supabase (public.paper_accounts + public.paper_trades, RLS)
//   - no user (demo) -> localStorage
//
// Money is kept in a single nominal base (CHF, per the spec's "100'000 CHF").
// Tradable instruments are all USD-listed, so real market prices are used 1:1 as
// the cost basis — a deliberate simplification (no live FX conversion).

export const INITIAL_CASH = 100000
export const BASE_CURRENCY = 'CHF'

const LS_KEY = 'nexus.paper'
const LS_BENCH_KEY = 'nexus.paper.benchmark' // SPY price captured at inception
const BENCHMARK_SYMBOL = 'SPY'

const EPS = 1e-8

function nameFor(symbol) {
  return SYMBOL_NAMES[symbol] ?? symbol
}

// ---------------------------------------------------------------------------
// Pure derivations (no IO)
// ---------------------------------------------------------------------------

// Reduce the chronological trade journal into open positions keyed by symbol.
// Weighted-average cost basis; realised P&L accumulated on sells.
export function derivePositions(trades) {
  const bySymbol = {}
  for (const t of [...trades].sort((a, b) => new Date(a.ts) - new Date(b.ts))) {
    const p =
      bySymbol[t.symbol] ??
      (bySymbol[t.symbol] = {
        symbol: t.symbol,
        name: nameFor(t.symbol),
        qty: 0,
        avgPrice: 0,
        realizedPnl: 0,
      })
    if (t.side === 'buy') {
      const cost = p.avgPrice * p.qty + t.price * t.qty
      p.qty += t.qty
      p.avgPrice = p.qty > EPS ? cost / p.qty : 0
    } else {
      p.realizedPnl += (t.price - p.avgPrice) * t.qty
      p.qty -= t.qty
      if (p.qty < EPS) {
        p.qty = 0
        p.avgPrice = 0
      }
    }
  }
  return bySymbol
}

// Open positions (qty > 0) as an array.
export function openPositions(trades) {
  return Object.values(derivePositions(trades)).filter((p) => p.qty > EPS)
}

// Value the account against a { symbol -> { price, changePct } } map.
// Returns enriched positions plus portfolio-level totals.
export function valuate(cash, trades, priceMap = {}) {
  const positions = openPositions(trades).map((p) => {
    const price = priceMap[p.symbol]?.price ?? null
    const cost = p.qty * p.avgPrice
    const marketValue = price != null ? p.qty * price : null
    const pnl = marketValue != null ? marketValue - cost : null
    const pnlPct = pnl != null && cost > 0 ? (pnl / cost) * 100 : null
    return { ...p, price, cost, marketValue, pnl, pnlPct }
  })

  const holdingsValue = positions.reduce((s, p) => s + (p.marketValue ?? p.cost), 0)
  const equity = cash + holdingsValue
  const totalPnl = equity - INITIAL_CASH
  const totalPnlPct = (totalPnl / INITIAL_CASH) * 100
  const invested = positions.reduce((s, p) => s + p.cost, 0)

  return { positions, cash, holdingsValue, invested, equity, totalPnl, totalPnlPct }
}

// Validate a prospective order against cash / holdings. Returns an error string
// (French, for direct display) or null when the order is executable.
export function validateOrder({ side, symbol, qty, price, cash, trades }) {
  if (!symbol) return 'Sélectionnez un instrument'
  if (!qty || qty <= 0) return 'Quantité invalide'
  if (price == null || price <= 0) return 'Prix indisponible'
  if (side === 'buy') {
    if (qty * price > cash + EPS) return 'Solde insuffisant'
  } else {
    const pos = openPositions(trades).find((p) => p.symbol === symbol)
    if (!pos || qty > pos.qty + EPS) return 'Quantité détenue insuffisante'
  }
  return null
}

// ---------------------------------------------------------------------------
// Benchmark (vs S&P 500) — baseline SPY price captured locally at inception.
// ---------------------------------------------------------------------------

export function getBenchmarkStart() {
  const raw = Number(localStorage.getItem(LS_BENCH_KEY))
  return Number.isFinite(raw) && raw > 0 ? raw : null
}

// Record the baseline once, the first time a live SPY price is available.
export function ensureBenchmarkStart(spyPrice) {
  if (spyPrice == null || !(spyPrice > 0)) return getBenchmarkStart()
  const existing = getBenchmarkStart()
  if (existing) return existing
  try {
    localStorage.setItem(LS_BENCH_KEY, String(spyPrice))
  } catch {
    // ignore quota / private-mode
  }
  return spyPrice
}

export function clearBenchmarkStart() {
  try {
    localStorage.removeItem(LS_BENCH_KEY)
  } catch {
    // ignore
  }
}

export const BENCHMARK = { symbol: BENCHMARK_SYMBOL }

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function lsRead() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { cash: INITIAL_CASH, trades: [] }
    const parsed = JSON.parse(raw)
    return {
      cash: typeof parsed.cash === 'number' ? parsed.cash : INITIAL_CASH,
      trades: Array.isArray(parsed.trades) ? parsed.trades : [],
    }
  } catch {
    return { cash: INITIAL_CASH, trades: [] }
  }
}

function lsWrite(account) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(account))
  } catch {
    // ignore quota / private-mode
  }
}

// Load the account: { cash, trades:[{ id, ts, side, symbol, name, qty, price }] }.
export async function loadAccount(userId) {
  if (userId) {
    const [{ data: acc, error: accErr }, { data: rows, error: trErr }] = await Promise.all([
      supabase.from('paper_accounts').select('cash_balance').eq('user_id', userId).maybeSingle(),
      supabase
        .from('paper_trades')
        .select('id, symbol, side, quantity, price, executed_at')
        .eq('user_id', userId)
        .order('executed_at', { ascending: true }),
    ])
    if (accErr) throw accErr
    if (trErr) throw trErr
    const trades = (rows ?? []).map((r) => ({
      id: r.id,
      ts: r.executed_at,
      side: r.side,
      symbol: r.symbol,
      name: nameFor(r.symbol),
      qty: Number(r.quantity),
      price: Number(r.price),
    }))
    const cash = acc?.cash_balance != null ? Number(acc.cash_balance) : INITIAL_CASH
    return { cash, trades }
  }
  return lsRead()
}

// Execute a validated trade: append to the journal and adjust cash. Returns the
// updated account. Throws on a hard validation failure.
export async function recordTrade(userId, account, { side, symbol, qty, price }) {
  if (side !== 'buy' && side !== 'sell') throw new Error('Sens de transaction invalide')
  if (!(qty > 0)) throw new Error('Quantité invalide')
  if (!(price > 0)) throw new Error('Prix invalide')

  const positions = openPositions(account.trades)
  if (side === 'buy' && qty * price > account.cash + EPS) {
    throw new Error('Solde insuffisant')
  }
  if (side === 'sell') {
    const pos = positions.find((p) => p.symbol === symbol)
    if (!pos || qty > pos.qty + EPS) throw new Error('Quantité détenue insuffisante')
  }

  const proceeds = side === 'buy' ? -qty * price : qty * price
  const nextCash = account.cash + proceeds
  const ts = new Date().toISOString()

  if (userId) {
    const { data, error } = await supabase
      .from('paper_trades')
      .insert({ user_id: userId, symbol, side, quantity: qty, price, currency: BASE_CURRENCY })
      .select('id, executed_at')
      .single()
    if (error) throw error
    const { error: upErr } = await supabase
      .from('paper_accounts')
      .upsert({ user_id: userId, cash_balance: nextCash }, { onConflict: 'user_id' })
    if (upErr) throw upErr
    const trade = { id: data.id, ts: data.executed_at, side, symbol, name: nameFor(symbol), qty, price }
    return { cash: nextCash, trades: [...account.trades, trade] }
  }

  const trade = { id: `t_${Date.now()}`, ts, side, symbol, name: nameFor(symbol), qty, price }
  const next = { cash: nextCash, trades: [...account.trades, trade] }
  lsWrite(next)
  return next
}

// Wipe the account back to the starting cash with an empty journal.
export async function resetAccount(userId) {
  clearBenchmarkStart()
  if (userId) {
    const { error: delErr } = await supabase.from('paper_trades').delete().eq('user_id', userId)
    if (delErr) throw delErr
    const { error: upErr } = await supabase
      .from('paper_accounts')
      .upsert({ user_id: userId, cash_balance: INITIAL_CASH }, { onConflict: 'user_id' })
    if (upErr) throw upErr
    return { cash: INITIAL_CASH, trades: [] }
  }
  const fresh = { cash: INITIAL_CASH, trades: [] }
  lsWrite(fresh)
  return fresh
}
