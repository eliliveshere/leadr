import { createAdminClient } from '@/lib/supabase/admin'
import { scanLead } from '@/lib/scanner/core'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60 // 1 minute max for Vercel/Next function

export async function POST(request: Request) {
    // Use admin client for writes to avoid RLS issues during background processing if context is lost, 
    // but better to verify user first.
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const { job_id } = await request.json()

    if (!job_id) return new NextResponse('Missing job_id', { status: 400 })

    const supabase = createAdminClient()

    // Fetch next batch of queued items for this job
    const { data: items } = await supabase
        .from('qualification_job_items')
        .select('*, leads(*)')
        .eq('job_id', job_id)
        .eq('status', 'queued')
        .limit(5)

    if (!items || items.length === 0) {
        // Check if job is done
        const { count } = await supabase
            .from('qualification_job_items')
            .select('*', { count: 'exact', head: true })
            .eq('job_id', job_id)
            .eq('status', 'queued')

        if (count === 0) {
            // Update job status
            await supabase.from('qualification_jobs').update({ status: 'done' }).eq('id', job_id)
            return NextResponse.json({ status: 'done', processed: 0 })
        }
        return NextResponse.json({ status: 'waiting', processed: 0 })
    }

    let processed = 0

    for (const item of items) {
        try {
            // Mark as scanning
            await supabase.from('qualification_job_items').update({ status: 'scanning' }).eq('id', item.id)

            const result = await scanLead(item.leads)

            // Update lead
            await supabase.from('leads').update({
                scan_status: 'done',
                scan_score: result.score,
                scan_reasons: result.reasons,
                scan_missing: result.missing,
                scan_recommended_angle: result.recommended_angle,
                scan_confidence: result.confidence,
                scan_findings_json: result.findings,
                scan_last_at: new Date().toISOString(),
                scan_error: result.error || null
            }).eq('id', item.lead_id)

            // Update item
            await supabase.from('qualification_job_items').update({ status: 'done' }).eq('id', item.id)

            // Update job stats
            await supabase.rpc('increment_job_completed', { job_id_input: job_id }) // better to use rpc for atomicity, but standard update ok for now:

            // Simple increment (race condition possible but low impact for this tool)
            const { data: job } = await supabase.from('qualification_jobs').select('completed').eq('id', job_id).single()
            if (job) {
                await supabase.from('qualification_jobs').update({ completed: job.completed + 1 }).eq('id', job_id)
            }

        } catch (err: any) {
            console.error(err)
            await supabase.from('qualification_job_items').update({ status: 'failed', error: err.message }).eq('id', item.id)
            await supabase.from('leads').update({ scan_status: 'failed', scan_error: err.message }).eq('id', item.lead_id)

            const { data: job } = await supabase.from('qualification_jobs').select('failed').eq('id', job_id).single()
            if (job) {
                await supabase.from('qualification_jobs').update({ failed: job.failed + 1 }).eq('id', job_id)
            }
        }
        processed++
    }

    return NextResponse.json({ status: 'running', processed })
}
