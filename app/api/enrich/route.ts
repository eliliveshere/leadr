import { OpenAI } from 'openai'
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

// Enrichment Output Schema
const EnrichmentSchema = z.object({
    analysis: z.object({
        business_summary: z.string(),
        target_audience: z.string(),
        key_strengths: z.array(z.string()),
        weaknesses_or_gaps: z.array(z.string()),
        improvement_opportunities: z.array(z.string()),
        estimated_tech_savviness: z.enum(['low', 'medium', 'high']),
    }),
    contact_info: z.object({
        emails_found: z.array(z.string()),
        social_links: z.array(z.string()),
    }),
    outreach_hook: z.string().describe("A personalized single sentence hook for a cold email based on findings."),
})

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'placeholder' })

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const formData = await request.formData()
    const lead_id = formData.get('lead_id') as string

    if (!lead_id) return new NextResponse('Missing lead_id', { status: 400 })

    // 1. Mark as enriching
    await supabase.from('leads').update({ enrichment_status: 'enriching' }).eq('id', lead_id)

    try {
        // 2. Fetch Lead Data
        const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).single()
        if (!lead) throw new Error("Lead not found")

        // 3. Scrape Website Content (Simple)
        let websiteText = ""
        let websiteHtml = ""
        const url = lead.website_url || lead.website
        if (url) {
            try {
                let validUrl = url.startsWith('http') ? url : `https://${url}`
                const controller = new AbortController()
                setTimeout(() => controller.abort(), 10000)
                const res = await fetch(validUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Lead2CloseBot/1.0)' },
                    signal: controller.signal
                })
                if (res.ok) {
                    websiteHtml = await res.text()
                    const $ = cheerio.load(websiteHtml)
                    $('script, style').remove()
                    websiteText = $('body').text().slice(0, 8000) // Limit tokens
                }
            } catch (e) {
                console.error("Scrape failed", e)
                websiteText = "Website unreachable."
            }
        }

        // 4. Construct Prompt
        const prompt = `
       Analyze this business for a B2B service agency (Lead2Close) that helps local businesses with automated lead capture, CRM setting, and website improvements.
       
       Business: ${lead.business_name}
       City: ${lead.city}
       Category: ${lead.category}
       Google Rating: ${lead.rating} (${lead.review_count} reviews)
       Google Data: ${JSON.stringify(lead.google_working_hours || {})}
       
       Website Content Preview:
       ${websiteText.replace(/\s+/g, ' ').trim()}
       
       Task:
       1. Identify strengths and weaknesses.
       2. Look for contact emails in text.
       3. Estimate how tech-savvy they are.
       4. Suggest a specific outreach hook.
     `

        // 5. Call OpenAI
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-2024-08-06',
            messages: [
                { role: 'system', content: 'You are an expert business analyst.' },
                { role: 'user', content: prompt }
            ],
            response_format: zodResponseFormat(EnrichmentSchema, "enrichment_result"),
        })

        const content = completion.choices[0].message.content
        const enrichmentData = content ? JSON.parse(content) : null

        // 6. Save Result
        await supabase.from('leads').update({
            enrichment_status: 'enriched',
            enrichment_last_at: new Date().toISOString(),
            enrichment_data: enrichmentData
        }).eq('id', lead_id)

    } catch (err: any) {
        console.error(err)
        await supabase.from('leads').update({ enrichment_status: 'failed' }).eq('id', lead_id)
    }

    return NextResponse.redirect(new URL(`/app/leads/${lead_id}`, request.url))
}
