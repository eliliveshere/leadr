import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const { lead_id, subject, body } = await request.json()

    // Get lead email
    const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).single()
    if (!lead) return new NextResponse('Lead not found', { status: 404 })

    if (!lead.email) return new NextResponse('Lead has no email', { status: 400 })

    const resend = new Resend(process.env.RESEND_API_KEY)

    try {
        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
            to: lead.email,
            subject,
            html: body.replace(/\n/g, '<br>') // basic conversion
        })

        if (error) {
            console.error('Resend Error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        await supabase.from('outreach_sends').insert({
            user_id: user.id,
            lead_id: lead.id,
            channel: 'email',
            provider: 'resend',
            provider_message_id: data?.id,
            to_value: lead.email,
            from_value: process.env.RESEND_FROM_EMAIL,
            subject,
            body,
            status: 'sent'
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

        return NextResponse.json({ success: true, id: data?.id })
    } catch (error: any) {
        console.error('Resend Exception:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
