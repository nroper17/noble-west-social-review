import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Post, PostChangeLog, PostStatus, Platform, PostAsset } from '../../types'
import { PLATFORM_LABELS, PLATFORM_ICONS } from '../../assets/icons/PlatformIcons'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { X, Trash2, Save, Lock, MessageCircle, History, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { format } from 'date-fns'
import CommentThread from './CommentThread'
import AssetManager from './AssetManager'
import { sendNotification, escapeHtml } from '../../lib/notifications'
import './PostDetailPanel.css'

const ALL_PLATFORMS: Platform[] = ['instagram', 'facebook', 'linkedin', 'tiktok', 'x', 'pinterest']

const STATUS_OPTIONS: { value: PostStatus; label: string; emoji: string }[] = [
  { value: 'draft', label: 'Draft', emoji: '○' },
  { value: 'pending_review', label: 'Pending Review', emoji: '◷' },
  { value: 'needs_revision', label: 'Needs Revision', emoji: '△' },
  { value: 'approved', label: 'Approved', emoji: '✓' },
]

interface PostDetailPanelProps {
  post: Post
  allPosts: Post[]          // for prev/next navigation
  workspaceId: string
  magicLinkToken?: string
  isTeam: boolean
  isAdmin: boolean
  onClose: () => void
  onPostUpdate: (post: Post) => void
  onPostDelete: (id: string) => void
  onNavigate: (postId: string) => void   // navigate without closing
}

export default function PostDetailPanel({ post, allPosts, workspaceId, magicLinkToken, isTeam, isAdmin, onClose, onPostUpdate, onPostDelete, onNavigate }: PostDetailPanelProps) {
  const { profile } = useAuth()
  const [draft, setDraft] = useState<Post>(post)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [changeLogNote, setChangeLogNote] = useState('')
  const [changeLogs, setChangeLogs] = useState<PostChangeLog[]>([])
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'log'>('details')
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Sorted by date for sequential nav
  const sortedPosts = [...allPosts].sort((a, b) => a.proposed_date.localeCompare(b.proposed_date))
  const currentIndex = sortedPosts.findIndex(p => p.id === post.id)
  const prevPost = currentIndex > 0 ? sortedPosts[currentIndex - 1] : null
  const nextPost = currentIndex < sortedPosts.length - 1 ? sortedPosts[currentIndex + 1] : null

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write your social copy here…' }),
    ],
    content: post.copy,
    editable: isTeam,
    onUpdate: ({ editor }) => {
      setDraft(prev => ({ ...prev, copy: editor.getHTML() }))
      setDirty(true)
    },
  })

  useEffect(() => {
    setDraft(post)
    setDirty(false)
    editor?.commands.setContent(post.copy)
    loadChangeLog()
  }, [post.id])

  async function loadChangeLog() {
    const { data } = await supabase
      .from('post_change_log')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: false })
    setChangeLogs(data ?? [])
  }

  function setField<K extends keyof Post>(key: K, value: Post[K]) {
    setDraft(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  function togglePlatform(platform: Platform) {
    const platforms = draft.platforms.includes(platform)
      ? draft.platforms.filter(p => p !== platform)
      : [...draft.platforms, platform]
    setField('platforms', platforms as Platform[])
  }

  async function save() {
    setSaving(true)
    const { data, error } = await supabase
      .from('posts')
      .update({
        title: draft.title,
        proposed_date: draft.proposed_date,
        platforms: draft.platforms,
        copy: draft.copy,
        assets: draft.assets,
        asset_url: draft.asset_url,   // video_link only
        asset_type: draft.asset_type, // 'video_link' or null
        notes: draft.notes,
        usage_rights: draft.usage_rights,
        status: draft.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id)
      .select()
      .single()

    if (!error && data) {
      onPostUpdate(data)
      setDirty(false)

      let shouldReloadLog = false

      if (post.status !== draft.status) {
        const newStatusWord = draft.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
        const statusLog = `Status updated to ${newStatusWord}`
        await supabase.from('post_change_log').insert({
          post_id: post.id,
          user_id: profile?.id,
          user_name: profile?.full_name ?? profile?.email,
          note: statusLog,
        })
        shouldReloadLog = true

        if (draft.status === 'needs_revision' || draft.status === 'approved') {
          const newStatus = draft.status.replace('_', ' ').toUpperCase()
          sendNotification(
            workspaceId,
            'status_change',
            `Status Updated: ${draft.title}`,
            `<h2>Post Status Update</h2>
             <p>The status of <strong>"${escapeHtml(draft.title)}"</strong> was changed to <strong>${escapeHtml(newStatus)}</strong>.</p>
             <p>Log in to the Noble West Social Review Tool to view.</p>`
          )
        }
      }

      if (post.proposed_date !== draft.proposed_date) {
        const dateLog = `Publish date changed to ${format(new Date(draft.proposed_date), 'MMM d, yyyy')}`
        await supabase.from('post_change_log').insert({
          post_id: post.id,
          user_id: profile?.id,
          user_name: profile?.full_name ?? profile?.email,
          note: dateLog,
        })
        shouldReloadLog = true
      }

      if (changeLogNote.trim()) {
        await supabase.from('post_change_log').insert({
          post_id: post.id,
          user_id: profile?.id,
          user_name: profile?.full_name ?? profile?.email,
          note: changeLogNote.trim(),
        })
        setChangeLogNote('')
        shouldReloadLog = true
      }

      if (shouldReloadLog) {
        loadChangeLog()
      }
    }
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('posts').delete().eq('id', post.id)
    setShowDeleteModal(false)
    onPostDelete(post.id)
  }

  function handleNavigate(targetPost: Post) {
    if (dirty) {
      if (!window.confirm('You have unsaved changes. Navigate without saving?')) return
    }
    onNavigate(targetPost.id)
  }

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <aside className="panel-slide-in post-panel">
        {/* Panel header */}
        <div className="post-panel-header">
          <div className="post-panel-header-row">
            <input
              className="post-title-input"
              value={draft.title}
              disabled={!isTeam}
              onChange={e => setField('title', e.target.value)}
              placeholder="Post title"
            />
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
          </div>

          {/* Post navigation */}
          <div className="post-nav-row">
            <button
              className="btn btn-ghost btn-sm post-nav-btn"
              onClick={() => prevPost && handleNavigate(prevPost)}
              disabled={!prevPost}
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <span className="post-nav-count">{currentIndex + 1} / {sortedPosts.length}</span>
            <button
              className="btn btn-ghost btn-sm post-nav-btn post-nav-next"
              onClick={() => nextPost && handleNavigate(nextPost)}
              disabled={!nextPost}
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Status pills */}
          <div className="status-pill-group">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`status-pill-btn ${opt.value} ${draft.status === opt.value ? 'active' : ''}`}
                onClick={() => isTeam && setField('status', opt.value)}
                disabled={!isTeam}
              >
                {draft.status === opt.value && <Check size={11} strokeWidth={3} />}
                {opt.label}
              </button>
            ))}
          </div>

          {/* Tabs */}
          <div className="post-panel-tabs">
            {(['details', 'comments', 'log'] as const)
              .filter(tab => tab !== 'log' || isTeam)
              .map(tab => (
              <button
                key={tab}
                className={`panel-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'details' && 'Details'}
                {tab === 'comments' && <><MessageCircle size={13} /> Comments</>}
                {tab === 'log' && <><History size={13} /> Change Log</>}
              </button>
            ))}
          </div>
        </div>

        {/* Panel body */}
        <div className="post-panel-body">
          {activeTab === 'details' && (
            <div className="post-panel-details">
              {/* Date */}
              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={draft.proposed_date}
                  disabled={!isTeam}
                  onChange={e => setField('proposed_date', e.target.value)}
                />
              </div>

              {/* Platforms */}
              <div className="form-group">
                <label className="form-label">Platforms</label>
                <div className="platform-pill-group">
                  {ALL_PLATFORMS.map(platform => {
                    const Icon = PLATFORM_ICONS[platform]
                    const selected = draft.platforms.includes(platform)
                    return (
                      <button
                        key={platform}
                        className={`platform-pill ${selected ? 'selected' : ''}`}
                        onClick={() => isTeam && togglePlatform(platform)}
                        disabled={!isTeam}
                      >
                        {Icon && <Icon size={13} />}
                        {PLATFORM_LABELS[platform]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Asset (Moved above Copy) */}
              <div className="form-group">
                <label className="form-label">Assets</label>
                <AssetManager
                  assets={draft.assets ?? []}
                  videoUrl={draft.asset_type === 'video_link' ? draft.asset_url : null}
                  isTeam={isTeam}
                  postId={post.id}
                  onUpdateAssets={(assets: PostAsset[]) => {
                    setField('assets', assets)
                    setDirty(true)
                  }}
                  onUpdateVideo={(url: string | null) => {
                    setField('asset_url', url)
                    setField('asset_type', url ? 'video_link' : null)
                    setDirty(true)
                  }}
                />
              </div>

              {/* Copy / Description */}
              <div className="form-group">
                <label className="form-label">Copy/Description</label>
                <div className="tiptap-editor-wrapper">
                  <EditorContent editor={editor} className="tiptap-editor" />
                </div>
              </div>

              {/* Usage Rights */}
              <div className="form-group">
                <label className="form-label">Usage Rights</label>
                <input
                  className="form-input"
                  placeholder="e.g. Licensed via Shutterstock, Owned by client"
                  value={draft.usage_rights ?? ''}
                  disabled={!isTeam}
                  onChange={e => setField('usage_rights', e.target.value)}
                />
              </div>

              {/* Internal Notes (team only) */}
              {isTeam && (
                <div className="form-group internal-notes-group">
                  <label className="form-label">
                    <Lock size={11} /> Internal Notes
                    <span className="badge badge-internal" style={{ marginLeft: 6 }}>Internal Only</span>
                  </label>
                  <textarea
                    className="form-input form-textarea"
                    placeholder="Notes visible to Noble West team only"
                    value={draft.notes ?? ''}
                    onChange={e => setField('notes', e.target.value)}
                  />
                </div>
              )}

              {/* Change log note */}
              {isTeam && dirty && (
                <div className="form-group">
                  <label className="form-label">Change Note (optional)</label>
                  <input
                    className="form-input"
                    placeholder="Brief note about what changed"
                    value={changeLogNote}
                    onChange={e => setChangeLogNote(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <CommentThread postId={post.id} isTeam={isTeam} workspaceId={workspaceId} magicLinkToken={magicLinkToken} />
          )}

          {activeTab === 'log' && isTeam && (
            <div className="change-log-list">
              {changeLogs.length === 0 ? (
                <p className="empty-log">No changes logged yet.</p>
              ) : (
                changeLogs.map(entry => (
                  <div key={entry.id} className="log-entry">
                    <p className="log-note">{entry.note}</p>
                    <p className="log-meta">
                      {entry.user_name} · {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Panel footer */}
        {isTeam && (
          <div className="post-panel-footer">
            {isAdmin && (
              <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteModal(true)} disabled={deleting}>
                <Trash2 size={13} /> Delete
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={saving || !dirty}
              style={{ marginLeft: 'auto' }}
            >
              <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
        {/* Delete Modal */}
        {showDeleteModal && (
          <div className="delete-modal-backdrop" onClick={() => setShowDeleteModal(false)}>
            <div className="delete-modal" onClick={e => e.stopPropagation()}>
              <h3>Delete Post</h3>
              <p>Are you sure you want to delete <strong>"{post.title}"</strong>? This action cannot be undone.</p>
              <div className="delete-modal-actions">
                <button className="btn btn-ghost" onClick={() => setShowDeleteModal(false)} disabled={deleting}>Cancel</button>
                <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
