// ─── Enums ──────────────────────────────────────────────────────────────────

export type UserRole = 'nw_admin' | 'nw_team' | 'client'

export type NotificationPref = 'immediate' | 'digest' | 'off'

export type Platform =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'tiktok'
  | 'x'
  | 'pinterest'

export type PostStatus = 'draft' | 'pending_review' | 'needs_revision' | 'approved'

export type AssetType = 'image' | 'gif' | 'video_link'

// Represents a single image or GIF in a multi-asset carousel
export interface PostAsset {
  url: string
  type: 'image' | 'gif'
}

export type CommentThread = 'internal' | 'client'

// ─── Database Row Types ──────────────────────────────────────────────────────

export interface Organization {
  id: string
  name: string
  created_at: string
}

export interface Workspace {
  id: string
  org_id: string
  name: string
  slug: string
  magic_link_token: string
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  notification_pref: NotificationPref
  digest_time: string // HH:MM format
  created_at: string
}

export interface WorkspaceMember {
  workspace_id: string
  user_id: string
  created_at: string
  profile?: Profile
}

export interface Calendar {
  id: string
  workspace_id: string
  month: number // 1–12
  year: number
  created_at: string
}

export interface Post {
  id: string
  calendar_id: string
  title: string
  proposed_date: string // ISO date string YYYY-MM-DD
  platforms: Platform[]
  copy: string // rich text HTML
  assets: PostAsset[]       // multi-image / GIF carousel (NEW)
  asset_url: string | null  // kept for video_link only
  asset_type: AssetType | null  // 'video_link' or null
  notes: string | null // internal
  usage_rights: string | null
  status: PostStatus
  created_at: string
  updated_at: string
  created_by: string
}

export interface PostChangeLog {
  id: string
  post_id: string
  user_id: string | null
  user_name: string | null // for display
  note: string
  created_at: string
}

export interface Comment {
  id: string
  post_id: string
  author_id: string | null
  author_name: string | null
  body: string
  thread: CommentThread
  is_resolved: boolean
  parent_id?: string | null
  created_at: string
}

export interface Mention {
  id: string
  comment_id: string
  mentioned_email: string
  notified_at: string | null
  created_at: string
}

// ─── Extended / Joined Types ─────────────────────────────────────────────────

export interface WorkspaceWithMembers extends Workspace {
  members?: WorkspaceMember[]
}

export interface PostWithComments extends Post {
  internal_comments?: Comment[]
  client_comments?: Comment[]
  change_log?: PostChangeLog[]
}

// ─── UI State Types ──────────────────────────────────────────────────────────

export interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  posts: Post[]
}

// Magic link client session (no Supabase auth)
export interface ClientSession {
  workspace: Workspace
  isClient: true
}
