import { createClient } from '@/lib/supabase/server'
import LeadsTable from './leads-table'
import ImportLeads from './import-leads'

export default async function LeadsPage() {
    const supabase = await createClient()
    const { data: leads } = await supabase.from('leads').select('*').order('created_at', { ascending: false })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
                <div className="flex gap-2">
                    <ImportLeads />
                </div>
            </div>

            <LeadsTable leads={leads || []} />
        </div>
    )
}
