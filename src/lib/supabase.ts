import { createClient } from '@supabase/supabase-js'

const env = import.meta.env

export const SUPABASE_URL = String(env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
export const SUPABASE_ANON_KEY = String(env.VITE_SUPABASE_ANON_KEY ?? '')
export const backendReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

const fallbackUrl = 'https://placeholder.supabase.co'
const fallbackKey = 'placeholder-anon-key'

/**
 * One browser client for the storefront and the admin portal. Only the anon
 * key is ever shipped; privileged work happens inside security-definer RPCs
 * and the Edge Function worker.
 */
export const supabase = createClient(SUPABASE_URL || fallbackUrl, SUPABASE_ANON_KEY || fallbackKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'halas.admin.session',
    flowType: 'pkce',
  },
  global: {
    headers: { 'x-application-name': 'halas-storefront' },
  },
})
