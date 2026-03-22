import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Profile | null
  isAdmin: boolean
  isTeam: boolean
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  // Start loading = true. We will ONLY set it false once onAuthStateChange has fired.
  // This prevents the router from redirecting to /login before Supabase finishes
  // reading the #access_token hash from the URL after OAuth redirect.
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Listen for all subsequent auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    // 2. Eagerly get the current session (handles existing tab sessions)
    //    The callback page handles the PKCE code exchange before we get here,
    //    so this is safe to call without race conditions.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setLoading(false)
      // If there IS a session, onAuthStateChange will fire and handle it
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const user = session?.user ?? null
  const isAdmin = profile?.role === 'nw_admin'
  const isTeam = profile?.role === 'nw_team' || isAdmin

  return (
    <AuthContext.Provider value={{ session, user, profile, isAdmin, isTeam, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
