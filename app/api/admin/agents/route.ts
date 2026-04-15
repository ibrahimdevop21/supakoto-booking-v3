import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createAnonClient } from '@/lib/supabase/anon'

export async function GET() {
  try {
    const supabase = createAnonClient()
    const { data, error } = await supabase
      .from('agents')
      .select('*, branches(name)')
      .order('name')
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role, branchId } = await req.json()

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'الاسم والإيميل وكلمة المرور والدور مطلوبين' },
        { status: 400 }
      )
    }

    const service = createServiceClient()

    // Create auth user
    const { data: authData, error: authError } =
      await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    // Get username from email
    const username = email.split('@')[0]

    // Create agent record
    const { data: agent, error: agentError } = await service
      .from('agents')
      .insert({
        user_id: authData.user.id,
        name: name.trim(),
        role,
        branch_id: branchId || null,
        username,
        is_active: true,
      })
      .select('*, branches(name)')
      .single()

    if (agentError) {
      // Rollback: delete auth user
      await service.auth.admin.deleteUser(authData.user.id)
      throw agentError
    }

    return NextResponse.json(agent, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
