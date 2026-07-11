import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BOTTOM_TABS } from '../../lib/navigation'

// Bottom bar — 4 primary tabs, fixed at the bottom on every page.
// Active indicator: thin blue line above the icon.
export default function BottomBar() {
  return (
    <nav className="flex h-16 shrink-0 items-stretch border-t-hairline border-border bg-card">
      {BOTTOM_TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className="relative flex flex-1 flex-col items-center justify-center gap-1"
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.div
                  layoutId="bottombar-indicator"
                  className="absolute top-0 h-[2px] w-10 rounded-full bg-accent"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <Icon
                size={22}
                stroke={1.5}
                className={isActive ? 'text-primary' : 'text-secondary'}
              />
              <span
                className={[
                  'text-[10px]',
                  isActive ? 'text-primary' : 'text-secondary',
                ].join(' ')}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
