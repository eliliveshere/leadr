import { OpenAI } from 'openai'
import { z } from 'zod'
import { zodResponseFormat } from 'openai/helpers/zod'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PackRequestSchema = z.object({
    lead: z.object({
        business_name: z.string(),
        category: z.string().optional(),
        city: z.string().optional(),
        phone: z.string().optional(),
        website: z.string().optional()
    }),
    client: z.object({
        package_tier: z.string(),
        payment_status: z.string()
    }),
    onboarding: z.object({
        service_area: z.string().optional(),
        hours: z.string().optional(),
        top_services: z.array(z.string()).optional(),
        offer: z.string().optional(),
        booking_link: z.string().optional(),
        tone: z.string().optional()
    })
})

const PackOutputSchema = z.object({
    landing_page: z.object({
        headline: z.string(),
        subheadline: z.string(),
        bullets: z.array(z.string()),
        cta_primary: z.string(),
        cta_secondary: z.string(),
        faq: z.array(z.object({
            q: z.string(),
            a: z.string()
        })),
        trust: z.array(z.string())
    }),
    ai_receptionist: z.object({
        opening_line: z.string(),
        goals: z.array(z.string()),
        questions: z.array(z.object({
            key: z.string(),
            ask: z.string()
        })),
        routing_rules: z.array(z.string()),
        missed_call_sms: z.string()
    }),
    followups: z.object({
        first_response_sms: z.string(),
        quote_followup_sms: z.string(),
        email_confirmation: z.object({
            subject: z.string(),
            body: z.string()
        })
    })
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
    const result = PackRequestSchema.safeParse(json)
    if (!result.success) {
        return new NextResponse('Invalid request', { status: 400 })
    }

    const { lead, client, onboarding } = result.data

    const prompt = `
    Generate a Delivery Pack for a new client.
    Business: ${lead.business_name}
    Service Area: ${onboarding.service_area}
    Hours: ${onboarding.hours}
    Top Services: ${onboarding.top_services?.join(', ')}
    Offer: ${onboarding.offer}
    Tone: ${onboarding.tone || 'Friendly local service'}
    
    Tier: ${client.package_tier}
    
    Output strictly valid JSON.
  `

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-2024-08-06',
        messages: [
            { role: 'system', content: 'Generate client delivery assets.' },
            { role: 'user', content: prompt }
        ],
        response_format: zodResponseFormat(PackOutputSchema, "delivery_pack"),
    })

    const content = completion.choices[0].message.content
    const parsed = content ? JSON.parse(content) : null
    return NextResponse.json(parsed)
}
