import { createContext, useContext } from 'react'
import { useAlerts, useAlertMonitor } from '../hooks/useAlerts'
import { useToast } from './ToastContext'
import { sendAlertWebhook } from '../lib/api/alertRelay'

// Shares one alerts store across the protected app AND runs the live monitor in
// a single place, so a triggered alert fires exactly one toast + Make.com relay
// regardless of which page is open (and newly created alerts are watched at
// once, since the page and the monitor read the same state).

const AlertsContext = createContext(null)

export function AlertsProvider({ children }) {
  const api = useAlerts()
  const { notify } = useToast()

  useAlertMonitor(api.alerts, async (alert, message) => {
    notify({ title: 'Alerte déclenchée', message, tone: 'alert' })
    await sendAlertWebhook({ title: 'Alerte Nexus', message, alert })
  })

  return <AlertsContext.Provider value={api}>{children}</AlertsContext.Provider>
}

export function useAlertsContext() {
  const ctx = useContext(AlertsContext)
  if (!ctx) throw new Error('useAlertsContext doit être utilisé dans <AlertsProvider>')
  return ctx
}
