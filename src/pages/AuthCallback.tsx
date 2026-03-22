import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * Dedicated OAuth callback page.
 * With implicit flow, Supabase returns tokens in the URL hash.
 * The SDK reads these synchronously during init.
 * We just wait for onAuthStateChange to confirm the session, then navigate.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [debugInfo, setDebugInfo] = useState<string>('')

  useEffect(() => {
    const hash = window.location.hash
    const search = window.location.search

    // Debug: log what we got in the URL
    console.log('[AuthCallback] URL hash:', hash)
    console.log('[AuthCallback] URL search:', search)
    setDebugInfo(`hash: ${hash.slice(0, 60) || 'none'} | search: ${search || 'none'}`)

    // With implicit flow, the SDK should already have the session from the hash.
    // getSession() will return it if available.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('[AuthCallback] getSession:', { hasSession: !!session, error })

      if (error) {
        console.error('[AuthCallback] error:', error.message)
        navigate('/login', { replace: true })
      } else if (session) {
        navigate('/', { replace: true })
      } else {
        // Fallback: listen for onAuthStateChange in case the token
        // is still being processed from the hash
        console.log('[AuthCallback] No session yet, waiting for auth state change…')
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          console.log('[AuthCallback] onAuthStateChange:', event, !!session)
          if (session) {
            subscription.unsubscribe()
            navigate('/', { replace: true })
          } else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
            subscription.unsubscribe()
            navigate('/login', { replace: true })
          }
        })
        // Timeout fallback after 5 seconds
        setTimeout(() => {
          subscription.unsubscribe()
          navigate('/login', { replace: true })
        }, 5000)
      }
    })
  }, [navigate])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--color-bg)',
      flexDirection: 'column', gap: '16px'
    }}>
      <img src="/nw-logo-forester.png" alt="Noble West" style={{ height: 36, opacity: 0.7 }} />
      <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Signing you in…
      </p>
      {debugInfo && (
        <p style={{ color: '#999', fontSize: '10px', maxWidth: 400, wordBreak: 'break-all' }}>{debugInfo}</p>
      )}
    </div>
  )
}
