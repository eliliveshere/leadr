import LoginForm from './login-form'

export default function LoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
            <div className="w-full max-w-sm space-y-6 bg-white p-6 rounded-lg shadow-sm border">
                <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold tracking-tight">Lead2Close</h1>
                    <p className="text-sm text-gray-500">Enter your credentials to access the platform.</p>
                </div>
                <LoginForm />
            </div>
        </div>
    )
}
