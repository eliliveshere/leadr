import { OpenAI } from 'openai'
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GenerateRequestSchema = z.object({
    lead: z.object({
        business_name: z.string(),
        category: z.string().optional(),
        city: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        website: z.string().optional(),
        rating: z.number().optional(),
        review_count: z.number().optional(),
        has_opt_in: z.boolean().optional(),
        status: z.string(),
        // Scan fields
        scan_score: z.number().optional().nullable(),
        scan_reasons: z.array(z.string()).optional().nullable(),
        scan_recommended_angle: z.string().optional().nullable()
    }),
    style: z.enum(['direct', 'friendly', 'professional']),
    sequence: z.enum(['first_touch', 'follow_up'])
})

const GeneratedContentSchema = z.object({
    sms: z.array(z.object({
        variant: z.enum(['ultra_short', 'short', 'follow_up']),
        text: z.string()
    })),
    email: z.array(z.object({
        variant: z.enum(['short', 'follow_up']),
        subject: z.string(),
        text: z.string()
    })),
    personalization_used: z.array(z.string())
})

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const json = await request.json()
    const result = GenerateRequestSchema.safeParse(json)

    if (!result.success) {
        return new NextResponse('Invalid request', { status: 400 })
    }

    const { lead, style, sequence } = result.data

    const prompt = `
    Generate outreach messages for a lead with the following details:
    Business: ${lead.business_name}
    Category: ${lead.category || 'Local Business'}
    City: ${lead.city || 'Unknown'}
    Website: ${lead.website || 'None'}
    Rating: ${lead.rating || 'N/A'} (${lead.review_count || 0} reviews)
    Opt-in: ${lead.has_opt_in ? 'Yes' : 'No'}

    Qualification Context:
    Scan Score: ${lead.scan_score ?? 'N/A'}/10
    Recommended Angle: ${lead.scan_recommended_angle ?? 'General inquiry'}
    Key Issues: ${lead.scan_reasons?.join(', ') ?? 'None detected'}

    Context:
    Style: ${style}
    Sequence: ${sequence}
    
    Rules:
    - Keep SMS ideally < 320 chars.
    - Always end with a question CTA.
    - If has_opt_in is false and sequence is first_touch: avoid aggressive language, keep it "quick question" style.
    - Leverage the "Recommended Angle" and "Key Issues" to personalize the hook.
      Example: If the angle is "missed after-hours calls", mention that specifically.
      Example: If "no booking link", mention helping them capture more appointments.
    - If website missing: mention "no website / no booking page" gently.
    - No claims like "guaranteed leads," no deceptive language.
  `

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-2024-08-06',
        messages: [
            { role: 'system', content: 'You are a helpful sales assistant generating outreach. Output valid JSON.' },
            { role: 'user', content: prompt }
        ],
        response_format: zodResponseFormat(GeneratedContentSchema, "outreach_content"),
    })

    const output = completion.choices[0].message.parsed

    return NextResponse.json(output)
}
