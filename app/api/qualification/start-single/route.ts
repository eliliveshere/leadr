import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Simple direct start for single lead (skip job queue for simpler UX on detail page, or wrap in job)
export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const formData = await request.formData()
    const lead_id = formData.get('lead_id') as string

    if (!lead_id) return new NextResponse('Missing lead_id', { status: 400 })

    // Trigger scan job
    // We can reuse the start endpoint logic or call it directly. 
    // For simplicity, let's just make a one-item job via internal fetch or duplication.
    // We'll duplicate logic to avoid self-fetch auth issues or complex URL resolution.

    const { data: job, error: jobError } = await supabase
        .from('qualification_jobs')
        .insert({
            user_id: user.id,
            total: 1,
            status: 'running'
        })
        .select()
        .single()

    await supabase.from('qualification_job_items').insert({
        user_id: user.id,
        job_id: job.id,
        lead_id: lead_id,
        status: 'queued'
    })

    await supabase.from('leads').update({ scan_status: 'queued' }).eq('id', lead_id)

    // Trigger manual execution via fetch to /api/qualification/run (fire and forget pattern is tricky in serverless/api routes without proper async backend)
    // Instead, since this is a single item user-request, let's just RUN IT inline for immediate gratification.
    // If it takes > 10s Vercel free tier might timeout, but for 1 item usually ok.

    // BUT we should stick to the pattern: queue -> client polls OR queue -> fire-and-forget worker.
    // The previous implementation purely queued it but didn't kick off the 'run' worker.

    // We will attempt to fetch the runner. Note: this fetch might fail if we don't have absolute URL.
    // So we'll use a safer approach: Just process IT right here for "Start Single".

    try {
        const { scanLead } = await import('@/lib/scanner/core')


        // Use the SAME authenticated client we already have, to pass RLS.
        // The admin key might be missing in some user environments.

        // Mark as scanning
        await supabase.from('qualification_job_items').update({ status: 'scanning' }).eq('job_id', job.id)

        // Get Lead
        const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).single()

        if (lead) {
            const result = await scanLead(lead)

            const { error: updateError } = await supabase.from('leads').update({
                scan_status: 'done',
                scan_score: result.score,
                scan_reasons: result.reasons,
                scan_missing: result.missing,
                scan_recommended_angle: result.recommended_angle,
                scan_confidence: result.confidence,
                scan_findings_json: result.findings,
                scan_last_at: new Date().toISOString(),
                scan_error: result.error || null
            }).eq('id', lead_id)

            if (updateError) {
                console.error('Update lead failed', updateError)
                throw updateError
            }

            await supabase.from('qualification_job_items').update({ status: 'done' }).eq('job_id', job.id)
            await supabase.from('qualification_jobs').update({ status: 'done', completed: 1 }).eq('id', job.id)
        }
    } catch (e) {
        console.error('Immediate scan failed', e)
        // swallow error so we still redirect, user sees 'queued' or 'failed' on refresh
    }

    // redirect back
    return NextResponse.redirect(new URL(`/app/leads/${lead_id}`, request.url))
}
