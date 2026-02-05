import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const metadata: Metadata = {
    title: 'Lead2Close',
    description: 'Outbound and fulfillment pipeline',
}

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    return (
        <div className="flex min-h-screen flex-col md:flex-row bg-muted/40 text-sm">
            <aside className="hidden w-64 md:flex flex-col bg-background border-r h-screen sticky top-0">
                <div className="p-6 border-b">
                    <div className="text-xl font-bold tracking-tight">Lead2Close</div>
                </div>
                <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                    <Link href="/app/leads" className="px-4 py-2 rounded-md hover:bg-muted font-medium transition-colors">Leads</Link>
                    <Link href="/app/queue" className="px-4 py-2 rounded-md hover:bg-muted font-medium transition-colors">Queue</Link>
                    <Link href="/app/pipeline" className="px-4 py-2 rounded-md hover:bg-muted font-medium transition-colors">Pipeline</Link>
                    <Link href="/app/clients" className="px-4 py-2 rounded-md hover:bg-muted font-medium transition-colors">Clients</Link>
                </nav>
                <div className="p-4 border-t">
                    <Link href="/app/settings" className="px-4 py-2 rounded-md hover:bg-muted font-medium transition-colors block">Settings</Link>
                </div>
            </aside>

            <main className="flex-1 md:overflow-y-auto md:h-screen p-4 md:p-8 pb-20 md:pb-8">
                {children}
            </main>

            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t p-2 flex justify-around items-center z-50 pb-safe">
                <Link href="/app/leads" className="p-2 text-xs flex flex-col items-center gap-1">
                    <span>Leads</span>
                </Link>
                <Link href="/app/queue" className="p-2 text-xs flex flex-col items-center gap-1">
                    <span>Queue</span>
                </Link>
                <Link href="/app/pipeline" className="p-2 text-xs flex flex-col items-center gap-1">
                    <span>Pipe</span>
                </Link>
                <Link href="/app/clients" className="p-2 text-xs flex flex-col items-center gap-1">
                    <span>Clients</span>
                </Link>
            </nav>
        </div>
    )
}
