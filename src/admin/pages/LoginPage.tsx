import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '../../useDocumentTitle'
import { useAuth } from '../auth'
import { IconArrowRight, IconLock } from '../icons'
import { Notice } from '../ui'
import { SetupPage } from './SetupPage'

export function LoginPage() {
  useDocumentTitle('Administrator sign in — HALA.S Admin')
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<'sign-in' | 'reset'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null)

  if (auth.status === 'unconfigured') return <SetupPage />
  if (auth.status === 'authorized') {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from.startsWith('/admin') ? from : '/admin'} replace />
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      if (mode === 'sign-in') {
        await auth.signIn(email, password)
        const from = (location.state as { from?: string } | null)?.from
        navigate(from && from.startsWith('/admin') ? from : '/admin', { replace: true })
      } else {
        await auth.requestReset(email)
        setNotice({
          tone: 'success',
          text: 'If that address belongs to an administrator, a secure reset link is on its way. Check the inbox and spam folder.',
        })
      }
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unable to complete that request.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-auth">
      <section className="admin-auth__brand" aria-hidden="true">
        <div>
          <p className="admin-eyebrow">HALA.S CLOTHING</p>
          <p className="admin-auth__wordmark">HALA.S</p>
          <p className="admin-auth__tagline">The private studio behind the storefront.</p>
        </div>
        <p className="admin-auth__quote">
          “Every order, every piece, every dispatch — held in one considered place.”
        </p>
      </section>

      <main className="admin-auth__panel">
        <div className="admin-auth__card">
          <p className="admin-eyebrow">{mode === 'sign-in' ? 'Administrator access' : 'Password recovery'}</p>
          <h1>{mode === 'sign-in' ? 'Welcome back.' : 'Reset your password.'}</h1>
          <p className="admin-muted">
            {mode === 'sign-in'
              ? 'Sign in to manage products, orders, deliveries and the live storefront.'
              : 'Enter the administrator email address and we will send a secure reset link. This page never reveals whether an account exists.'}
          </p>

          {auth.status === 'forbidden' && mode === 'sign-in' && (
            <Notice tone="warning">
              The account that just signed in does not have administrator access. Use an administrator email or ask
              the site owner to grant the role.
            </Notice>
          )}

          <form onSubmit={submit} className="admin-auth__form">
            <label className="admin-field">
              <span className="admin-field__label">Email address</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@halas.example"
              />
            </label>

            {mode === 'sign-in' && (
              <label className="admin-field">
                <span className="admin-field__label">Password</span>
                <span className="admin-password">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </span>
              </label>
            )}

            {notice && (
              <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
                {notice.text}
              </Notice>
            )}

            <button type="submit" className="admin-btn admin-btn--primary admin-auth__submit" disabled={busy}>
              {busy ? 'Working…' : mode === 'sign-in' ? 'Sign in' : 'Send reset link'}
              {!busy && <IconArrowRight />}
            </button>
          </form>

          <div className="admin-auth__links">
            {mode === 'sign-in' ? (
              <>
                <button type="button" className="admin-link" onClick={() => setMode('reset')}>
                  Forgot your password?
                </button>
                <span className="admin-muted">
                  <IconLock /> Protected by Supabase Auth and row-level security.
                </span>
              </>
            ) : (
              <button type="button" className="admin-link" onClick={() => setMode('sign-in')}>
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
