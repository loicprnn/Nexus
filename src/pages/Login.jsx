import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Logo from '../components/ui/Logo'

export default function Login() {
  const { signInWithPassword, signUpWithPassword, isConfigured } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (!isConfigured) {
      setError('Supabase non configuré. Renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.')
      return
    }

    setBusy(true)
    const fn = mode === 'signin' ? signInWithPassword : signUpWithPassword
    const { data, error: authError } = await fn(email, password)
    setBusy(false)

    if (authError) {
      setError(authError.message)
      return
    }

    if (mode === 'signup' && !data.session) {
      setInfo('Compte créé. Vérifie ta boîte mail pour confirmer ton adresse.')
      return
    }

    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={44} className="mb-3 text-primary" />
          <h1 className="text-[28px] font-semibold tracking-wide">NEXUS</h1>
          <p className="mt-1 text-[13px] text-secondary">
            Moteur d'analyse financière
          </p>
        </div>

        <div className="nexus-card p-6">
          <div className="mb-5 flex rounded-card border-hairline border-border p-1">
            {['signin', 'signup'].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m)
                  setError(null)
                  setInfo(null)
                }}
                className={[
                  'flex-1 rounded-[12px] py-1.5 text-[13px] transition-colors',
                  mode === m ? 'bg-hover text-primary' : 'text-secondary',
                ].join(' ')}
              >
                {m === 'signin' ? 'Connexion' : 'Inscription'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="nexus-label">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-card border-hairline border-border bg-bg px-3 py-2.5 text-[14px] outline-none focus:border-accent"
                placeholder="vous@exemple.com"
              />
            </div>
            <div>
              <label className="nexus-label">Mot de passe</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-card border-hairline border-border bg-bg px-3 py-2.5 text-[14px] outline-none focus:border-accent"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-[12px] text-down">{error}</p>}
            {info && <p className="text-[12px] text-up">{info}</p>}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-card bg-accent py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? '…' : mode === 'signin' ? 'Se connecter' : 'Créer un compte'}
            </button>
          </form>
        </div>

        {!isConfigured && (
          <p className="mt-4 text-center text-[11px] text-secondary">
            Mode démo — Supabase non configuré. La navigation reste accessible.
          </p>
        )}
      </div>
    </div>
  )
}
