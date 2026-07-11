import {
  IconLayoutDashboard,
  IconChartLine,
  IconWallet,
  IconMessageCircle,
  IconWorld,
  IconBuildingBank,
  IconActivity,
  IconMoodSmile,
  IconArrowsDiff,
  IconCalendarEvent,
  IconBell,
  IconSettings,
} from '@tabler/icons-react'

// Bottom bar — 4 primary tabs. Order defines left-to-right slide direction.
export const BOTTOM_TABS = [
  { to: '/', label: 'Dashboard', icon: IconLayoutDashboard, end: true },
  { to: '/analyse', label: 'Analyse', icon: IconChartLine },
  { to: '/paper-trading', label: 'Paper Trading', icon: IconWallet },
  { to: '/coach', label: 'Nexus Coach', icon: IconMessageCircle },
]

// Left sidebar — secondary navigation.
export const SIDEBAR_ITEMS = [
  { to: '/markets', label: 'Markets', icon: IconWorld },
  { to: '/macro', label: 'Macro', icon: IconBuildingBank },
  { to: '/indicateurs', label: 'Indicateurs avancés', icon: IconActivity },
  { to: '/sentiment', label: 'Sentiment', icon: IconMoodSmile },
  { to: '/comparer', label: 'Comparer', icon: IconArrowsDiff },
  { to: '/calendrier', label: 'Calendrier', icon: IconCalendarEvent },
  { to: '/alertes', label: 'Alertes', icon: IconBell },
  { to: '/parametres', label: 'Paramètres', icon: IconSettings },
]

// Flat order of every navigable route, used to compute slide direction
// for Framer Motion page transitions.
export const ROUTE_ORDER = [
  '/',
  '/analyse',
  '/paper-trading',
  '/coach',
  '/markets',
  '/macro',
  '/indicateurs',
  '/sentiment',
  '/comparer',
  '/calendrier',
  '/alertes',
  '/parametres',
]
