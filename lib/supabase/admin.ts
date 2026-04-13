import { createClient } from '@supabase/supabase-js'

/**
 * Server-only client with elevated access. Use only in Route Handlers / Server Actions
 * for operations that must bypass RLS (e.g. public agent picker).
 *
 * Supports:
 * - New platform secret keys (`sb_secret_...`): `SUPABASE_SECRET_KEY`
 * - Legacy JWT `service_role`: `SUPABASE_SERVICE_ROLE_KEY`
 *
 * Never expose these to the browser.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
