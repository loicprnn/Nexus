import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  IconX,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from '@tabler/icons-react'
import { AnimatePresence, motion } from 'framer-motion'
import { PRIMARY_NAV, MARKETS_NAV, SETTINGS_NAV } from '../../lib/navigation'
import Logo from '../ui/Logo'

const STORAGE_KEY = 'nexus.sidebar.collapsed'
const RAIL = 60 // collapsed width (icons only)
const PANEL = 240 // expanded width (icons + labels)
const ACTIVE = '#F59E0B' // orange — active nav highlight

// Reactive media query (desktop rail vs mobile drawer).
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// Label that fades/slides in when the rail is expanded.
function ItemLabel({ children }) {
  return (
    <motion.span
      className="overflow-hidden whitespace-nowrap"
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -4 }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.span>
  )
}

// A single navigation item. `primary` items (the top group) are slightly larger
// and brighter than the secondary "Marchés" group. Active = orange tint bg +
// orange 3px left border + orange icon/label.
function NavItem({ item, expanded, onClose, primary = false }) {
  const { to, label, icon: Icon, end } = item
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClose}
      title={expanded ? undefined : label}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-card border-l-[3px] px-3 transition-colors',
          primary ? 'py-2.5 text-[14px]' : 'py-2 text-[13px]',
          expanded ? 'justify-start' : 'justify-center',
          isActive
            ? 'border-[#F97316] bg-[#FFF4EE] text-[#F97316]'
            : primary
              ? 'border-transparent text-primary hover:bg-hover'
              : 'border-transparent text-secondary hover:bg-hover hover:text-primary',
        ].join(' ')
      }
    >
      <Icon size={primary ? 21 : 20} stroke={1.5} className="shrink-0" />
      <AnimatePresence initial={false}>
        {expanded && <ItemLabel key="label">{label}</ItemLabel>}
      </AnimatePresence>
    </NavLink>
  )
}

// Small uppercase section label — only shown when the rail is expanded.
function SectionLabel({ children, expanded }) {
  if (!expanded) return null
  return (
    <p className="px-3 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#AAAAAA]">
      {children}
    </p>
  )
}

// Left sidebar — two grouped sections (Principal / Marchés) + Paramètres pinned
// at the bottom. Desktop: a collapsible rail (persisted in localStorage). Mobile:
// a slide-over drawer driven by `mobileOpen`.
export default function Sidebar({ mobileOpen, onClose }) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved == null ? true : saved === 'true'
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed))
    } catch {
      // private mode / quota — non-fatal
    }
  }, [collapsed])

  const expanded = isDesktop ? !collapsed : true
  const width = isDesktop ? (collapsed ? RAIL : PANEL) : PANEL

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} />
      )}

      <motion.aside
        initial={false}
        animate={{ width }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        style={{ backgroundColor: '#FFFFFF' }}
        className={[
          'z-40 flex shrink-0 flex-col overflow-hidden border-r border-border',
          'md:relative md:translate-x-0',
          'fixed inset-y-0 left-0 transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Header: brand + collapse toggle / mobile close */}
        <div className="flex h-14 shrink-0 items-center gap-2 px-3.5">
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.span
                key="brand"
                className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-[15px] font-semibold tracking-wide text-primary"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.15 }}
              >
                <Logo size={24} className="shrink-0" />
                NEXUS
              </motion.span>
            )}
          </AnimatePresence>

          <button
            onClick={() => setCollapsed((v) => !v)}
            className={[
              'hidden shrink-0 text-secondary transition-colors hover:text-primary md:inline-flex',
              expanded ? 'ml-auto' : 'mx-auto',
            ].join(' ')}
            aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
            title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
          >
            {collapsed ? (
              <IconLayoutSidebarLeftExpand size={20} stroke={1.5} />
            ) : (
              <IconLayoutSidebarLeftCollapse size={20} stroke={1.5} />
            )}
          </button>

          <button
            onClick={onClose}
            className="ml-auto shrink-0 text-secondary hover:text-primary md:hidden"
            aria-label="Fermer le menu"
          >
            <IconX size={20} stroke={1.5} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-2 py-2">
          {/* Group 1 — Principal */}
          <SectionLabel expanded={expanded}>Principal</SectionLabel>
          <div className="flex flex-col gap-1">
            {PRIMARY_NAV.map((item) => (
              <NavItem key={item.to} item={item} expanded={expanded} onClose={onClose} primary />
            ))}
          </div>

          {/* Separator */}
          <div className="my-2.5 border-t-hairline border-border" />

          {/* Group 2 — Marchés */}
          <SectionLabel expanded={expanded}>Marchés</SectionLabel>
          <div className="flex flex-col gap-1">
            {MARKETS_NAV.map((item) => (
              <NavItem key={item.to} item={item} expanded={expanded} onClose={onClose} />
            ))}
          </div>

          {/* Settings pinned at the very bottom */}
          <div className="mt-auto">
            <div className="my-2.5 border-t-hairline border-border" />
            <NavItem item={SETTINGS_NAV} expanded={expanded} onClose={onClose} />
          </div>
        </nav>
      </motion.aside>
    </>
  )
}
