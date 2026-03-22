import { useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday } from 'date-fns'
import type { Post, Platform } from '../../types'
import { PLATFORM_COLORS, PLATFORM_ICONS } from '../../assets/icons/PlatformIcons'
import { Plus } from 'lucide-react'
import './CalendarGrid.css'

const STATUS_COLORS: Record<string, string> = {
  draft: 'var(--status-draft)',
  pending_review: 'var(--status-pending)',
  needs_revision: 'var(--status-revision)',
  approved: 'var(--status-approved)',
}

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface CalendarGridProps {
  month: number
  year: number
  posts: Post[]
  commentCounts: Record<string, number>
  selectedPostId: string | null
  onSelectPost: (id: string) => void
  onAddPost?: (date: Date) => void
}

export default function CalendarGrid({
  month, year, posts, commentCounts, selectedPostId, onSelectPost, onAddPost
}: CalendarGridProps) {
  const monthStart = startOfMonth(new Date(year, month - 1))
  const monthEnd = endOfMonth(monthStart)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)

  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const postsByDate = useMemo(() => {
    const map: Record<string, Post[]> = {}
    for (const post of posts) {
      const key = post.proposed_date.slice(0, 10)
      map[key] = map[key] ?? []
      map[key].push(post)
    }
    return map
  }, [posts])

  return (
    <div className="calendar-grid-wrapper">
      {/* Day headers */}
      <div className="calendar-grid">
        {DAY_HEADERS.map(d => (
          <div key={d} className="calendar-day-header">{d}</div>
        ))}

        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd')
          const dayPosts = postsByDate[key] ?? []
          const isCurrentMonth = isSameMonth(day, monthStart)
          const isDayToday = isToday(day)

          return (
            <CalendarCell
              key={key}
              day={day}
              posts={dayPosts}
              commentCounts={commentCounts}
              isCurrentMonth={isCurrentMonth}
              isToday={isDayToday}
              selectedPostId={selectedPostId}
              onSelectPost={onSelectPost}
              onAddPost={onAddPost}
            />
          )
        })}
      </div>
    </div>
  )
}

interface CellProps {
  day: Date
  posts: Post[]
  commentCounts: Record<string, number>
  isCurrentMonth: boolean
  isToday: boolean
  selectedPostId: string | null
  onSelectPost: (id: string) => void
  onAddPost?: (date: Date) => void
}

function CalendarCell({ day, posts, commentCounts, isCurrentMonth, isToday, selectedPostId, onSelectPost, onAddPost }: CellProps) {
  return (
    <div className={`calendar-cell ${!isCurrentMonth ? 'out-of-month' : ''} ${isToday ? 'today' : ''}`}>
      <div className="cell-header">
        <span className={`cell-date ${isToday ? 'today-badge' : ''}`}>
          {format(day, 'd')}
        </span>
        {isCurrentMonth && onAddPost && (
          <button
            className="cell-add-btn"
            title="Add post"
            onClick={() => onAddPost(day)}
          >
            <Plus size={11} />
          </button>
        )}
      </div>

      <div className="cell-posts">
        {posts.map(post => (
          <PostChip
            key={post.id}
            post={post}
            commentCount={commentCounts[post.id] ?? 0}
            isSelected={post.id === selectedPostId}
            onClick={() => onSelectPost(post.id)}
          />
        ))}
      </div>
    </div>
  )
}

function PostChip({ post, commentCount, isSelected, onClick }: { post: Post; commentCount: number; isSelected: boolean; onClick: () => void }) {
  const statusColor = STATUS_COLORS[post.status] ?? 'var(--status-draft)'

  return (
    <button
      className={`post-chip ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      title={post.title}
      style={{ 
        borderLeftColor: statusColor,
        backgroundColor: `color-mix(in srgb, ${statusColor} 15%, transparent)`
      }}
    >
      <div className="post-chip-platforms">
        {(post.platforms as Platform[]).slice(0, 4).map(platform => {
          const Icon = PLATFORM_ICONS[platform]
          const color = PLATFORM_COLORS[platform]
          return Icon ? (
            <span key={platform} className="platform-chip-icon" style={{ color }}>
              <Icon size={12} />
            </span>
          ) : null
        })}
        {post.platforms.length > 4 && (
          <span className="platform-more">+{post.platforms.length - 4}</span>
        )}
      </div>
      <span className="post-chip-title">{post.title}</span>
      {commentCount > 0 && (
        <span className="post-chip-comments" title={`${commentCount} client comment${commentCount !== 1 ? 's' : ''}`}>
          💬 {commentCount}
        </span>
      )}
    </button>
  )
}
