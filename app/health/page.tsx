export const dynamic = 'force-dynamic'

export default function HealthPage() {
    return (
        <div className="p-10 font-mono">
            <h1>System Status: Operational</h1>
            <p>If you can see this, the deployment is working.</p>
            <p>Timestamp: {new Date().toISOString()}</p>
        </div>
    )
}
