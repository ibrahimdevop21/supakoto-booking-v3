import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { password, ...agentUpdates } = body
    const service = createServiceClient()

    let agentData: any = null

    if (Object.keys(agentUpdates).length > 0) {
      const { data, error } = await service
        .from('agents')
        .update(agentUpdates)
        .eq('id', id)
        .select('*, branches(name)')
        .single()
      if (error) throw error
      agentData = data
    } else {
      const { data, error } = await service
        .from('agents')
        .select('*, branches(name)')
        .eq('id', id)
        .single()
      if (error) throw error
      agentData = data
    }

    if (password && agentData?.user_id) {
      const { error: pwError } = await service.auth.admin
        .updateUserById(agentData.user_id, { password })
      if (pwError) throw pwError
    }

    return NextResponse.json(agentData)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const service = createServiceClient()
    const { error } = await service
      .from('agents')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
