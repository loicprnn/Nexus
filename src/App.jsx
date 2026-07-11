import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Analyse from './pages/Analyse'
import PaperTrading from './pages/PaperTrading'
import NexusCoach from './pages/NexusCoach'
import Markets from './pages/Markets'
import Macro from './pages/Macro'
import IndicateursAvances from './pages/IndicateursAvances'
import Sentiment from './pages/Sentiment'
import Comparer from './pages/Comparer'
import Calendrier from './pages/Calendrier'
import Alertes from './pages/Alertes'
import Parametres from './pages/Parametres'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="analyse" element={<Analyse />} />
        <Route path="paper-trading" element={<PaperTrading />} />
        <Route path="coach" element={<NexusCoach />} />
        <Route path="markets" element={<Markets />} />
        <Route path="macro" element={<Macro />} />
        <Route path="indicateurs" element={<IndicateursAvances />} />
        <Route path="sentiment" element={<Sentiment />} />
        <Route path="comparer" element={<Comparer />} />
        <Route path="calendrier" element={<Calendrier />} />
        <Route path="alertes" element={<Alertes />} />
        <Route path="parametres" element={<Parametres />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
