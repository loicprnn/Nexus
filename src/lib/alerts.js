import { supabase } from './supabase'

// Custom alerts (étape 9). An alert watches one live signal and fires when its
// condition is met; firing shows an in-app toast AND relays to a Make.com
// scenario (email/push/…) through the secure /api/alert proxy.
//
// Two backends, mirroring lib/dashboard.js & lib/paperTrading.js:
//   - authenticated  -> Supabase (public.alerts, RLS-protected)
//   - no user (demo) -> localStorage ('nexus.alerts')
//
// The Supabase row shape is { id, user_id, type, config jsonb, active, created_at }.
// `config` carries everything type-specific (symbol, direction, threshold, label).

const LS_KEY = 'nexus.alerts'

// --- Alert type catalog --------------------------------------------------

export const ALERT_TYPES = {
  price: {
    label: 'Prix d’un actif',
    needsSymbol: true,
    unit: '$',
    hint: 'Se déclenche quand le cours franchit un seuil.',
  },
  change: {
    label: 'Variation journalière',
    needsSymbol: true,
    unit: '%',
    hint: 'Se déclenche quand la variation du jour dépasse ±X %.',
  },
  vix: {
    label: 'VIX (volatilité)',
    needsSymbol: false,
    unit: 'pts',
    hint: 'Se déclenche quand le VIX franchit un seuil.',
  },
}

export const DIRECTIONS = {
  above: 'au-dessus de',
  below: 'en dessous de',
}

// --- Pure helpers (no IO) ------------------------------------------------

// Human-readable one-liner for an alert (used in the list and notifications).
export function describeAlert(alert) {
  const { type, config } = alert
  const meta = ALERT_TYPES[type]
  if (!meta) return 'Alerte'
  if (type === 'change') {
    return `${config.label ?? config.symbol} · variation du jour ≥ ±${config.threshold} %`
  }
  const dir = DIRECTIONS[config.direction] ?? '≥'
  const subject =
    type === 'vix' ? 'VIX' : `${config.label ?? config.symbol}`
  return `${subject} ${dir} ${config.threshold} ${meta.unit}`
}

// Evaluate an alert against a live context and return whether it is currently
// satisfied, plus the observed value and a notification message.
//   ctx = { quotes: { SYM: { price, changePct } }, vix: number|null }
export function evaluateAlert(alert, ctx) {
  const { type, config } = alert
  let value = null

  if (type === 'price') value = ctx.quotes?.[config.symbol]?.price ?? null
  else if (type === 'change') value = ctx.quotes?.[config.symbol]?.changePct ?? null
  else if (type === 'vix') value = ctx.vix ?? null

  if (value == null) return { triggered: false, value: null, message: '' }

  let triggered = false
  if (type === 'change') {
    triggered = Math.abs(value) >= Number(config.threshold)
  } else if (config.direction === 'below') {
    triggered = value <= Number(config.threshold)
  } else {
    triggered = value >= Number(config.threshold)
  }

  const meta = ALERT_TYPES[type]
  const shown =
    type === 'change'
      ? `${value > 0 ? '+' : ''}${value.toFixed(2)} %`
      : `${value.toFixed(2)} ${meta.unit}`
  const message = `${describeAlert(alert)} — valeur actuelle ${shown}.`
  return { triggered, value, message }
}

// Collect the distinct symbols a set of alerts needs live quotes for.
export function alertSymbols(alerts) {
  const set = new Set()
  for (const a of alerts) {
    if ((a.type === 'price' || a.type === 'change') && a.config?.symbol) {
      set.add(a.config.symbol)
    }
  }
  return [...set]
}

// --- Persistence ---------------------------------------------------------

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeLocal(alerts) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(alerts))
  } catch {
    // ignore quota / private-mode errors
  }
}

export async function loadAlerts(userId) {
  if (userId) {
    const { data, error } = await supabase
      .from('alerts')
      .select('id, type, config, active, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }
  return readLocal()
}

export async function createAlert(userId, { type, config }) {
  if (userId) {
    const { data, error } = await supabase
      .from('alerts')
      .insert({ user_id: userId, type, config, active: true })
      .select('id, type, config, active, created_at')
      .single()
    if (error) throw error
    return data
  }
  const alert = {
    id: crypto.randomUUID(),
    type,
    config,
    active: true,
    created_at: new Date().toISOString(),
  }
  const next = [alert, ...readLocal()]
  writeLocal(next)
  return alert
}

export async function setAlertActive(userId, id, active) {
  if (userId) {
    const { error } = await supabase.from('alerts').update({ active }).eq('id', id)
    if (error) throw error
    return
  }
  writeLocal(readLocal().map((a) => (a.id === id ? { ...a, active } : a)))
}

export async function deleteAlert(userId, id) {
  if (userId) {
    const { error } = await supabase.from('alerts').delete().eq('id', id)
    if (error) throw error
    return
  }
  writeLocal(readLocal().filter((a) => a.id !== id))
}
