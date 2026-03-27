import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Comment, CommentThread as ThreadType } from '../../types'
import { format } from 'date-fns'
import { Lock, Check, Send, CornerDownRight, Trash2 } from 'lucide-react'
import { sendNotification, escapeHtml } from '../../lib/notifications'
import './CommentThread.css'

interface CommentThreadProps {
  postId: string
  isTeam: boolean
  workspaceId: string
  magicLinkToken?: string
  clientName?: string
}

export default function CommentThread({ postId, isTeam, workspaceId, magicLinkToken, clientName: propClientName }: CommentThreadProps) {
  const { profile } = useAuth()

  // Client name state — for portal users who haven't set a name yet
  const [clientName, setClientName] = useState(propClientName ?? '')
  const [nameConfirmed, setNameConfirmed] = useState(!!propClientName || isTeam)
  const [nameInput, setNameInput] = useState('')

  const [internalComments, setInternalComments] = useState<Comment[]>([])
  const [clientComments, setClientComments] = useState<Comment[]>([])
  const [internalInput, setInternalInput] = useState('')
  const [clientInput, setClientInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null)
  const [teamEmails, setTeamEmails] = useState<string[]>([])

  const authorName = isTeam
    ? (profile?.full_name ?? profile?.email ?? 'Team')
    : clientName || 'Client'

  useEffect(() => { load() }, [postId])

  async function load() {
    if (isTeam) {
      const { data: ic } = await supabase
        .from('comments').select('*')
        .eq('post_id', postId).eq('thread', 'internal')
        .order('created_at')
      setInternalComments(ic ?? [])

      const { data: members } = await supabase
        .from('workspace_members')
        .select(`profiles (email)`)
        .eq('workspace_id', workspaceId)
      if (members) {
        setTeamEmails(members.map((m: any) => m.profiles.email).filter(Boolean))
      }
    }
    const { data: cc } = await supabase
      .from('comments').select('*')
      .eq('post_id', postId).eq('thread', 'client')
      .order('created_at')
    setClientComments(cc ?? [])
  }

  async function addComment(thread: ThreadType, body: string, replyTo?: Comment) {
    if (!body.trim()) return
    setSubmitting(true)

    const fullBody = replyTo
      ? `@${replyTo.author_name}: ${body.trim()}`
      : body.trim()

    const { data: newComment, error } = await supabase.from('comments').insert({
      post_id: postId,
      author_id: profile?.id ?? null,
      author_name: authorName,
      body: fullBody,
      thread,
      is_resolved: false,
      parent_id: replyTo?.id ?? null,
    }).select().single()

    if (!error && newComment) {
      const mentionMatch = fullBody.match(/@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)
      if (mentionMatch) {
        for (const match of mentionMatch) {
          const email = match.substring(1)
          
          const magicUrl = magicLinkToken 
            ? `${window.location.origin}/review/${magicLinkToken}?post=${postId}` 
            : `${window.location.origin}`

          sendNotification(
            workspaceId, 
            'mention', 
            `New Mention: ${authorName}`, 
            `<h2>You were mentioned!</h2>
             <p><strong>${escapeHtml(authorName)}</strong> mentioned you in a comment:</p>
             <blockquote style="border-left: 4px solid #E5E2DC; padding-left: 10px; color: #444; margin: 10px 0;">
               <i>"${escapeHtml(fullBody)}"</i>
             </blockquote>
             ${magicLinkToken 
               ? `<br/><a href="${magicUrl}" style="display: inline-block; padding: 10px 20px; background: #14473e; color: white; text-decoration: none; border-radius: 4px;">View in Client Portal</a>` 
               : '<p>Log in to the Noble West Social Review Tool to view.</p>'}`, 
            email
          )
        }
      }
    }

    if (thread === 'internal') setInternalInput('')
    else setClientInput('')
    setReplyingTo(null)
    load()
    setSubmitting(false)
  }

  async function toggleResolve(comment: Comment) {
    await supabase.from('comments').update({ is_resolved: !comment.is_resolved }).eq('id', comment.id)
    load()
  }

  async function deleteComment(comment: Comment) {
    if (!confirm('Are you sure you want to delete this comment?')) return
    await supabase.from('comments').delete().eq('id', comment.id)
    load()
  }

  // Client name capture (for portal users)
  if (!nameConfirmed && !isTeam) {
    return (
      <div className="client-name-prompt">
        <p className="client-name-prompt-title">What's your name?</p>
        <p className="client-name-prompt-sub">Your name will appear on your comments so the team knows who's talking.</p>
        <div className="comment-input-row">
          <input
            className="form-input comment-input"
            placeholder="Your name"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && nameInput.trim()) {
                setClientName(nameInput.trim())
                setNameConfirmed(true)
              }
            }}
            autoFocus
          />
          <button
            className="btn btn-primary btn-sm"
            disabled={!nameInput.trim()}
            onClick={() => { setClientName(nameInput.trim()); setNameConfirmed(true) }}
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="comment-threads">
      {/* Internal thread — NW team only */}
      {isTeam && (
        <div className="thread-section thread-internal">
          <div className="thread-label">
            <Lock size={11} /> Internal Thread
            <span className="badge badge-internal" style={{ marginLeft: 6 }}>NW Team Only</span>
          </div>
          <CommentList
            comments={internalComments}
            canResolve={isTeam}
            onToggleResolve={toggleResolve}
            onDelete={deleteComment}
            replyingTo={replyingTo}
            onReply={setReplyingTo}
          />
          <CommentInput
            value={internalInput}
            onChange={setInternalInput}
            onSubmit={() => addComment('internal', internalInput, replyingTo ?? undefined)}
            onCancelReply={() => setReplyingTo(null)}
            replyingTo={replyingTo}
            submitting={submitting}
            placeholder="Add an internal note…"
            teamEmails={teamEmails}
          />
        </div>
      )}

      {isTeam && <div className="divider" />}

      {/* Client thread — visible to both */}
      <div className="thread-section thread-client">
        <div className="thread-label">
          {isTeam ? (
            <>
              <span className="badge badge-client" style={{ marginRight: 6 }}>Client Thread</span>
              Visible to you and your client
            </>
          ) : (
            <>
              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                Commenting as <span style={{ color: 'var(--color-forester)' }}>{authorName}</span>
              </span>
            </>
          )}
        </div>
        <CommentList
          comments={clientComments}
          canResolve={isTeam}
          onToggleResolve={toggleResolve}
          onDelete={deleteComment}
          replyingTo={replyingTo}
          onReply={setReplyingTo}
        />
        <CommentInput
          value={clientInput}
          onChange={setClientInput}
          onSubmit={() => addComment('client', clientInput, replyingTo ?? undefined)}
          onCancelReply={() => setReplyingTo(null)}
          replyingTo={replyingTo}
          submitting={submitting}
          placeholder={isTeam ? 'Add a client-visible comment…' : 'Leave a comment or feedback…'}
          teamEmails={isTeam ? teamEmails : undefined}
        />
      </div>
    </div>
  )
}

