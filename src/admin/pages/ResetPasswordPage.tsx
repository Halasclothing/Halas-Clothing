import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '../../useDocumentTitle'
import { useAuth } from '../auth'
import { IconArrowRight, IconLock } from '../icons'
import { Notice } from '../ui'

export function ResetPasswordPage() {
  useDocumentTitle('Reset password — HALA.S Admin')
  const auth = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const canReset = auth.recovering || Boolean(auth.session)

  const update = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (password.length < 8) {
      setError('Choose a password of at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await auth.updatePassword(password)
      navigate('/admin', { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The password could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  const request = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await auth.requestReset(email)
      setSent(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The reset link could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-auth admin-auth--single">
      <main className="admin-auth__panel">
        <div className="admin-auth__card">
          <p className="admin-eyebrow">Administrator access</p>
          <h1>{canReset ? 'Choose a new password.' : 'Password recovery.'}</h1>

          {canReset ? (
            <>
              <p className="admin-muted">
                The reset link has been verified. Choose a new password for {auth.user?.email ?? 'your account'}.
              </p>
              <form onSubmit={update} className="admin-auth__form">
                <label className="admin-field">
                  <span className="admin-field__label">New password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <span className="admin-field__hint">Use at least 8 characters.</span>
                </label>
                <label className="admin-field">
                  <span className="admin-field__label">Confirm new password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                  />
                </label>
                {error && <Notice tone="error">{error}</Notice>}
                <button type="submit" className="admin-btn admin-btn--primary admin-auth__submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save new password'}
                  {!busy && <IconArrowRight />}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="admin-muted">
                Open the reset link from your administrator email. Links expire quickly for security. If it has
                expired, request a new one below.
              </p>
              {sent ? (
                <Notice tone="success">
                  If that address belongs to an administrator, a new reset link is on its way. Check the inbox and
                  spam folder.
                </Notice>
              ) : (
                <form onSubmit={request} className="admin-auth__form">
                  <label className="admin-field">
                    <span className="admin-field__label">Administrator email</span>
                    <input
                      type="email"
                      autoComplete="username"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  {error && <Notice tone="error">{error}</Notice>}
                  <button type="submit" className="admin-btn admin-btn--primary admin-auth__submit" disabled={busy}>
                    {busy ? 'Sending…' : 'Email a reset link'}
                    {!busy && <IconArrowRight />}
                  </button>
                </form>
              )}
            </>
          )}

          <div className="admin-auth__links">
            <Link className="admin-link" to="/admin/login">
              Back to sign in
            </Link>
            <span className="admin-muted">
              <IconLock /> Reset links are single-use and time-limited.
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
