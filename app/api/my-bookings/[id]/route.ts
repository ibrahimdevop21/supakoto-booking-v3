import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const {
      agentId, customerName, customerPhone, carModel,
      service, amount, notes, appointmentDate, status
    } = body

    const supabase = await createClient()

    // Verify this booking belongs to this agent
    const { data: existing } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .eq('agent_id', agentId)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'الحجز مش موجود أو مش تبعك' },
        { status: 404 }
      )
    }

    // If date is changing, check capacity
    if (appointmentDate && appointmentDate !== existing.appointment_date) {
      // Check freeze
      const { data: freezes } = await supabase
        .from('branch_freezes')
        .select('*')
        .lte('freeze_start', appointmentDate)
        .gte('freeze_end', appointmentDate)

      const frozen = freezes?.some(
        f => f.branch_id === null || f.branch_id === existing.branch_id
      )

      if (frozen) {
        return NextResponse.json(
          { error: 'التاريخ الجديد في فترة تجميد' },
          { status: 403 }
        )
      }

      // Check capacity on new date
      const { data: branch } = await supabase
        .from('branches')
        .select('daily_cap')
        .eq('id', existing.branch_id)
        .single()

      const { count } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', existing.branch_id)
        .eq('appointment_date', appointmentDate)
        .neq('status', 'CANCELLED')
        .neq('id', id) // exclude current booking

      const booked = count ?? 0
      if (booked >= (branch?.daily_cap ?? 0)) {
        return NextResponse.json(
          { error: 'الفرع ممتلئ في التاريخ الجديد' },
          { status: 409 }
        )
      }
    }

    // Re-confirm to CONFIRMED (same date): freeze + capacity
    const targetStatus = status !== undefined ? status : existing.status
    const sameDate =
      !appointmentDate || appointmentDate === existing.appointment_date
    if (
      targetStatus === 'CONFIRMED' &&
      sameDate &&
      existing.status !== 'CONFIRMED' &&
      (existing.status === 'CANCELLED' || existing.status === 'ON-HOLD')
    ) {
      const checkDate = existing.appointment_date

      const { data: freezes } = await supabase
        .from('branch_freezes')
        .select('*')
        .lte('freeze_start', checkDate)
        .gte('freeze_end', checkDate)

      const fr = freezes?.some(
        f => f.branch_id === null || f.branch_id === existing.branch_id
      )
      if (fr) {
        return NextResponse.json(
          { error: 'الفرع مش بيستقبل حجوزات في التاريخ ده' },
          { status: 403 }
        )
      }

      const { data: branch } = await supabase
        .from('branches')
        .select('daily_cap')
        .eq('id', existing.branch_id)
        .single()

      const { count } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', existing.branch_id)
        .eq('appointment_date', checkDate)
        .neq('status', 'CANCELLED')
        .neq('id', id)

      const others = count ?? 0
      const cap = branch?.daily_cap ?? 0
      if (others >= cap) {
        return NextResponse.json(
          { error: 'الفرع وصل للطاقة الاستيعابية في التاريخ ده' },
          { status: 409 }
        )
      }
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    if (customerName !== undefined) updates.customer_name = customerName.trim()
    if (customerPhone !== undefined) {
      let phone = customerPhone.replace(/\D/g, '')
      if (phone.startsWith('20') && phone.length === 12) phone = phone.slice(2)
      if (phone.length === 10 && !phone.startsWith('0')) phone = '0' + phone
      updates.customer_phone = phone
      updates.customer_phone_raw = customerPhone.trim()
    }
    if (carModel !== undefined) updates.car_model = carModel.trim() || null
    if (service !== undefined) updates.service = service.trim()
    if (amount !== undefined) updates.amount = amount?.trim() || null
    if (notes !== undefined) updates.notes = notes?.trim() || null
    if (appointmentDate !== undefined) updates.appointment_date = appointmentDate
    if (status !== undefined) updates.status = status

    const { data, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .eq('agent_id', agentId)
      .select('*, branches(name)')
      .single()

    if (error) throw error
    return NextResponse.json(data)

  } catch (err) {
    console.error('Update booking error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}
