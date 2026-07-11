import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { IconBell, IconX } from '@tabler/icons-react'

// Lightweight app-wide toast notifications. Used by the alert monitor to surface
// triggered alerts, but generic enough for any transient message. Toasts stack
// at the top-right and auto-dismiss.

const ToastContext = createContext(null)

const AUTO_DISMISS_MS = 9000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  const notify = useCallback(
    ({ title, message, tone = 'info' }) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, title, message, tone }])
      timers.current[id] = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
      return id
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ notify, dismiss }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-card border-hairline border-border bg-card p-3.5"
          >
            <IconBell
              size={18}
              stroke={1.5}
              className={t.tone === 'alert' ? 'mt-0.5 shrink-0 text-accent' : 'mt-0.5 shrink-0 text-secondary'}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-primary">{t.title}</p>
              {t.message && (
                <p className="mt-0.5 text-[12px] leading-snug text-secondary">{t.message}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-secondary transition-colors hover:text-primary"
              aria-label="Fermer"
            >
              <IconX size={16} stroke={1.5} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>')
  return ctx
}
