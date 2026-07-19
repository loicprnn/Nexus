import { useEffect, useMemo, useState } from 'react'
import { IconRefresh } from '@tabler/icons-react'
import PageContainer from '../components/ui/PageContainer'
import PortfolioSummary from '../components/paper/PortfolioSummary'
import MonthlyPerformance from '../components/paper/MonthlyPerformance'
import TradeTicket from '../components/paper/TradeTicket'
import PositionsTable from '../components/paper/PositionsTable'
import TradeHistory from '../components/paper/TradeHistory'
import { useChunkedQuotes, useQuotes } from '../hooks/useMarketData'
import { useAuth } from '../contexts/AuthContext'
import { formatPrice } from '../lib/format'
import {
  loadAccount,
  recordTrade,
  resetAccount,
  valuate,
  openPositions,
  monthlyRealizedPnl,
  validateOrder,
  ensureBenchmarkStart,
  getBenchmarkStart,
  BENCHMARK,
} from '../lib/paperTrading'

export default function PaperTrading() {
  const { user } = useAuth()
  const userId = user?.id

  const [account, setAccount] = useState({ cash: 100000, trades: [] })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [side, setSide] = useState('buy')
  const [selected, setSelected] = useState('AAPL')
  const [qty, setQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [benchStart, setBenchStart] = useState(() => getBenchmarkStart())

  // Load the account (Supabase when signed in, else localStorage).
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadAccount(userId)
      .then((acc) => {
        if (!cancelled) {
          setAccount(acc)
          setLoadError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message || 'Chargement impossible')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [userId])

  // Live quotes: held positions + the S&P 500 benchmark (throttled/cached).
  const heldSymbols = useMemo(
    () => openPositions(account.trades).map((p) => p.symbol),
    [account.trades],
  )
  const valuationSymbols = useMemo(
    () => Array.from(new Set([BENCHMARK.symbol, ...heldSymbols])),
    [heldSymbols],
  )
  const { data: valData } = useChunkedQuotes(valuationSymbols, { chunkSize: 6 })

  // The currently-selected instrument's quote (single symbol, cached 15 min).
  const selectedSymbols = useMemo(() => (selected ? [selected] : []), [selected])
  const { data: selData } = useQuotes(selectedSymbols)

  const priceMap = useMemo(() => {
    const m = {}
    for (const q of valData ?? []) m[q.symbol] = q
    for (const q of selData ?? []) m[q.symbol] = q
    return m
  }, [valData, selData])

  const valuation = useMemo(
    () => valuate(account.cash, account.trades, priceMap),
    [account, priceMap],
  )

  // Capture the benchmark baseline the first time a live SPY price arrives.
  const spyNow = priceMap[BENCHMARK.symbol]?.price ?? null
  useEffect(() => {
    if (spyNow) setBenchStart(ensureBenchmarkStart(spyNow))
  }, [spyNow])
  const benchmarkPct = spyNow && benchStart ? (spyNow / benchStart - 1) * 100 : null
  const alpha = benchmarkPct != null ? valuation.totalPnlPct - benchmarkPct : null

  const monthlyPnl = useMemo(() => monthlyRealizedPnl(account.trades, 6), [account.trades])

  const selectedQuote = priceMap[selected]
  const selectedPrice = selectedQuote?.price ?? null
  const heldQty = useMemo(
    () => openPositions(account.trades).find((p) => p.symbol === selected)?.qty ?? 0,
    [account.trades, selected],
  )

  const orderError = validateOrder({
    side,
    symbol: selected,
    qty: Number(qty),
    price: selectedPrice,
    cash: account.cash,
    trades: account.trades,
  })

  const submitOrder = async () => {
    setNotice(null)
    setBusy(true)
    try {
      const next = await recordTrade(userId, account, {
        side,
        symbol: selected,
        qty: Number(qty),
        price: selectedPrice,
      })
      setAccount(next)
      setQty('')
      setNotice({
        type: 'success',
        text: `${side === 'buy' ? 'Achat' : 'Vente'} de ${qty} ${selected} à ${formatPrice(
          selectedPrice,
        )} exécuté.`,
      })
    } catch (e) {
      setNotice({ type: 'error', text: e.message || 'Échec de la transaction.' })
    } finally {
      setBusy(false)
    }
  }

  const quickSell = (position) => {
    setSide('sell')
    setSelected(position.symbol)
    setQty(String(position.qty))
    setNotice(null)
  }

  const doReset = async () => {
    setBusy(true)
    try {
      const fresh = await resetAccount(userId)
      setAccount(fresh)
      setBenchStart(null)
      setConfirmReset(false)
      setNotice({ type: 'success', text: 'Portefeuille réinitialisé à 100’000.' })
    } catch (e) {
      setNotice({ type: 'error', text: e.message || 'Réinitialisation impossible.' })
    } finally {
      setBusy(false)
    }
  }

  const resetAction = confirmReset ? (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-secondary">Réinitialiser&nbsp;?</span>
      <button
        type="button"
        onClick={doReset}
        disabled={busy}
        className="rounded-[10px] bg-down/90 px-3 py-1.5 text-[12px] text-white hover:bg-down disabled:opacity-40"
      >
        Confirmer
      </button>
      <button
        type="button"
        onClick={() => setConfirmReset(false)}
        className="rounded-[10px] px-3 py-1.5 text-[12px] text-secondary hover:text-primary"
      >
        Annuler
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setConfirmReset(true)}
      className="inline-flex items-center gap-1.5 nexus-card px-3 py-1.5 text-[13px] text-secondary transition-colors hover:text-primary"
    >
      <IconRefresh size={15} stroke={1.5} />
      Réinitialiser
    </button>
  )

  return (
    <PageContainer
      title="Paper Trading"
      description="Portefeuille fictif de 100’000 CHF aux prix réels. Achetez et vendez, suivez votre P&L en direct et comparez-vous au S&P 500."
      actions={resetAction}
    >
      {loadError && (
        <div className="mb-3 rounded-card border-hairline border-down/40 bg-down/10 px-4 py-2 text-[12px] text-down">
          {loadError}
        </div>
      )}

      <PortfolioSummary
        equity={valuation.equity}
        totalPnl={valuation.totalPnl}
        totalPnlPct={valuation.totalPnlPct}
        cash={valuation.cash}
        benchmarkPct={benchmarkPct}
        alpha={alpha}
      />

      <div className="mt-3">
        <MonthlyPerformance data={monthlyPnl} />
      </div>

      {notice && (
        <div
          className={`mt-3 rounded-card border-hairline px-4 py-2 text-[12px] ${
            notice.type === 'success'
              ? 'border-up/40 bg-up/10 text-up'
              : 'border-down/40 bg-down/10 text-down'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <TradeTicket
            selected={selected}
            onSelect={setSelected}
            quote={selectedQuote}
            side={side}
            onSideChange={setSide}
            qty={qty}
            onQtyChange={setQty}
            onSubmit={submitOrder}
            error={qty ? orderError : null}
            busy={busy}
            cash={account.cash}
            heldQty={heldQty}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h2 className="mb-2 text-[13px] font-semibold text-primary">Positions</h2>
            <PositionsTable positions={valuation.positions} onQuickSell={quickSell} />
          </div>
          <div>
            <h2 className="mb-2 text-[13px] font-semibold text-primary">Historique</h2>
            <TradeHistory trades={account.trades} />
          </div>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-secondary">
        Simulation pédagogique. Prix réels via Twelve Data (instruments cotés aux États-Unis, en
        USD) utilisés tels quels comme base de coût — aucune conversion de change.
        {loading && ' Chargement du compte…'}
      </p>
    </PageContainer>
  )
}
