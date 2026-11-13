import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { backendReady, supabase } from '../lib/supabase'

export type AuthStatus = 'loading' | 'signed-out' | 'authorized' | 'forbidden' | 'unconfigured'

interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  user: User | null
  recovering: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  requestReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  clearRecovery: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const verifyAdmin = async (session: Session | null): Promise<AuthStatus> => {
  if (!session) return 'signed-out'
  const { data, error } = await supabase.rpc('is_admin')
  if (error) return 'forbidden'
  return data === true ? 'authorized' : 'forbidden'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(backendReady ? 'loading' : 'unconfigured')
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    if (!backendReady) return

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!alive.current) return
        const verified = await verifyAdmin(data.session)
        if (!alive.current) return
        setSession(data.session)
        setUser(data.session?.user ?? null)
        setStatus(verified)
      })
      .catch(() => {
        if (alive.current) setStatus('signed-out')
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Defer Supabase calls out of the auth callback to avoid deadlocks.
      setTimeout(async () => {
        if (!alive.current) return
        if (event === 'PASSWORD_RECOVERY') setRecovering(true)
        if (event === 'SIGNED_OUT' || !nextSession) {
          setSession(null)
          setUser(null)
          setStatus('signed-out')
          return
        }
        setSession(nextSession)
        setUser(nextSession.user)
        const verified = await verifyAdmin(nextSession)
        if (alive.current) setStatus(verified)
      }, 0)
    })

    return () => {
      alive.current = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!backendReady) throw new Error('Supabase is not configured for this deployment.')
    setError(null)
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (signInError) throw new Error(signInError.message)
    const verified = await verifyAdmin(data.session)
    if (verified !== 'authorized') {
      await supabase.auth.signOut()
      setStatus('forbidden')
      throw new Error('This account does not have administrator access.')
    }
    setSession(data.session)
    setUser(data.session?.user ?? null)
    setStatus('authorized')
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setStatus('signed-out')
    setRecovering(false)
  }, [])

  const requestReset = useCallback(async (email: string) => {
    if (!backendReady) throw new Error('Supabase is not configured for this deployment.')
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    })
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) throw new Error(updateError.message)
    setRecovering(false)
  }, [])

  const clearRecovery = useCallback(() => setRecovering(false), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user,
      recovering,
      error,
      signIn,
      signOut,
      requestReset,
      updatePassword,
      clearRecovery,
    }),
    [status, session, user, recovering, error, signIn, signOut, requestReset, updatePassword, clearRecovery],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
