import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import twilio from 'twilio'

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const { lead_id, body } = await request.json()

    // Get lead phone
    const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).single()
    if (!lead) return new NextResponse('Lead not found', { status: 404 })

    if (!lead.phone) return new NextResponse('Lead has no phone', { status: 400 })

    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

    try {
        const message = await client.messages.create({
            body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: lead.phone
        })

        await supabase.from('outreach_sends').insert({
            user_id: user.id,
            lead_id: lead.id,
            channel: 'sms',
            provider: 'twilio',
            provider_message_id: message.sid,
            to_value: lead.phone,
            from_value: process.env.TWILIO_PHONE_NUMBER,
            body,
            status: message.status
        })

        if (['new', 'queued'].includes(lead.status)) {
            await supabase.from('leads').update({
                status: 'contacted',
                last_contacted_at: new Date().toISOString()
            }).eq('id', lead.id)
        } else {
            await supabase.from('leads').update({
                last_contacted_at: new Date().toISOString()
            }).eq('id', lead.id)
        }

        return NextResponse.json({ success: true, sid: message.sid })
    } catch (error: any) {
        console.error('Twilio Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
