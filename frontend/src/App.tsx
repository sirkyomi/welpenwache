import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

import { AppShell } from '@/components/layout/app-shell'
import { SetupScreen, LoginScreen } from '@/features/auth/auth-screens'
import { AuthProvider, useAuth } from '@/features/auth/auth-provider'
import { LanguageProvider, useLanguage } from '@/features/localization/language-provider'
import { ThemeProvider } from '@/features/theme/theme-provider'
import { routerBaseName } from '@/lib/base-path'
import { buildDocumentTitle } from '@/lib/document-title'

const queryClient = new QueryClient()

function AppContent() {
  const { initializing, needsSetup, token } = useAuth()
  const { t } = useLanguage()

  useEffect(() => {
    if (initializing) {
      document.title = buildDocumentTitle(t('app.loading'))
      return
    }

    if (needsSetup && !token) {
      document.title = buildDocumentTitle(t('auth.setupTitle'))
      return
    }

    if (!token) {
      document.title = buildDocumentTitle(t('auth.loginTitle'))
      return
    }

    document.title = buildDocumentTitle()
  }, [initializing, needsSetup, token, t])

  if (initializing) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="rounded-3xl border border-border bg-card/80 px-6 py-5 text-sm text-muted-foreground shadow-sm">
          {t('app.loading')}
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
    <BrowserRouter basename={routerBaseName}>
      <AppShell />
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <ThemeProvider>
            <AppContent />
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
