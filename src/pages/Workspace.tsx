import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Workspace, Calendar, Post, Comment } from '../types'
import TopNav from '../components/UI/TopNav'
import CalendarGrid from '../components/Calendar/CalendarGrid'
import PostDetailPanel from '../components/PostDetail/PostDetailPanel'
import { PDFDownloadLink } from '@react-pdf/renderer'
import CalendarPDF from '../components/PDFExport/CalendarPDF'
import { ChevronLeft, ChevronRight, Plus, Download } from 'lucide-react'
import { format, addMonths, subMonths, startOfMonth } from 'date-fns'
import './Workspace.css'

export default function WorkspacePage() {
  const { workspaceId } = useParams()
  const { isAdmin, isTeam } = useAuth()

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [calendar, setCalendar] = useState<Calendar | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [clientComments, setClientComments] = useState<Comment[]>([])
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (workspaceId) loadWorkspace()
  }, [workspaceId])

  useEffect(() => {
    if (workspace) loadCalendar()
  }, [workspace, currentDate])

  async function loadWorkspace() {
    const { data } = await supabase.from('workspaces').select('*').eq('id', workspaceId).single()
    setWorkspace(data)
  }

  async function loadCalendar() {
    setLoading(true)
    const month = currentDate.getMonth() + 1
    const year = currentDate.getFullYear()

    let { data: cal } = await supabase
      .from('calendars')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('month', month)
      .eq('year', year)
      .single()

    if (!cal) {
      // Auto-create a calendar for this month
      const { data: newCal } = await supabase
        .from('calendars')
        .insert({ workspace_id: workspaceId, month, year })
        .select()
        .single()
      cal = newCal
    }

    setCalendar(cal)

    if (cal) {
      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .eq('calendar_id', cal.id)
        .order('proposed_date')
      setPosts(postsData ?? [])
      // Load client comments for all posts in this calendar
      if (postsData && postsData.length > 0) {
        const postIds = postsData.map(p => p.id)
        const { data: commentData } = await supabase
          .from('comments')
          .select('*')
          .in('post_id', postIds)
          .eq('thread', 'client')
          .eq('is_resolved', false)
          .order('created_at')

        setClientComments(commentData ?? [])

        const counts: Record<string, number> = {}
        for (const row of commentData ?? []) {
          counts[row.post_id] = (counts[row.post_id] ?? 0) + 1
        }
        setCommentCounts(counts)
      } else {
        setClientComments([])
        setCommentCounts({})
      }
    }
    setLoading(false)
  }

  async function createPost(date: Date) {
    if (!calendar) return
    const { data } = await supabase
      .from('posts')
      .insert({
        calendar_id: calendar.id,
        title: 'New Post',
        proposed_date: format(date, 'yyyy-MM-dd'),
        platforms: ['instagram'],
        copy: '',
        status: 'draft',
      })
      .select()
      .single()
    if (data) {
      setPosts(prev => [...prev, data])
      setSelectedPostId(data.id)
    }
  }

  function handleMonthChange(dir: 'prev' | 'next') {
    setCurrentDate(prev => dir === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1))
    setSelectedPostId(null)
  }

  const selectedPost = selectedPostId ? posts.find(p => p.id === selectedPostId) ?? null : null

  const monthLabel = format(currentDate, 'MMMM yyyy')

  return (
    <div className="workspace-root">
      <TopNav
        workspaceName={workspace?.name}
        extra={
          <div className="month-nav">
            <button className="btn btn-ghost btn-icon btn-sm month-nav-btn" onClick={() => handleMonthChange('prev')}>
              <ChevronLeft size={16} />
            </button>
            <span className="month-label">{monthLabel}</span>
            <button className="btn btn-ghost btn-icon btn-sm month-nav-btn" onClick={() => handleMonthChange('next')}>
              <ChevronRight size={16} />
            </button>
          </div>
        }
      />

      <main className="workspace-main">
        <div className="workspace-toolbar">
          {isTeam && (
            <button className="btn btn-primary btn-sm" onClick={() => createPost(currentDate)}>
              <Plus size={14} /> Add Post
            </button>
          )}
          {workspace && !loading && (
            <PDFDownloadLink
              document={
                <CalendarPDF
                  workspace={workspace}
                  posts={posts}
                  clientComments={clientComments}
                  month={currentDate.getMonth() + 1}
                  year={currentDate.getFullYear()}
                />
              }
              fileName={`${workspace.slug}-${format(currentDate, 'yyyy-MM')}.pdf`}
              className="btn btn-ghost btn-sm"
              style={{ textDecoration: 'none' }}
            >
              {({ loading: pdfLoading }) => (
                <>
                  <Download size={14} /> {pdfLoading ? 'Preparing PDF...' : 'Export PDF'}
                </>
              )}
            </PDFDownloadLink>
          )}
        </div>

        {loading ? (
          <div className="workspace-loading">Loading calendar…</div>
        ) : (
          <CalendarGrid
            month={currentDate.getMonth() + 1}
            year={currentDate.getFullYear()}
            posts={posts}
            commentCounts={commentCounts}
            selectedPostId={selectedPostId}
            onSelectPost={setSelectedPostId}
            onAddPost={isTeam ? createPost : undefined}
          />
        )}
      </main>

      {selectedPost && (
        <PostDetailPanel
          post={selectedPost}
          allPosts={posts}
          workspaceId={workspace!.id}
          magicLinkToken={workspace!.magic_link_token}
          isTeam={isTeam}
          isAdmin={isAdmin}
          onClose={() => setSelectedPostId(null)}
          onNavigate={(id: string) => setSelectedPostId(id)}
          onPostUpdate={(updated: Post) => {
            setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))
          }}
          onPostDelete={(id: string) => {
            setPosts(prev => prev.filter(p => p.id !== id))
            setSelectedPostId(null)
          }}
        />
      )}
    </div>
  )
}
