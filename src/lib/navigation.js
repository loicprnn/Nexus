import {
  IconLayoutDashboard,
  IconChartLine,
  IconWallet,
  IconMessageCircle,
  IconBuildingBank,
  IconActivity,
  IconMoodSmile,
  IconArrowsDiff,
  IconCalendarEvent,
  IconBell,
  IconSettings,
} from '@tabler/icons-react'

// Sidebar group 1 — "Principal" (also used as the mobile bottom bar). These are
// the highlighted, primary destinations.
export const PRIMARY_NAV = [
  { to: '/', label: 'Dashboard', icon: IconLayoutDashboard, end: true },
  { to: '/analyse', label: 'Analyse', icon: IconChartLine },
  { to: '/paper-trading', label: 'Paper Trading', icon: IconWallet },
  { to: '/coach', label: 'Nexus Coach', icon: IconMessageCircle },
]

// Sidebar group 2 — "Marchés" (secondary, analytical destinations).
export const MARKETS_NAV = [
  { to: '/macro', label: 'Macro', icon: IconBuildingBank },
  { to: '/indicateurs', label: 'Indicateurs avancés', icon: IconActivity },
  { to: '/sentiment', label: 'Sentiment', icon: IconMoodSmile },
  { to: '/comparer', label: 'Comparer', icon: IconArrowsDiff },
  { to: '/calendrier', label: 'Calendrier', icon: IconCalendarEvent },
  { to: '/alertes', label: 'Alertes', icon: IconBell },
]

// Settings sits alone at the very bottom of the sidebar.
export const SETTINGS_NAV = { to: '/parametres', label: 'Paramètres', icon: IconSettings }

// Mobile bottom bar = the primary group.
export const BOTTOM_TABS = PRIMARY_NAV

// Flat order of every navigable route, used to compute slide direction
// for Framer Motion page transitions.
export const ROUTE_ORDER = [
  '/',
  '/analyse',
  '/paper-trading',
  '/coach',
  '/macro',
  '/indicateurs',
  '/sentiment',
  '/comparer',
  '/calendrier',
  '/alertes',
  '/parametres',
]
