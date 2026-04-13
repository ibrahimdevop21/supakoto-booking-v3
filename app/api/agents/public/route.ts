import { NextResponse } from 'next/server'
import { formatAgentDisplayName } from '@/lib/agent-display-name'
import { createServiceClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function isMissingColumnError(err: { message?: string; code?: string } | null) {
  const m = (err?.message ?? '').toLowerCase()
  return (
    err?.code === '42703' ||
    (m.includes('column') && m.includes('does not exist')) ||
    (m.includes('schema cache') && m.includes('username'))
  )
}

export async function GET() {
  const service = createServiceClient()
  const supabase = service ?? (await createClient())

  if (!service && process.env.NODE_ENV === 'development') {
    console.warn(
      '[agents/public] No SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY — using anon. ' +
        'If the list is empty, add a server secret in .env.local or run supabase/agents_anon_read_policy.sql in the SQL editor.'
    )
  }

  type Row = { id: string; name: string; username?: string | null; user_id?: string | null }

  let rows: Row[] | null = null
  let error: { message: string; code?: string } | null = null

  const first = await supabase
    .from('agents')
    .select('id, name, username, user_id')
    .eq('is_active', true)
    .order('name')

  rows = first.data as Row[] | null
  error = first.error

  if (error && isMissingColumnError(error)) {
    const second = await supabase
      .from('agents')
      .select('id, name, user_id')
      .eq('is_active', true)
      .order('name')
    rows = second.data as Row[] | null
    error = second.error
  }

  if (error) {
    console.error('agents/public:', error.message, error)
    return NextResponse.json([], { status: 500 })
  }

  return NextResponse.json(
    (rows ?? []).map((a) => ({
      id: a.id,
      name: formatAgentDisplayName(a.name),
      username: a.username ?? null,
    }))
  )
}
