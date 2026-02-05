import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const { lead_ids } = await request.json()

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
        return new NextResponse('No leads provided', { status: 400 })
    }

    // Create Job
    const { data: job, error: jobError } = await supabase
        .from('qualification_jobs')
        .insert({
            user_id: user.id,
            total: lead_ids.length,
            status: 'running'
        })
        .select()
        .single()

    if (jobError || !job) {
        return new NextResponse(jobError?.message || 'Failed to create job', { status: 500 })
    }

    // Create items
    const items = lead_ids.map(id => ({
        user_id: user.id,
        job_id: job.id,
        lead_id: id,
        status: 'queued'
    }))

    const { error: itemsError } = await supabase
        .from('qualification_job_items')
        .insert(items)

    if (itemsError) {
        return new NextResponse(itemsError.message, { status: 500 })
    }

    // Mark leads as queued
    await supabase
        .from('leads')
        .update({ scan_status: 'queued' })
        .in('id', lead_ids)

    return NextResponse.json({ job_id: job.id })
}
