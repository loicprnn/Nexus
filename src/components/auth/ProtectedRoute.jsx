import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading, isConfigured } = useAuth()
  const location = useLocation()

  // Before Supabase is configured, let the app through so the scaffold is usable.
  if (!isConfigured) return children

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg text-secondary">
        <span className="text-[13px]">Chargement…</span>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
