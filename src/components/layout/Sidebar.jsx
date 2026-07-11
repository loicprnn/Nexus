import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  IconX,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from '@tabler/icons-react'
import { AnimatePresence, motion } from 'framer-motion'
import { SIDEBAR_ITEMS } from '../../lib/navigation'
import Logo from '../ui/Logo'

const STORAGE_KEY = 'nexus.sidebar.collapsed'
const RAIL = 60 // collapsed width (icons only)
const PANEL = 240 // expanded width (icons + labels)

// Reactive media query (used to know when we're on the desktop/tablet layout
// where the rail collapses, vs the mobile slide-over drawer).
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

// Left sidebar — secondary navigation.
// Desktop/tablet: a collapsible rail. Closed by default (60px, icons only);
// a toggle expands it to 240px (icons + labels). The open/closed state persists
// in localStorage. Mobile: a fixed slide-over drawer (always labelled), driven
// by `mobileOpen` from the layout's hamburger.
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
      // private mode / quota — non-fatal, just won't persist
    }
  }, [collapsed])

  // On mobile the drawer is always fully labelled; only the desktop rail
  // collapses.
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
        style={{ backgroundColor: '#050F08' }}
        className={[
          'z-40 flex shrink-0 flex-col overflow-hidden border-r-hairline border-border',
          // Desktop / tablet: in-flow column
          'md:relative md:translate-x-0',
          // Mobile: fixed slide-over drawer
          'fixed inset-y-0 left-0 transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 px-3.5">
          {/* Brand (logo + wordmark) — shown when expanded or on the mobile drawer */}
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

          {/* Desktop collapse/expand toggle — centered alone on the collapsed rail */}
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

          {/* Mobile close */}
          <button
            onClick={onClose}
            className="ml-auto shrink-0 text-secondary hover:text-primary md:hidden"
            aria-label="Fermer le menu"
          >
            <IconX size={20} stroke={1.5} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-2 py-2">
          {SIDEBAR_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              title={expanded ? undefined : label}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-card border-l-[3px] px-3 py-2.5 text-[13px] transition-colors',
                  expanded ? 'justify-start' : 'justify-center',
                  isActive
                    ? 'border-[#10B981] bg-[#0D2818] text-primary'
                    : 'border-transparent text-secondary hover:bg-hover hover:text-primary',
                ].join(' ')
              }
            >
              <Icon size={20} stroke={1.5} className="shrink-0" />
              <AnimatePresence initial={false}>
                {expanded && <ItemLabel key="label">{label}</ItemLabel>}
              </AnimatePresence>
            </NavLink>
          ))}
        </nav>
      </motion.aside>
    </>
  )
}
