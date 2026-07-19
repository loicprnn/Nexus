import { useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { IconMenu2 } from '@tabler/icons-react'
import TickerBand from './TickerBand'
import Sidebar from './Sidebar'
import BottomBar from './BottomBar'
import Logo from '../ui/Logo'
import ParticleBackground from '../ui/ParticleBackground'
import { AlertsProvider } from '../../contexts/AlertsContext'
import { ROUTE_ORDER } from '../../lib/navigation'

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
}

function routeIndex(pathname) {
  // Match the longest known prefix so nested routes keep a stable index.
  let best = 0
  ROUTE_ORDER.forEach((route, i) => {
    if (route === '/') return
    if (pathname === route || pathname.startsWith(route + '/')) best = i
  })
  if (pathname === '/') return 0
  return best
}

export default function AppLayout() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const prevIndex = useRef(0)

  const currentIndex = routeIndex(location.pathname)
  const direction = currentIndex >= prevIndex.current ? 1 : -1
  prevIndex.current = currentIndex

  return (
    <AlertsProvider>
    <div className="relative flex h-screen flex-col overflow-hidden bg-bg text-primary">
      {/* Ambient particle field — fixed layer behind everything, non-interactive. */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <ParticleBackground />
      </div>

      <div className="relative z-10">
        <TickerBand />
      </div>

      <div className="relative z-10 flex flex-1 overflow-hidden">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile top bar with hamburger */}
          <div className="flex h-12 shrink-0 items-center gap-3 border-b-hairline border-border px-4 md:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-secondary hover:text-primary"
              aria-label="Ouvrir le menu"
            >
              <IconMenu2 size={22} stroke={1.5} />
            </button>
            <span className="flex items-center gap-2 text-[15px] font-semibold tracking-wide">
              <Logo size={20} />
              NEXUS
            </span>
          </div>

          <main className="relative flex-1 overflow-hidden">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={location.pathname}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="absolute inset-0 overflow-y-auto"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Bottom bar: mobile only — desktop uses the sidebar's Principal group */}
      <div className="relative z-10 md:hidden">
        <BottomBar />
      </div>
    </div>
    </AlertsProvider>
  )
}
