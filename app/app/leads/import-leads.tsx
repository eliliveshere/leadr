'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface CSVRow {
    business_name: string
    city: string
    category: string
    website?: string
    phone?: string
    email?: string
    google_maps_url?: string
    rating?: string | number
    review_count?: string | number
    has_opt_in?: string | boolean
    notes?: string
}

export default function ImportLeads() {
    const [isOpen, setIsOpen] = useState(false)
    const [importing, setImporting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successCount, setSuccessCount] = useState<number | null>(null)
    const router = useRouter()
    const supabase = createClient()

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setImporting(true)
        setError(null)
        setSuccessCount(null)

        Papa.parse<CSVRow>(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const { data, meta } = results

                    // Detect Format
                    const fileHeaders = meta.fields || []
                    const isGoogleFormat = fileHeaders.includes('place_id') || fileHeaders.includes('place_link')

                    if (!isGoogleFormat) {
                        // Existing "Simple CSV" check
                        const requiredHeaders = ['business_name', 'city', 'category', 'has_opt_in']
                        const missingHeaders = requiredHeaders.filter(h => !fileHeaders.includes(h))
                        if (missingHeaders.length > 0) {
                            throw new Error(`Invalid CSV format. Missing required headers: ${missingHeaders.join(', ')}`)
                        }
                    }

                    const leadsToInsert: any[] = []
                    const errors: string[] = []

                    data.forEach((row: any, index) => {
                        if (isGoogleFormat) {
                            // GOOGLE MAPS FORMAT
                            if (!row.name) return // Skip empty rows

                            // Safely Parse Working Hours
                            const hours: Record<string, string> = {}
                            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                            let hoursPresent = false
                            days.forEach(d => {
                                const h = row[`working_hours/${d}`]
                                if (h && h !== 'Closed' && h !== 'None') {
                                    hours[d] = h;
                                    hoursPresent = true
                                }
                            })

                            // Parse Types
                            const types: string[] = []
                            Object.keys(row).forEach(k => {
                                if (k.startsWith('types/') && row[k]) types.push(row[k])
                            })

                            const category = types.length > 0 ? types[0].replace(/_/g, ' ') : 'Local Service'
                            const photos = []
                            Object.keys(row).forEach(k => {
                                if (k.startsWith('photos/') && k.endsWith('/src') && row[k]) photos.push(row[k])
                            })

                            leadsToInsert.push({
                                business_name: row.name?.trim(),
                                city: row.city?.trim() || row.full_address?.split(',').slice(-2, -1)[0]?.trim() || 'Unknown',
                                category: category,
                                website: row.website?.trim() || null,
                                website_url: row.website?.trim() || null,
                                phone: row.phone_number?.trim() || null,
                                email: null, // Scraper usually doesn't have email
                                google_maps_url: row.place_link || null,
                                rating: row.rating ? parseFloat(row.rating) : null,
                                review_count: row.review_count ? parseInt(row.review_count) : null,
                                has_opt_in: false, // Default for scraped
                                status: 'new',
                                scan_status: 'not_scanned',
                                source: 'google_csv',
                                source_raw: row, // debug

                                // Google Specifics
                                google_place_id: row.place_id || null,
                                google_place_link: row.place_link || null,
                                google_business_id: row.business_id || null,
                                google_is_claimed: row.is_claimed === 'TRUE' || row.is_claimed === 'true' || row.is_claimed === true,
                                google_verified: row.verified === 'TRUE' || row.verified === 'true' || row.verified === true,
                                google_is_permanently_closed: row.is_permanently_closed === 'TRUE',
                                google_is_temporarily_closed: row.is_temporarily_closed === 'TRUE',
                                google_full_address: row.full_address || null,
                                google_latitude: row.latitude ? parseFloat(row.latitude) : null,
                                google_longitude: row.longitude ? parseFloat(row.longitude) : null,
                                google_timezone: row.timezone || null,
                                google_types: types,
                                google_working_hours: hours,
                                google_hours_present: hoursPresent,
                                google_price_level: row.price_level || null,
                                google_scraped_at: row.scrapedAt || new Date().toISOString(),
                                notes: 'Imported from Google Maps Scraper'
                            })

                        } else {
                            // SIMPLE CSV FORMAT
                            if (!row.business_name?.trim() || !row.city?.trim() || !row.category?.trim()) {
                                errors.push(`Row ${index + 2}: Missing required fields`)
                                return
                            }
                            leadsToInsert.push({
                                business_name: row.business_name.trim(),
                                city: row.city.trim(),
                                category: row.category.trim(),
                                website: row.website?.trim() || null,
                                website_url: row.website?.trim() || null,
                                phone: row.phone?.trim() || null,
                                email: row.email?.trim() || null,
                                google_maps_url: row.google_maps_url?.trim() || null,
                                rating: row.rating ? parseFloat(row.rating) : null,
                                review_count: row.review_count ? parseInt(row.review_count) : null,
                                has_opt_in: String(row.has_opt_in).toLowerCase() === 'true',
                                status: 'new',
                                scan_status: 'not_scanned',
                                source: 'simple_csv',
                                source_raw: row
                            })
                        }
                    })

                    if (leadsToInsert.length === 0) {
                        throw new Error('No valid rows found to import.')
                    }

                    // Get user
                    const { data: { user } } = await supabase.auth.getUser()
                    if (!user) throw new Error('You must be logged in.')

                    const payload = leadsToInsert.map(l => ({ ...l, user_id: user.id }))

                    const { error: insertError } = await supabase.from('leads').insert(payload)

                    if (insertError) throw insertError

                    setSuccessCount(payload.length)
                    setImporting(false)
                    router.refresh()
                    setTimeout(() => setIsOpen(false), 2000)

                } catch (err: any) {
                    setError(err.message)
                    setImporting(false)
                }
            }
        })
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            >
                Import CSV
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-md space-y-4">
                        <h2 className="text-xl font-bold">Import Leads (CSV)</h2>

                        <div className="text-sm text-gray-500 space-y-2">
                            <p>Required columns: business_name, city, category, has_opt_in</p>
                            <p>Optional: website, phone, email, google_maps_url, rating, review_count, notes</p>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-4">
                                {error}
                            </div>
                        )}

                        {successCount !== null && (
                            <div className="bg-green-50 text-green-600 p-3 rounded text-sm mb-4">
                                Successfully imported {successCount} leads!
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <label className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    disabled={importing}
                                />
                                <span className="text-gray-600">
                                    {importing ? 'Importing...' : 'Click to select CSV file'}
                                </span>
                            </label>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-gray-500 text-sm hover:text-black"
                                disabled={importing}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
