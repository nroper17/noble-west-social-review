import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Workspace, Post } from '../../types'
import CalendarGrid from '../../components/Calendar/CalendarGrid'
import CommentThread from '../../components/PostDetail/CommentThread'
import AssetManager from '../../components/PostDetail/AssetManager'
import { format, startOfMonth, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PLATFORM_LABELS, PLATFORM_ICONS } from '../../assets/icons/PlatformIcons'
import './ClientPortal.css'

export default function ClientPortalPage() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()))
  const [clientName] = useState('Client')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (token) loadWorkspace()
  }, [token])

  useEffect(() => {
    if (workspace) loadCalendarAndPosts()
  }, [workspace, currentDate])

  async function loadWorkspace() {
    const { data } = await supabase
      .from('workspaces')
      .select('*')
      .eq('magic_link_token', token)
      .eq('is_archived', false)
      .single()
    if (!data) { setNotFound(true); setLoading(false); return }
    setWorkspace(data)
  }

  async function loadCalendarAndPosts() {
    const month = currentDate.getMonth() + 1
    const year = currentDate.getFullYear()
    const { data: cal } = await supabase
      .from('calendars')
      .select('*')
      .eq('workspace_id', workspace!.id)
      .eq('month', month)
      .eq('year', year)
      .single()

    if (cal) {
      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .eq('calendar_id', cal.id)
        .order('proposed_date')
      
      const loadedPosts = postsData ?? []
      setPosts(loadedPosts)

      if (loadedPosts.length > 0) {
        const postIds = loadedPosts.map(p => p.id)
        const { data: commentData } = await supabase
          .from('comments')
          .select('post_id')
          .in('post_id', postIds)
          .eq('thread', 'client')
          .eq('is_resolved', false)
          
        const counts: Record<string, number> = {}
        for (const row of commentData ?? []) {
          counts[row.post_id] = (counts[row.post_id] ?? 0) + 1
        }
        setCommentCounts(counts)
      } else {
        setCommentCounts({})
      }

      // Auto-open post from deep link if present
      const deepLinkPostId = searchParams.get('post')
      if (deepLinkPostId && loadedPosts.some(p => p.id === deepLinkPostId)) {
        setSelectedPostId(deepLinkPostId)
      }
    } else {
      setPosts([])
      setCommentCounts({})
    }
    setLoading(false)
  }

  async function setClientStatus(postId: string, status: 'approved' | 'needs_revision') {
    await supabase.from('posts').update({ status, updated_at: new Date().toISOString() }).eq('id', postId)
    loadCalendarAndPosts()
  }

  if (notFound) {
    return (
      <div className="client-portal-notfound">
        <img src="/nw-logo-forester.png" alt="Noble West" style={{ height: 36 }} />
        <h1>Link not found</h1>
        <p>This review link may have expired or been regenerated. Contact your Noble West team for a new link.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="client-portal-loading">
        <img src="/nw-logo-forester.png" alt="Noble West" style={{ height: 32 }} />
        <p>Loading your content calendar…</p>
      </div>
    )
  }

  const selectedPost = selectedPostId ? posts.find(p => p.id === selectedPostId) ?? null : null

  const sortedPosts = [...posts].sort((a, b) => a.proposed_date.localeCompare(b.proposed_date))
  const currentIndex = selectedPost ? sortedPosts.findIndex(p => p.id === selectedPost.id) : -1
  const prevPost = currentIndex > 0 ? sortedPosts[currentIndex - 1] : null
  const nextPost = currentIndex >= 0 && currentIndex < sortedPosts.length - 1 ? sortedPosts[currentIndex + 1] : null

  return (
    <div className="client-portal-root">
      {/* Simple client nav */}
      <header className="client-nav">
        <div className="client-nav-inner">
          <img src="/nw-logo-white.png" alt="Noble West" className="nw-logo" style={{ filter: 'brightness(0) invert(1)', height: 39 }} />
          <div className="nav-divider" />
          <span className="nav-workspace-name">{workspace?.name}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="client-nav-month-btn" onClick={() => setCurrentDate(d => subMonths(d, 1))}><ChevronLeft size={16} /></button>
            <span className="client-month-label">{format(currentDate, 'MMMM yyyy')}</span>
            <button className="client-nav-month-btn" onClick={() => setCurrentDate(d => addMonths(d, 1))}><ChevronRight size={16} /></button>
          </div>
        </div>
      </header>

      <main className="client-portal-main">
        <CalendarGrid
          month={currentDate.getMonth() + 1}
          year={currentDate.getFullYear()}
          posts={posts}
          commentCounts={commentCounts}
          selectedPostId={selectedPostId}
          onSelectPost={setSelectedPostId}
        />
      </main>

      {/* Client Post Panel */}
      {selectedPost && (
        <>
          <div className="panel-overlay" onClick={() => setSelectedPostId(null)} />
          <aside className="panel-slide-in">
            <div className="client-post-panel">
            <div className="client-panel-header">
              <div>
                <h2 className="client-panel-title">{selectedPost.title}</h2>
                <p className="client-panel-date">{format(new Date(selectedPost.proposed_date), 'EEEE, MMMM d, yyyy')}</p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelectedPostId(null)}>✕</button>
            </div>

            {/* Post navigation */}
            <div className="post-nav-row">
              <button
                className="btn btn-ghost btn-sm post-nav-btn"
                onClick={() => prevPost && setSelectedPostId(prevPost.id)}
                disabled={!prevPost}
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <span className="post-nav-count">{currentIndex + 1} / {sortedPosts.length}</span>
              <button
                className="btn btn-ghost btn-sm post-nav-btn post-nav-next"
                onClick={() => nextPost && setSelectedPostId(nextPost.id)}
                disabled={!nextPost}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Status */}
            <div className="client-panel-status">
              <span className={`status-pill ${selectedPost.status}`}>{selectedPost.status.replace('_', ' ')}</span>
            </div>

            {/* Platforms */}
            {selectedPost.platforms && selectedPost.platforms.length > 0 && (
              <div className="platform-pill-group client-panel-platforms">
                {selectedPost.platforms.map(platform => {
                  const Icon = PLATFORM_ICONS[platform]
                  return (
                    <span key={platform} className="platform-pill selected">
                      {Icon && <Icon size={13} />}
                      {PLATFORM_LABELS[platform]}
                    </span>
                  )
                })}
              </div>
            )}

            {/* Asset */}
            {(selectedPost.assets?.length > 0 || selectedPost.asset_url) && (
              <div className="client-panel-asset">
                <AssetManager
                  assets={selectedPost.assets ?? []}
                  videoUrl={selectedPost.asset_type === 'video_link' ? selectedPost.asset_url : null}
                  isTeam={false}
                  postId={selectedPost.id}
                  onUpdateAssets={() => {}}
                  onUpdateVideo={() => {}}
                />
              </div>
            )}

            {/* Copy */}
            {selectedPost.copy && (
              <div className="client-panel-copy">
                <p className="form-label">Copy</p>
                <div className="client-copy-body" dangerouslySetInnerHTML={{ __html: selectedPost.copy }} />
              </div>
            )}

            {/* Usage Rights */}
            {selectedPost.usage_rights && (
              <div className="client-panel-usage">
                <p className="form-label">Usage Rights</p>
                <p className="usage-text">{selectedPost.usage_rights}</p>
              </div>
            )}

            {/* Client approve / revision actions */}
            <div className="client-approval-actions">
              <button
                className={`btn ${selectedPost.status === 'approved' ? 'btn-primary' : 'btn-outlined'}`}
                style={{ borderColor: 'var(--status-approved)', color: selectedPost.status === 'approved' ? '#fff' : 'var(--status-approved)', background: selectedPost.status === 'approved' ? 'var(--status-approved)' : 'transparent' }}
                onClick={() => setClientStatus(selectedPost.id, 'approved')}
              >
                ✓ Approve
              </button>
              <button
                className={`btn ${selectedPost.status === 'needs_revision' ? 'btn-primary' : 'btn-outlined'}`}
                style={{ borderColor: 'var(--status-revision)', color: selectedPost.status === 'needs_revision' ? '#fff' : 'var(--status-revision)', background: selectedPost.status === 'needs_revision' ? 'var(--status-revision)' : 'transparent' }}
                onClick={() => setClientStatus(selectedPost.id, 'needs_revision')}
              >
                ↩ Request Revision
              </button>
            </div>

            {/* Client comment thread */}
            <div className="client-panel-comments">
              <CommentThread
                postId={selectedPost.id}
                isTeam={false}
                workspaceId={workspace!.id}
                magicLinkToken={workspace!.magic_link_token}
                clientName={clientName || 'Client'}
              />
            </div>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
