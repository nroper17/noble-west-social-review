import { useAuth } from '../../contexts/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, LayoutGrid, ShieldCheck } from 'lucide-react'
import './TopNav.css'

interface TopNavProps {
  workspaceName?: string
  extra?: React.ReactNode
}

export default function TopNav({ workspaceName, extra }: TopNavProps) {
  const { profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).join('').slice(0, 2)
    : profile?.email?.slice(0, 2).toUpperCase() ?? 'NW'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <nav className="top-nav">
      <Link to="/">
        <img src="/nw-logo-white.png" alt="Noble West" className="nw-logo" />
      </Link>

      {workspaceName && (
        <>
          <div className="nav-divider" />
          <span className="nav-workspace-name">{workspaceName}</span>
        </>
      )}

      {extra && <div className="nav-extra">{extra}</div>}

      <div className="nav-actions">
        <Link to="/" title="All Workspaces" className="btn btn-ghost btn-icon" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <LayoutGrid size={16} />
        </Link>
        {isAdmin && (
          <Link to="/admin" title="Admin" className="btn btn-ghost btn-icon" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <ShieldCheck size={16} />
          </Link>
        )}
        <button className="avatar" title={profile?.email ?? ''}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt={initials} />
            : initials
          }
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={handleSignOut} title="Sign out" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <LogOut size={15} />
        </button>
      </div>
    </nav>
  )
}
