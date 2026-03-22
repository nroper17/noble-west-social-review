import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/Login'
import AuthCallbackPage from './pages/AuthCallback'
import DashboardPage from './pages/Dashboard'
import WorkspacePage from './pages/Workspace'
import AdminPage from './pages/admin/AdminPage'
import ClientPortalPage from './pages/client/ClientPortal'

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <AppLoading />
  if (!session) return <Navigate to="/login" replace />
  if (adminOnly && profile?.role !== 'nw_admin') return <Navigate to="/" replace />
  return <>{children}</>
}

function AppLoading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--color-bg)'
    }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <img src="/nw-logo-forester.png" alt="Noble West" style={{ height: 36, opacity: 0.7 }} />
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', letterSpacing: '0.1em', textTransform:'uppercase' }}>Loading…</p>
      </div>
    </div>
  )
}

function AppRoutes() {
  const { session, loading } = useAuth()
  if (loading) return <AppLoading />

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/review/:token" element={<ClientPortalPage />} />

      {/* Protected — NW Team */}
      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/workspace/:workspaceId" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
      <Route path="/workspace/:workspaceId/:month/:year" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />

      {/* Admin only */}
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
      <Route path="/admin/:section" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
