import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      branchId, agentId, customerName, customerPhone,
      carModel, service, amount, appointmentDate, notes,
      bypassDuplicate, addons,
    } = body

    if (!branchId || !agentId || !customerName ||
        !customerPhone || !service || !appointmentDate) {
      return NextResponse.json(
        { error: 'كل الحقول المطلوبة لازم تتملى' },
        { status: 400 }
      )
    }

    let supabase
    try {
      supabase = await createClient()
    } catch (e) {
      console.error('bookings POST createClient:', e)
      return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
    }

    // Check freeze
    const { data: freezes } = await supabase
      .from('branch_freezes')
      .select('*')
      .lte('freeze_start', appointmentDate)
      .gte('freeze_end', appointmentDate)

    const frozen = freezes?.some(
      f => f.branch_id === null || f.branch_id === branchId
    )

    if (frozen) {
      return NextResponse.json(
        { error: 'الفرع مش بيستقبل حجوزات في التاريخ ده' },
        { status: 403 }
      )
    }

    // Check capacity
    const { data: branch } = await supabase
      .from('branches')
      .select('daily_cap')
      .eq('id', branchId)
      .single()

    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('appointment_date', appointmentDate)
      .neq('status', 'CANCELLED')

    const booked = count ?? 0
    if (booked >= (branch?.daily_cap ?? 0)) {
      return NextResponse.json(
        { error: 'الفرع وصل للطاقة الاستيعابية في التاريخ ده' },
        { status: 409 }
      )
    }

    // Normalize phone
    let phone = customerPhone.replace(/\D/g, '')
    if (phone.startsWith('20') && phone.length === 12) phone = phone.slice(2)
    if (phone.length === 10 && !phone.startsWith('0')) phone = '0' + phone

    // Duplicate phone (any date): query by phone only; branch on agent vs bypass
    const { data: existing } = await supabase
      .from('bookings')
      .select(
        'id, agent_id, appointment_date, service, agents!agent_id(name), branches!branch_id(name)'
      )
      .eq('customer_phone', phone)
      .neq('status', 'CANCELLED')
      .limit(1)

    if (existing && existing.length > 0) {
      const ex = existing[0] as {
        id: string
        agent_id: string
        agents?: { name?: string } | null
        branches?: { name?: string } | null
        appointment_date?: string
        service?: string
      }

      if (ex.agent_id !== agentId) {
        const { error: logErr } = await supabase.from('duplicate_log').insert({
          attempted_by: agentId,
          customer_phone: phone,
          appointment_date: appointmentDate,
          branch_id: branchId,
          existing_agent: ex.agent_id,
          existing_booking_id: ex.id,
        })
        if (logErr) console.error('duplicate_log insert:', logErr)

        return NextResponse.json(
          {
            error: 'هذا العميل محجوز مسبقاً',
            isDuplicate: true,
            duplicateType: 'different_agent',
            existingBooking: {
              agentName: ex.agents?.name ?? 'مندوب آخر',
              branchName: ex.branches?.name ?? '',
              date: ex.appointment_date ?? '',
              service: ex.service ?? '',
            },
            message: 'تم إرسال هذه المحاولة للإدارة مع التوقيت',
          },
          { status: 409 }
        )
      }

      if (ex.agent_id === agentId && !bypassDuplicate) {
        return NextResponse.json(
          {
            error: 'العميل ده عنده حجز تبعك بالفعل',
            isDuplicate: true,
            duplicateType: 'same_agent',
            existingBooking: {
              agentName: ex.agents?.name ?? '',
              branchName: ex.branches?.name ?? '',
              date: ex.appointment_date ?? '',
              service: ex.service ?? '',
            },
            message: 'هل تريد الحجز لسيارة تانية لنفس العميل؟',
          },
          { status: 409 }
        )
      }
    }

    const addonsList = Array.isArray(addons)
      ? addons.map((x: unknown) => String(x))
      : []

    // Insert booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        branch_id: branchId,
        agent_id: agentId,
        customer_name: customerName.trim(),
        customer_phone: phone,
        customer_phone_raw: customerPhone.trim(),
        car_model: carModel?.trim() || null,
        service: service.trim(),
        amount: amount?.trim() || null,
        appointment_date: appointmentDate,
        notes: notes?.trim() || null,
        addons: addonsList,
        status: 'CONFIRMED',
      })
      .select()
      .single()

    if (error) throw error

    // Auto-create workshop job
    const { error: workshopJobErr } = await supabase
      .from('workshop_jobs')
      .insert({
        booking_id: booking.id,
        branch_id: booking.branch_id,
        car_model: booking.car_model || '',
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
        service: booking.service,
        job_type: 'installation',
        status: 'WAITING',
        appointment_date: booking.appointment_date,
        technician_ids: [],
        created_by: agentId,
      })
    if (workshopJobErr) console.error('workshop_jobs insert:', workshopJobErr)

    return NextResponse.json(booking, { status: 201 })

  } catch (err) {
    console.error('Booking error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
