'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LeadsTable({ leads: initialLeads }: { leads: any[] }) {
    const [leads, setLeads] = useState(initialLeads)
    const [selected, setSelected] = useState<string[]>([])
    const [scanning, setScanning] = useState(false)
    const [scanProgress, setScanProgress] = useState<{ completed: number, total: number } | null>(null)

    const router = useRouter()

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelected(leads.map((l: any) => l.id))
        } else {
            setSelected([])
        }
    }

    const handleSelect = (id: string) => {
        setSelected(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const runScan = async () => {
        if (selected.length === 0) return
        setScanning(true)
        setScanProgress({ completed: 0, total: selected.length })

        try {
            const res = await fetch('/api/qualification/start', {
                method: 'POST',
                body: JSON.stringify({ lead_ids: selected })
            })
            if (!res.ok) throw new Error('Start failed')

            const { job_id } = await res.json()

            // Poll/Run loop
            const processBatch = async () => {
                const runRes = await fetch('/api/qualification/run', {
                    method: 'POST',
                    body: JSON.stringify({ job_id })
                })
                const runData = await runRes.json()

                const statusRes = await fetch(`/api/qualification/status?job_id=${job_id}`)
                const statusData = await statusRes.json()

                setScanProgress({ completed: statusData.completed, total: statusData.total })

                if (statusData.status === 'running' || statusData.status === 'queued') {
                    // If batch did nothing, wait a bit?
                    if (runData.processed === 0 && runData.status !== 'done') {
                        setTimeout(processBatch, 2000)
                    } else {
                        setTimeout(processBatch, 500) // fast loop
                    }
                } else {
                    setScanning(false)
                    setScanProgress(null)
                    router.refresh()
                }
            }

            processBatch()

        } catch (e) {
            console.error(e)
            setScanning(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2 mb-4">
                {scanning ? (
                    <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded text-sm flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                        Scanning... {scanProgress ? `${scanProgress.completed}/${scanProgress.total}` : ''}
                    </div>
                ) : (
                    <button
                        onClick={runScan}
                        disabled={selected.length === 0}
                        className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50"
                    >
                        Run Qualification Scan ({selected.length})
                    </button>
                )}
            </div>

            <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground bg-gray-100">
                        <tr className="border-b">
                            <th className="p-3 w-[40px]">
                                <input type="checkbox" onChange={handleSelectAll} checked={selected.length === leads.length && leads.length > 0} />
                            </th>
                            <th className="p-3 font-medium">Business</th>
                            <th className="p-3 font-medium">Status</th>
                            <th className="p-3 font-medium">Score</th>
                            <th className="p-3 font-medium">Angle</th>
                            <th className="p-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leads.map((lead: any) => (
                            <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/50">
                                <td className="p-3">
                                    <input type="checkbox" checked={selected.includes(lead.id)} onChange={() => handleSelect(lead.id)} />
                                </td>
                                <td className="p-3">
                                    <div className="font-medium flex items-center gap-2">
                                        {lead.business_name}
                                        {lead.google_verified && (
                                            <span title="Google Verified" className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full border border-blue-200">✓ Verified</span>
                                        )}
                                        {lead.google_is_permanently_closed && (
                                            <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded-full">CLOSED</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                        {lead.city}
                                        {lead.source === 'google_csv' && <span className="text-[10px] text-gray-400 bg-gray-50 px-1 rounded border">G-Maps</span>}
                                    </div>
                                </td>
                                <td className="p-3">
                                    <span className="capitalize">{lead.status}</span>
                                    {lead.scan_status === 'done' && <span className="ml-2 text-xs bg-green-100 text-green-800 px-1 rounded">Scanned</span>}
                                    {lead.scan_status === 'failed' && <span className="ml-2 text-xs bg-red-100 text-red-800 px-1 rounded">Error</span>}
                                </td>
                                <td className="p-3">
                                    {lead.scan_score !== null ? (
                                        <div className={`font-bold ${lead.scan_score > 7 ? 'text-green-600' : lead.scan_score < 4 ? 'text-red-500' : 'text-yellow-600'}`}>
                                            {lead.scan_score}/10
                                        </div>
                                    ) : '-'}
                                </td>
                                <td className="p-3 max-w-xs truncate text-xs text-gray-600">
                                    {lead.scan_recommended_angle || '-'}
                                </td>
                                <td className="p-3 text-right">
                                    <Link href={`/app/leads/${lead.id}`} className="text-blue-600 hover:underline">View</Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
