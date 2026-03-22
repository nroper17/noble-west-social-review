import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Workspace } from '../types'
import TopNav from '../components/UI/TopNav'
import { LayoutGrid, Plus, Settings } from 'lucide-react'
import './Dashboard.css'

export default function DashboardPage() {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWorkspaces()
  }, [isAdmin])

  async function loadWorkspaces() {
    setLoading(true)
    try {
      if (isAdmin) {
        // Admins see all non-archived workspaces
        const { data } = await supabase
          .from('workspaces')
          .select('*')
          .eq('is_archived', false)
          .order('name')
        setWorkspaces(data ?? [])
      } else {
        // Team members see only assigned workspaces
        const { data } = await supabase
          .from('workspace_members')
          .select('workspace_id, workspaces(*)')
          .eq('user_id', profile?.id)
        const ws = (data ?? [])
          .map((m: any) => m.workspaces)
          .filter(Boolean)
          .filter((w: Workspace) => !w.is_archived)
        setWorkspaces(ws)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dashboard-root">
      <TopNav />
      <main className="dashboard-main">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-heading">Workspaces</h1>
            <p className="dashboard-subhead">
              {loading ? '…' : `${workspaces.length} active partner${workspaces.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="dashboard-actions">
            {isAdmin && (
              <>
                <Link to="/admin" className="btn btn-ghost btn-sm">
                  <Settings size={14} /> Admin
                </Link>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin?create=1')}>
                  <Plus size={14} /> New Workspace
                </button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="dashboard-loading">
            <p>Loading workspaces…</p>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><LayoutGrid size={40} strokeWidth={1.2} /></div>
            <p>No workspaces yet.</p>
            {isAdmin && (
              <button className="btn btn-primary" onClick={() => navigate('/admin?create=1')}>
                <Plus size={14} /> Create your first workspace
              </button>
            )}
          </div>
        ) : (
          <div className="workspace-grid">
            {workspaces.map(ws => (
              <WorkspaceCard key={ws.id} workspace={ws} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const initials = workspace.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <Link to={`/workspace/${workspace.id}`} className="workspace-card">
      <div className="workspace-card-avatar">{initials}</div>
      <div className="workspace-card-info">
        <h2 className="workspace-card-name">{workspace.name}</h2>
        <p className="workspace-card-meta">Partner workspace</p>
      </div>
      <span className="workspace-card-arrow">→</span>
    </Link>
  )
}
