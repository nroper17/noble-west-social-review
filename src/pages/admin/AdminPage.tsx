import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Workspace, Profile } from '../../types'
import TopNav from '../../components/UI/TopNav'
import { Plus, Pencil, Archive, RefreshCw, Copy, Check, X } from 'lucide-react'
import './AdminPage.css'

type Section = 'workspaces' | 'team' | 'links'

export default function AdminPage() {
  const [searchParams] = useSearchParams()
  const [section, setSection] = useState<Section>('workspaces')
  const [showCreateModal, setShowCreateModal] = useState(searchParams.get('create') === '1')

  return (
    <div className="admin-root">
      <TopNav />
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <h2 className="admin-sidebar-title">Admin</h2>
          <nav className="admin-nav">
            {(['workspaces', 'team', 'links'] as Section[]).map(s => (
              <button
                key={s}
                className={`admin-nav-item ${section === s ? 'active' : ''}`}
                onClick={() => setSection(s)}
              >
                {s === 'workspaces' ? 'Workspaces' : s === 'team' ? 'Team Members' : 'Magic Links'}
              </button>
            ))}
          </nav>
        </aside>
        <main className="admin-content">
          {section === 'workspaces' && (
            <WorkspacesSection showCreate={showCreateModal} onCreateClose={() => setShowCreateModal(false)} />
          )}
          {section === 'team' && <TeamSection />}
          {section === 'links' && <MagicLinksSection />}
        </main>
      </div>
    </div>
  )
}

// ─── Workspaces Section ──────────────────────────────────────────────────────

