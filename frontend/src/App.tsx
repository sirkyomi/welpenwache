import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

import { AppShell } from '@/components/layout/app-shell'
import { SetupScreen, LoginScreen } from '@/features/auth/auth-screens'
import { AuthProvider, useAuth } from '@/features/auth/auth-provider'

const queryClient = new QueryClient()

function AppContent() {
  const { initializing, needsSetup, token } = useAuth()

  if (initializing) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-3xl border border-border bg-card/80 px-6 py-5 text-sm text-muted-foreground shadow-sm">
          WelpenWache wird geladen ...
        </div>
      </main>
    )
  }

  if (needsSetup && !token) {
    return <SetupScreen />
  }

  if (!token) {
    return <LoginScreen />
  }

  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  )
}
