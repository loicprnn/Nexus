import { useEffect, useRef, useState } from 'react'
import { IconArrowUp, IconSparkles } from '@tabler/icons-react'
import PageContainer from '../components/ui/PageContainer'
import { getCoachReply } from '../lib/api/claude'
import { useFearGreed, useQuotes, useIndicator } from '../hooks/useMarketData'

// Starter prompts shown on the empty state to guide first-time use.
const SUGGESTIONS = [
  'Explique-moi l’indice Fear & Greed et comment l’interpréter.',
  'Que signifie une courbe des taux inversée ?',
  'Commente le contexte de marché actuel.',
  'Quelle est la différence entre VIX et volatilité réalisée ?',
]

function Bubble({ role, content }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? 'max-w-[80%] rounded-card bg-accent px-3.5 py-2.5 text-[13px] leading-relaxed text-white'
            : 'max-w-[80%] whitespace-pre-wrap nexus-card px-3.5 py-2.5 text-[13px] leading-relaxed text-primary'
        }
      >
        {content}
      </div>
    </div>
  )
}

export default function NexusCoach() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  // Live market context injected into the coach's system prompt.
  const fg = useFearGreed()
  const vix = useQuotes(['^VIX'])
  const curve = useIndicator('T10Y2Y')
  const marketContext = {
    fearGreed: fg.data,
    vix: vix.data?.[0],
    curve: curve.data,
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, pending])

  async function send(text) {
    const content = text.trim()
    if (!content || pending) return
    setError(null)
    setInput('')
    const history = [...messages, { role: 'user', content }]
    setMessages(history)
    setPending(true)
    try {
      const reply = await getCoachReply({ history, marketContext })
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(err.message || 'Le coach est momentanément indisponible.')
    } finally {
      setPending(false)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const empty = messages.length === 0

  return (
    <PageContainer
      title="Nexus Coach"
      description="Coach IA Claude avec le contexte marché en temps réel. Information éducative — pas de conseil d’investissement personnalisé."
    >
      <div className="flex h-[calc(100vh-220px)] min-h-[420px] flex-col">
        {/* Fil de conversation */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto rounded-card border-hairline border-border bg-bg p-4"
        >
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-hairline border-border bg-card">
                <IconSparkles size={22} stroke={1.5} className="text-accent" />
              </div>
              <p className="max-w-md text-[13px] text-secondary">
                Posez une question sur les marchés, les indicateurs ou un concept
                financier. Le coach s’appuie sur les données en temps réel de Nexus.
              </p>
              <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="nexus-card px-3 py-2.5 text-left text-[12px] text-secondary transition-colors hover:bg-hover hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)
          )}

          {pending && (
            <div className="flex justify-start">
              <div className="nexus-card px-3.5 py-2.5 text-[13px] text-secondary">
                Le coach réfléchit…
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start">
              <div className="rounded-card border-hairline border-down/40 bg-card px-3.5 py-2.5 text-[13px] text-down">
                {error}
              </div>
            </div>
          )}
        </div>

        {/* Barre de saisie */}
        <div className="mt-3 flex items-end gap-2 nexus-card p-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Posez votre question…"
            className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-primary placeholder:text-secondary focus:outline-none"
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={pending || !input.trim()}
            aria-label="Envoyer"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity disabled:opacity-30"
          >
            <IconArrowUp size={18} stroke={2} />
          </button>
        </div>
        <p className="mt-2 text-[11px] text-secondary">
          Information éducative générée par Claude. Ne constitue pas un conseil en
          investissement.
        </p>
      </div>
    </PageContainer>
  )
}
