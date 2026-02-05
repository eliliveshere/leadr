import * as cheerio from 'cheerio'

export interface ScanResult {
    score: number
    reasons: string[]
    missing: string[]
    recommended_angle: string
    confidence: 'low' | 'medium' | 'high'
    findings: Record<string, any>
    error?: string
}

export async function scanLead(lead: any): Promise<ScanResult> {
    const url = lead.website_url || lead.website

    // Base score from lead fields
    let score = 0
    const reasons: string[] = []
    const missing: string[] = []
    let findings: any = {}
    let confidence: 'low' | 'medium' | 'high' = 'low'

    if (!url) {
        score += 2
        reasons.push("No website listed")
        confidence = 'low'
    } else {
        try {
            // Ensure protocol
            let validUrl = url
            if (!validUrl.startsWith('http')) {
                validUrl = 'https://' + validUrl
            }

            // SSRF check (basic)
            const parsed = new URL(validUrl)
            if (parsed.hostname === 'localhost' || parsed.hostname.startsWith('127.') || parsed.hostname.startsWith('192.168.') || parsed.hostname.startsWith('10.')) {
                throw new Error("Invalid URL")
            }

            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 12000)

            const res = await fetch(validUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Lead2Close/1.0; +http://lead2close.com)'
                },
                redirect: 'follow'
            })
            clearTimeout(timeout)

            if (!res.ok) throw new Error(`Status ${res.status}`)

            const html = await res.text()
            if (html.length > 1500000) throw new Error("Page too large")

            confidence = 'high'
            const $ = cheerio.load(html)
            const text = $('body').text()
            const lowerText = text.toLowerCase()

            findings.has_https = url.startsWith('https')
            findings.has_meta_viewport = !!$('meta[name="viewport"]').length
            findings.has_tel_link = !!$('a[href^="tel:"]').length
            findings.phone_visible = /(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/.test(text)
            findings.email_visible = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)
            findings.has_contact_form = !!$('form').length
            findings.contact_form_source = findings.has_contact_form ? 'homepage' : 'none'

            // --- Secondary Fetch: Contact Page ---
            if (!findings.has_contact_form) {
                // Find a contact link
                const contactLink = $('a').toArray().find((el: any) => {
                    const href = $(el).attr('href') || ''
                    const text = $(el).text().toLowerCase()
                    const cleanHref = href.toLowerCase()
                    return (cleanHref.includes('contact') || cleanHref.includes('get-in-touch') || text.includes('contact'))
                        && !cleanHref.startsWith('mailto:')
                        && !cleanHref.startsWith('tel:')
                })

                if (contactLink) {
                    const href = $(contactLink).attr('href')
                    // Resolve relative URL
                    let contactUrl = ''
                    if (href) {
                        try {
                            contactUrl = new URL(href, validUrl).href
                        } catch (e) { /* ignore invalid link */ }
                    }

                    if (contactUrl && contactUrl !== validUrl) {
                        try {
                            const res2 = await fetch(contactUrl, {
                                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Lead2Close/1.0; +http://lead2close.com)' },
                                redirect: 'follow'
                            })
                            if (res2.ok) {
                                const html2 = await res2.text()
                                if (html2.length < 1500000) {
                                    const $2 = cheerio.load(html2)
                                    if ($2('form').length > 0) {
                                        findings.has_contact_form = true
                                        findings.contact_form_source = 'contact_page'
                                        confidence = 'medium' // Lower confidence because it required clicks
                                    }
                                }
                            }
                        } catch (e) {
                            // Ignore failure on secondary fetch
                        }
                    }
                }
            }

            const bookingKeywords = ['calendly', 'acuity', 'square', 'setmore', 'simplybook', 'housecallpro', 'jobber', 'servicetitan', 'book', 'schedule']
            findings.has_booking_link = $('a').toArray().some((el: any) => {
                const href = $(el).attr('href') || ''
                const t = $(el).text().toLowerCase()
                return bookingKeywords.some(k => href.includes(k) || t.includes(k))
            })

            findings.has_hours = lowerText.includes('hours') || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].some(d => lowerText.includes(d))
            findings.has_service_area = lead.city && lowerText.includes(lead.city.toLowerCase())
            findings.has_reviews = lowerText.includes('reviews') || lowerText.includes('testimonials') || !!$('.stars, .star, .rating').length
            findings.has_cta = ['call now', 'get quote', 'request quote', 'book', 'schedule'].some(k => lowerText.includes(k))

            // Scoring
            if (!findings.has_booking_link) { score += 2; missing.push("No booking link found") }

            if (!findings.has_contact_form) {
                score += 1;
                missing.push("No contact form on homepage")
            } else if (findings.contact_form_source === 'contact_page') {
                reasons.push("Contact form hidden on secondary page")
            }
            if (!findings.has_tel_link) { score += 1; missing.push("No clickable phone link") }
            if (!findings.has_meta_viewport) { score += 1; missing.push("Not mobile optimized") }

            // Check hours (Google fallback)
            if (!findings.has_hours && !lead.google_hours_present) {
                score += 1;
                missing.push("No business hours found")
            } else if (!findings.has_hours && lead.google_hours_present) {
                // Info present on Google but not site
                reasons.push("Hours missing on website (found on Google)")
            }

            if (!findings.has_service_area) { score += 1; missing.push("Service area not matched") }
            if (!findings.has_reviews) { score += 1; missing.push("No reviews/testimonials found") }

        } catch (err: any) {
            let errorMsg = err.message
            if (err.cause?.code === 'ENOTFOUND') errorMsg = "Domain not found (DNS error)"
            else if (err.cause?.code === 'ECONNREFUSED') errorMsg = "Connection refused"
            else if (err.cause?.code === 'ETIMEDOUT') errorMsg = "Connection timed out"
            else if (err.cause?.code === 'EAI_AGAIN') errorMsg = "DNS Lookup failed"
            else if (err.name === 'AbortError') errorMsg = "Scan timed out (12s)"

            findings.error = errorMsg
            reasons.push(`Site unreachable: ${errorMsg}`)
            confidence = 'low'
        }
    }

    // Google Scraper Enhancements
    if (lead.google_verified) score += 1
    if (lead.google_is_claimed) score += 1
    if (lead.google_hours_present) score += 1

    // Closed Check
    if (lead.google_is_permanently_closed || lead.google_is_temporarily_closed) {
        score = 0
        reasons.unshift("Business is marked CLOSED on Google")
    }

    // Adjust with Google fields
    if (lead.review_count >= 20 && lead.review_count <= 200) score += 1
    if (lead.rating >= 3.8 && lead.rating <= 4.6) score += 1

    // Clamp
    score = Math.min(Math.max(score, 0), 10)

    // Top reasons
    if (missing.length > 0) reasons.push(...missing.slice(0, 3))

    // Angle
    let recommended_angle = "Simple conversion boost — stronger CTA + lead capture"

    // AI Enrichment Overrides
    if (lead.enrichment_status === 'enriched' && lead.enrichment_data) {
        // Boost confidence if AI verified things
        if (lead.enrichment_data.analysis?.estimated_tech_savviness === 'high') {
            // Maybe slightly boost score if they are tech savvy (easier to sell software?) 
            // OR reduce if they already have tools? Let's assume neutral for now.
        }

        // Use AI Hook for Angle if available
        if (lead.enrichment_data.outreach_hook) {
            recommended_angle = "AI Insight: " + lead.enrichment_data.outreach_hook
        }

        // Add AI Strengths/Weaknesses to reasons if sparse
        if (reasons.length < 3 && lead.enrichment_data.analysis?.weaknesses_or_gaps?.length > 0) {
            reasons.push(`Weakness: ${lead.enrichment_data.analysis.weaknesses_or_gaps[0]}`)
        }
    } else {
        // Fallback Logic
        if (lead.google_is_permanently_closed || lead.google_is_temporarily_closed) {
            recommended_angle = "Skip — business closed"
        }
        else if (!url) recommended_angle = "Google listing has no website — quick 1-page call/quote page"
        else if (missing.includes("No booking link found") && missing.includes("No contact form found")) recommended_angle = "No booking/contact capture — missed leads"
        else if (missing.includes("No clickable phone link")) recommended_angle = "Mobile tap-to-call missing — friction"
        else if (missing.includes("No business hours found")) recommended_angle = "Missed after-hours calls — instant SMS follow-up"
    }

    return {
        score,
        reasons: [...new Set(reasons)].slice(0, 3), // unique top 3
        missing,
        recommended_angle,
        confidence,
        findings
    }
}