type CommentNode = Comment & { children: CommentNode[] }

function buildTree(flat: Comment[]): CommentNode[] {
  const map = new Map<string, CommentNode>()
  const roots: CommentNode[] = []
  
  for (const c of flat) {
    map.set(c.id, { ...c, children: [] })
  }
  
  for (const c of flat) {
    const node = map.get(c.id)!
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

function CommentList({ comments, canResolve, onToggleResolve, onDelete, replyingTo, onReply }: {
  comments: Comment[]
  canResolve: boolean
  onToggleResolve: (c: Comment) => void
  onDelete: (c: Comment) => void
  replyingTo: Comment | null
  onReply: (c: Comment) => void
}) {
  if (comments.length === 0) {
    return <p className="no-comments">No comments yet.</p>
  }

  const tree = buildTree(comments)

  const renderTree = (nodes: CommentNode[], depth = 0) => {
    return nodes.map(c => (
      <div key={c.id} className="comment-thread-group">
        <div style={{ marginLeft: depth * 28, position: 'relative' }} className={`comment-item ${c.is_resolved ? 'resolved' : ''} ${replyingTo?.id === c.id ? 'replying' : ''}`}>
          {depth > 0 && (
            <div style={{ position: 'absolute', left: -14, top: 12, width: 10, height: 10, borderBottom: '1.5px solid var(--color-border)', borderLeft: '1.5px solid var(--color-border)', borderBottomLeftRadius: 4 }} />
          )}
          <div className="comment-header">
            <div className="comment-author-avatar">
              {(c.author_name ?? '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="comment-meta">
              <span className="comment-author">{c.author_name ?? 'Unknown'}</span>
              <span className="comment-time">{format(new Date(c.created_at), 'MMM d, h:mm a')}</span>
            </div>
            <div className="comment-actions">
              <button
                className="btn btn-ghost btn-sm comment-reply-btn"
                onClick={() => onReply(replyingTo?.id === c.id ? null as any : c)}
                title="Reply"
              >
                <CornerDownRight size={12} /> Reply
              </button>
              {canResolve && (
                <button
                  className={`btn btn-sm btn-icon comment-resolve-btn ${c.is_resolved ? 'resolved' : ''}`}
                  onClick={() => onToggleResolve(c)}
                  title={c.is_resolved ? 'Mark unresolved' : 'Mark resolved'}
                >
                  <Check size={13} />
                </button>
              )}
              {canResolve && (
                <button
                  className="btn btn-sm btn-icon comment-delete-btn"
                  onClick={() => onDelete(c)}
                  title="Delete comment"
                  style={{ color: 'var(--color-error, #D32F2F)' }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
          <p className="comment-body">{c.body}</p>
        </div>
        
        {c.children.length > 0 && (
          <div className="comment-replies">
            {renderTree(c.children, depth + 1)}
          </div>
        )}
      </div>
    ))
  }

  return (
    <div className="comment-list">
      {renderTree(tree)}
    </div>
  )
}

function CommentInput({ value, onChange, onSubmit, onCancelReply, replyingTo, submitting, placeholder, teamEmails }: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onCancelReply: () => void
  replyingTo: Comment | null
  submitting: boolean
  placeholder: string
  teamEmails?: string[]
}) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])

  useEffect(() => {
    if (!teamEmails || teamEmails.length === 0) return
    const words = value.split(' ')
    const lastWord = words[words.length - 1]

    if (lastWord.startsWith('@')) {
      const search = lastWord.slice(1).toLowerCase()
      const matches = teamEmails.filter(e => e.toLowerCase().includes(search))
      if (matches.length > 0) {
        setSuggestions(matches)
        setShowDropdown(true)
      } else {
        setShowDropdown(false)
      }
    } else {
      setShowDropdown(false)
    }
  }, [value, teamEmails])

  function handleSelect(email: string) {
    const words = value.split(' ')
    words.pop()
    words.push(`@${email} `)
    onChange(words.join(' '))
    setShowDropdown(false)
  }

  return (
    <div className="comment-input-area" style={{ position: 'relative' }}>
      {showDropdown && (
        <div className="mention-autocomplete">
          {suggestions.map(email => (
            <div key={email} className="mention-item" onClick={() => handleSelect(email)}>
              {email}
            </div>
          ))}
        </div>
      )}
      {replyingTo && (
        <div className="reply-indicator">
          <CornerDownRight size={12} />
          <span>Replying to <strong>{replyingTo.author_name}</strong></span>
          <button className="btn btn-ghost btn-sm" onClick={onCancelReply}>Cancel</button>
        </div>
      )}
      <div className="comment-input-row">
        <input
          className="form-input comment-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && onSubmit()}
          placeholder={placeholder}
          disabled={submitting}
        />
        <button
          className="btn btn-primary btn-sm btn-icon"
          onClick={onSubmit}
          disabled={submitting || !value.trim()}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
