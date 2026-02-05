import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const text = await request.text()
    const params = new URLSearchParams(text)

    const From = params.get('From')
    const To = params.get('To')
    const Body = params.get('Body')
    const MessageSid = params.get('MessageSid')

    if (!From || !Body) {
        return new NextResponse('Missing parameters', { status: 400 })
    }

    const supabase = createAdminClient()

    // Find lead by phone
    const { data: leads, error: findError } = await supabase
        .from('leads')
        .select('id, user_id, status')
        .eq('phone', From)
        // If user has duplicates, this might be an issue. Order by created_at desc to get most recent?
        .order('created_at', { ascending: false })
        .limit(1)

    const lead = leads?.[0]

    if (!lead) {
        console.log('Received SMS from unknown number:', From)
        return new NextResponse('<Response></Response>', {
            headers: { 'Content-Type': 'text/xml' }
        })
    }

    // Insert inbound message
    const { error: insertError } = await supabase.from('inbound_messages').insert({
        user_id: lead.user_id,
        lead_id: lead.id,
        from_number: From,
        to_number: To || '',
        body: Body,
        provider: 'twilio',
        provider_message_id: MessageSid
    })

    if (insertError) {
        console.error('Error inserting inbound:', insertError)
    }

    // Auto Rules
    const lowerBody = Body.toLowerCase().trim()
    let newStatus = lead.status

    if (['stop', 'unsubscribe', 'cancel', 'end', 'quit'].includes(lowerBody)) {
        newStatus = 'do_not_contact'
    } else if (newStatus === 'new' || newStatus === 'queued' || newStatus === 'contacted') {
        newStatus = 'replied'
    }

    // If status changed, update lead
    if (newStatus !== lead.status) {
        await supabase.from('leads').update({
            status: newStatus,
            updated_at: new Date().toISOString()
        }).eq('id', lead.id)
    }

    // Return empty TwiML
    return new NextResponse('<Response></Response>', {
        headers: { 'Content-Type': 'text/xml' }
    })
}
