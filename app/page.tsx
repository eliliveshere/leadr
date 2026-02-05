import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Lead2Close</h1>
      <div className="flex gap-4">
        <Link href="/login" className="px-4 py-2 bg-black text-white rounded">
          Login
        </Link>
        <Link href="/app/leads" className="px-4 py-2 border border-black rounded">
          Go to Dashboard
        </Link>
        <Link href="/health" className="px-4 py-2 text-gray-500">
          Status Check
        </Link>
      </div>
    </div>
  )
}
