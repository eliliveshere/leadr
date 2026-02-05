'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [mode, setMode] = useState<'login' | 'signup'>('login')
    const [message, setMessage] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)

        if (mode === 'login') {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (error) {
                setError(error.message)
                setLoading(false)
            } else {
                router.refresh()
                router.push('/app/leads')
            }
        } else {
            const { error, data } = await supabase.auth.signUp({
                email,
                password,
            })

            if (error) {
                setError(error.message)
                setLoading(false)
            } else {
                setLoading(false)
                if (data.session) {
                    router.refresh()
                    router.push('/app/leads')
                } else {
                    setMessage('Check your email for the confirmation link.')
                }
            }
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
            {error && <div className="text-red-500 text-sm">{error}</div>}
            {message && <div className="text-green-600 text-sm">{message}</div>}

            <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border p-2 rounded px-3 py-2 text-sm"
                required
            />
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border p-2 rounded px-3 py-2 text-sm"
                required
                minLength={6}
            />
            <button type="submit" disabled={loading} className="bg-primary text-primary-foreground bg-black text-white p-2 rounded hover:bg-gray-800 disabled:opacity-50 text-sm font-medium">
                {loading ? 'Loading...' : (mode === 'login' ? 'Login' : 'Sign Up')}
            </button>

            <div className="text-center text-xs text-gray-500 mt-2">
                {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button
                    type="button"
                    onClick={() => {
                        setMode(mode === 'login' ? 'signup' : 'login')
                        setError(null)
                        setMessage(null)
                    }}
                    className="underline hover:text-black"
                >
                    {mode === 'login' ? 'Sign up' : 'Login'}
                </button>
            </div>
        </form>
    )
}
