import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const job_id = searchParams.get('job_id')

    if (!job_id) return new NextResponse('Missing job_id', { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const { data: job } = await supabase
        .from('qualification_jobs')
        .select('*')
        .eq('id', job_id)
        .single()

    if (!job) return new NextResponse('Job not found', { status: 404 })

    return NextResponse.json(job)
}
