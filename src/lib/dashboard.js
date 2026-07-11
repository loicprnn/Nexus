import { supabase } from './supabase'

// Persistence for the modular dashboard.
// `widgets`: [{ i, type }]  — which widget instances are on the board.
// `layouts`: { lg: [{ i, x, y, w, h }], ... } — React Grid Layout responsive layouts.
// Stored in public.dashboard_layouts (one row per user, RLS-protected).

const STORAGE_KEY = 'nexus.dashboard'

export async function loadDashboard(userId) {
  if (userId) {
    const { data, error } = await supabase
      .from('dashboard_layouts')
      .select('layout, widgets')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    if (data && Array.isArray(data.widgets) && data.widgets.length) {
      return { widgets: data.widgets, layouts: data.layout ?? {} }
    }
    return null
  }

  // No authenticated user (e.g. local/demo): fall back to localStorage.
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function saveDashboard(userId, { widgets, layouts }) {
  if (userId) {
    const { error } = await supabase.from('dashboard_layouts').upsert(
      {
        user_id: userId,
        widgets,
        layout: layouts,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (error) throw error
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ widgets, layouts }))
  } catch {
    // ignore quota / private-mode errors
  }
}