function WorkspacesSection({ showCreate, onCreateClose }: { showCreate: boolean; onCreateClose: () => void }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showModal, setShowModal] = useState(showCreate)

  useEffect(() => { load() }, [])
  useEffect(() => { setShowModal(showCreate) }, [showCreate])

  async function load() {
    const { data } = await supabase.from('workspaces').select('*').order('name')
    setWorkspaces(data ?? [])
  }

  async function createWorkspace() {
    if (!createName.trim()) return
    setCreating(true)
    const token = crypto.randomUUID()
    const slug = createName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const { error } = await supabase.from('workspaces').insert({
      name: createName.trim(),
      slug,
      magic_link_token: token,
      is_archived: false,
      org_id: (await supabase.from('organizations').select('id').single()).data?.id
    })
    if (!error) { setCreateName(''); setShowModal(false); onCreateClose(); load() }
    setCreating(false)
  }

  async function renameWorkspace(id: string, name: string) {
    await supabase.from('workspaces').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', id)
    setEditId(null)
    load()
  }

  async function archiveWorkspace(id: string, archive: boolean) {
    await supabase.from('workspaces').update({ is_archived: archive }).eq('id', id)
    load()
  }

  const active = workspaces.filter(w => !w.is_archived)
  const archived = workspaces.filter(w => w.is_archived)

  return (
    <section className="admin-section">
      <div className="admin-section-header">
        <h1>Workspaces</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          <Plus size={14} /> New Workspace
        </button>
      </div>

      {showModal && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Create Workspace</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setShowModal(false); onCreateClose() }}>
                <X size={16} />
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">Partner / Client Name</label>
              <input
                className="form-input"
                placeholder="e.g. Lamb Weston"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createWorkspace()}
                autoFocus
              />
            </div>
            <div className="admin-modal-actions">
              <button className="btn btn-ghost" onClick={() => { setShowModal(false); onCreateClose() }}>Cancel</button>
              <button className="btn btn-primary" onClick={createWorkspace} disabled={creating || !createName.trim()}>
                {creating ? 'Creating…' : 'Create Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="workspace-list">
        {active.map(ws => (
          <WorkspaceRow
            key={ws.id}
            workspace={ws}
            isEditing={editId === ws.id}
            editName={editName}
            onEditStart={() => { setEditId(ws.id); setEditName(ws.name) }}
            onEditName={setEditName}
            onEditSave={() => renameWorkspace(ws.id, editName)}
            onEditCancel={() => setEditId(null)}
            onArchive={() => archiveWorkspace(ws.id, true)}
          />
        ))}
      </div>

      {archived.length > 0 && (
        <>
          <div className="admin-section-label">Archived</div>
          <div className="workspace-list archived">
            {archived.map(ws => (
              <div key={ws.id} className="workspace-row archived-row">
                <span className="workspace-row-name">{ws.name}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => archiveWorkspace(ws.id, false)}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function WorkspaceRow({
  workspace, isEditing, editName, onEditStart, onEditName, onEditSave, onEditCancel, onArchive
}: {
  workspace: Workspace; isEditing: boolean; editName: string
  onEditStart: () => void; onEditName: (n: string) => void
  onEditSave: () => void; onEditCancel: () => void; onArchive: () => void
}) {
  return (
    <div className="workspace-row">
      {isEditing ? (
        <>
          <input
            className="form-input workspace-row-edit"
            value={editName}
            onChange={e => onEditName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onEditSave(); if (e.key === 'Escape') onEditCancel() }}
            autoFocus
          />
          <button className="btn btn-primary btn-sm btn-icon" onClick={onEditSave}><Check size={14} /></button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onEditCancel}><X size={14} /></button>
        </>
      ) : (
        <>
          <span className="workspace-row-name">{workspace.name}</span>
          <div className="workspace-row-actions">
            <button className="btn btn-ghost btn-sm btn-icon" onClick={onEditStart} title="Rename"><Pencil size={14} /></button>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={onArchive} title="Archive"><Archive size={14} /></button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Team Section ────────────────────────────────────────────────────────────

function TeamSection() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [memberMap, setMemberMap] = useState<Record<string, string[]>>({}) // userId → workspaceIds[]
  const { profile: self } = useAuth()

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: profs }, { data: wss }, { data: members }] = await Promise.all([
      supabase.from('profiles').select('*').in('role', ['nw_admin', 'nw_team']).order('full_name'),
      supabase.from('workspaces').select('*').eq('is_archived', false).order('name'),
      supabase.from('workspace_members').select('user_id, workspace_id'),
    ])
    const map: Record<string, string[]> = {}
    for (const m of members ?? []) {
      map[m.user_id] = map[m.user_id] ?? []
      map[m.user_id].push(m.workspace_id)
    }
    setProfiles(profs ?? [])
    setWorkspaces(wss ?? [])
    setMemberMap(map)
  }

  async function toggleAssignment(userId: string, workspaceId: string, assigned: boolean) {
    if (assigned) {
      await supabase.from('workspace_members').delete()
        .eq('user_id', userId).eq('workspace_id', workspaceId)
    } else {
      await supabase.from('workspace_members').insert({ user_id: userId, workspace_id: workspaceId })
    }
    load()
  }

  async function setRole(userId: string, role: 'nw_admin' | 'nw_team') {
    await supabase.from('profiles').update({ role }).eq('id', userId)
    load()
  }

  return (
    <section className="admin-section">
      <div className="admin-section-header">
        <h1>Team Members</h1>
      </div>
      <p className="admin-note">Team members appear here after their first Google login. Assign them to partner workspaces below.</p>
      <div className="team-list">
        {profiles.map(p => (
          <div key={p.id} className="team-row">
            <div className="team-row-identity">
              <div className="avatar" style={{ background: p.role === 'nw_admin' ? 'var(--color-gilded)' : 'var(--color-forester)' }}>
                {(p.full_name ?? p.email).slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="team-row-name">{p.full_name ?? p.email}</p>
                <p className="team-row-email">{p.email}</p>
              </div>
              {p.id !== self?.id && (
                <select
                  className="form-input team-role-select"
                  value={p.role}
                  onChange={e => setRole(p.id, e.target.value as any)}
                >
                  <option value="nw_team">Team Member</option>
                  <option value="nw_admin">Admin</option>
                </select>
              )}
            </div>
            <div className="team-workspace-assignments">
              {workspaces.map(ws => {
                const assigned = (memberMap[p.id] ?? []).includes(ws.id)
                return (
                  <button
                    key={ws.id}
                    className={`assignment-pill ${assigned ? 'assigned' : ''}`}
                    onClick={() => toggleAssignment(p.id, ws.id, assigned)}
                  >
                    {assigned && <Check size={11} />}
                    {ws.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Magic Links Section ─────────────────────────────────────────────────────

function MagicLinksSection() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('workspaces').select('*').eq('is_archived', false).order('name')
    setWorkspaces(data ?? [])
  }

  async function regenerateToken(workspaceId: string) {
    const token = crypto.randomUUID()
    await supabase.from('workspaces').update({ magic_link_token: token }).eq('id', workspaceId)
    load()
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/review/${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <section className="admin-section">
      <div className="admin-section-header">
        <h1>Magic Links</h1>
      </div>
      <p className="admin-note">
        Each partner workspace has a persistent magic link. Share it with your client — no account needed. 
        Regenerating a link immediately invalidates the old one.
      </p>
      <div className="links-list">
        {workspaces.map(ws => {
          const url = `${window.location.origin}/review/${ws.magic_link_token}`
          const isCopied = copied === ws.magic_link_token
          return (
            <div key={ws.id} className="link-row">
              <div className="link-row-workspace">{ws.name}</div>
              <div className="link-row-url">{url}</div>
              <div className="link-row-actions">
                <button
                  className={`btn btn-sm ${isCopied ? 'btn-primary' : 'btn-outlined'}`}
                  onClick={() => copyLink(ws.magic_link_token)}
                >
                  {isCopied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy link</>}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => regenerateToken(ws.id)}>
                  <RefreshCw size={12} /> Regenerate
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
