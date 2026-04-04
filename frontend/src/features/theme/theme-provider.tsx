import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'

import { useAuth } from '@/features/auth/auth-provider'
import type { ThemePreference } from '@/lib/types'

type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  themePreference: ThemePreference
  resolvedTheme: ResolvedTheme
  setThemePreference: (themePreference: ThemePreference) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const { token, updateThemePreference, user } = useAuth()
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    typeof window === 'undefined' ? 'light' : getSystemTheme(),
  )

  const themePreference = user?.themePreference ?? 'system'
  const resolvedTheme: ResolvedTheme = themePreference === 'system' ? systemTheme : themePreference

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const onChange = () => {
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light')
    }

    onChange()
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme,
      setThemePreference: async (nextThemePreference) => {
        if (!token) {
          return
        }

        await updateThemePreference(nextThemePreference)
      },
    }),
    [resolvedTheme, themePreference, token, updateThemePreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return context
}
