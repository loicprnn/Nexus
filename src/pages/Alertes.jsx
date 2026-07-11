import { useState } from 'react'
import { IconBell, IconTrash, IconPlus, IconSend } from '@tabler/icons-react'
import PageContainer from '../components/ui/PageContainer'
import { useAlertsContext } from '../contexts/AlertsContext'
import { useToast } from '../contexts/ToastContext'
import { sendAlertWebhook } from '../lib/api/alertRelay'
import { ALERT_TYPES, DIRECTIONS, describeAlert } from '../lib/alerts'
import { TRADABLE_UNIVERSE } from '../lib/api/symbols'

function CreateAlertForm({ onCreate }) {
  const [type, setType] = useState('price')
  const [symbol, setSymbol] = useState(TRADABLE_UNIVERSE[0].symbol)
  const [direction, setDirection] = useState('above')
  const [threshold, setThreshold] = useState('')
  const [busy, setBusy] = useState(false)

  const meta = ALERT_TYPES[type]

  async function submit(e) {
    e.preventDefault()
    const value = Number(threshold)
    if (!Number.isFinite(value)) return
    setBusy(true)
    const sym = TRADABLE_UNIVERSE.find((t) => t.symbol === symbol)
    const config = {
      threshold: value,
      ...(meta.needsSymbol ? { symbol, label: sym?.name ?? symbol } : {}),
      ...(type !== 'change' ? { direction } : {}),
    }
    try {
      await onCreate({ type, config })
      setThreshold('')
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'rounded-card border-hairline border-border bg-bg px-3 py-2 text-[13px] text-primary outline-none focus:border-accent'

  return (
    <form onSubmit={submit} className="nexus-card p-6">
      <h2 className="text-[15px] font-semibold">Nouvelle alerte</h2>
      <p className="mt-1 text-[12px] text-secondary">{meta.hint}</p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] text-secondary">Type</span>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(ALERT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>

        {meta.needsSymbol && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-secondary">Actif</span>
            <select className={inputCls} value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {TRADABLE_UNIVERSE.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.name} ({t.symbol})
                </option>
              ))}
            </select>
          </label>
        )}

        {type !== 'change' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-secondary">Condition</span>
            <select
              className={inputCls}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              {Object.entries(DIRECTIONS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] text-secondary">
            Seuil {type === 'change' ? '(± %)' : `(${meta.unit})`}
          </span>
          <input
            className={`${inputCls} w-28`}
            type="number"
            step="any"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={type === 'change' ? '5' : '0'}
            required
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-1.5 rounded-card bg-accent px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <IconPlus size={16} stroke={2} />
          Créer
        </button>
      </div>
    </form>
  )
}

function AlertRow({ alert, onToggle, onRemove, onTest }) {
  return (
    <div className="flex items-center gap-3 border-b-hairline border-border px-4 py-3 last:border-0">
      <IconBell
        size={18}
        stroke={1.5}
        className={alert.active ? 'shrink-0 text-accent' : 'shrink-0 text-secondary'}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-primary">{describeAlert(alert)}</p>
        <p className="text-[11px] text-secondary">
          {ALERT_TYPES[alert.type]?.label ?? alert.type}
          {alert.active ? '' : ' · en pause'}
        </p>
      </div>
      <button
        onClick={() => onTest(alert)}
        className="shrink-0 text-secondary transition-colors hover:text-accent"
        title="Tester l’envoi"
      >
        <IconSend size={17} stroke={1.5} />
      </button>
      <label className="relative inline-flex shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={alert.active}
          onChange={(e) => onToggle(alert.id, e.target.checked)}
        />
        <div className="h-5 w-9 rounded-full bg-border transition-colors peer-checked:bg-accent" />
        <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
      </label>
      <button
        onClick={() => onRemove(alert.id)}
        className="shrink-0 text-secondary transition-colors hover:text-down"
        title="Supprimer"
      >
        <IconTrash size={17} stroke={1.5} />
      </button>
    </div>
  )
}

export default function Alertes() {
  const { alerts, loading, create, toggle, remove } = useAlertsContext()
  const { notify } = useToast()

  async function test(alert) {
    const message = `${describeAlert(alert)} — test manuel.`
    const { delivered, reason } = await sendAlertWebhook({
      title: 'Test alerte Nexus',
      message,
      alert,
    })
    notify({
      title: delivered ? 'Webhook Make.com envoyé' : 'Notification locale',
      message: delivered
        ? message
        : `${message} (relais externe inactif : ${reason ?? 'non configuré'})`,
      tone: 'alert',
    })
  }

  return (
    <PageContainer
      title="Alertes"
      description="Surveille un signal de marché et reçois une notification dans l’app et par Make.com (e-mail, push…) quand la condition est remplie."
    >
      <div className="space-y-5">
        <CreateAlertForm onCreate={create} />

        <div className="nexus-card overflow-hidden">
          <div className="border-b-hairline border-border px-4 py-3">
            <h2 className="text-[14px] font-semibold">Mes alertes</h2>
          </div>
          {loading ? (
            <p className="px-4 py-6 text-[13px] text-secondary">Chargement…</p>
          ) : alerts.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-secondary">
              Aucune alerte pour l’instant. Crée-en une ci-dessus.
            </p>
          ) : (
            alerts.map((a) => (
              <AlertRow
                key={a.id}
                alert={a}
                onToggle={toggle}
                onRemove={remove}
                onTest={test}
              />
            ))
          )}
        </div>
      </div>
    </PageContainer>
  )
}
