import PageContainer from '../components/ui/PageContainer'
import { useAuth } from '../contexts/AuthContext'

export default function Parametres() {
  const { user, signOut, isConfigured } = useAuth()

  return (
    <PageContainer
      title="Paramètres"
      description="Profil, alertes et préférences personnelles."
    >
      <div className="nexus-card p-6">
        <h2 className="text-[15px] font-semibold">Compte</h2>
        <div className="mt-4 space-y-3 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-secondary">Statut Supabase</span>
            <span className={isConfigured ? 'text-up' : 'text-down'}>
              {isConfigured ? 'Configuré' : 'Non configuré'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-secondary">Email</span>
            <span className="text-primary">{user?.email ?? '—'}</span>
          </div>
        </div>

        {user && (
          <button
            onClick={signOut}
            className="mt-6 rounded-card border-hairline border-border px-4 py-2 text-[13px] text-down transition-colors hover:bg-hover"
          >
            Se déconnecter
          </button>
        )}
      </div>
    </PageContainer>
  )
}
