import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

import { api } from '@/lib/api'
import type { AuthResponse, AuthUser, Permission, ThemePreference } from '@/lib/types'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  needsSetup: boolean
  initializing: boolean
  hasPermission: (permission: Permission) => boolean
  updateThemePreference: (themePreference: ThemePreference) => Promise<void>
  login: (userName: string, password: string) => Promise<void>
  completeSetup: (userName: string, password: string) => Promise<void>
  logout: () => void
}

const storageKey = 'welpenwache.auth'
const AuthContext = createContext<AuthContextValue | null>(null)

function normalizeThemePreference(themePreference: unknown): ThemePreference {
  return themePreference === 'light' || themePreference === 'dark' || themePreference === 'system'
    ? themePreference
    : 'system'
}

function normalizeUser(user: AuthUser): AuthUser {
  return {
    ...user,
    themePreference: normalizeThemePreference(user.themePreference),
  }
}

function persistSession(session: AuthResponse | null) {
  if (!session) {
    localStorage.removeItem(storageKey)
    return
  }

  localStorage.setItem(
    storageKey,
    JSON.stringify({
      token: session.token,
      user: normalizeUser(session.user),
    }),
  )
}

function readSession(): { token: string; user: AuthUser } | null {
  const raw = localStorage.getItem(storageKey)
  if (!raw) {
    return null
  }

  try {
    const session = JSON.parse(raw) as { token: string; user: AuthUser }
    return {
      token: session.token,
      user: normalizeUser(session.user),
    }
  } catch {
    localStorage.removeItem(storageKey)
    return null
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const initialSession = readSession()
  const [token, setToken] = useState<string | null>(initialSession?.token ?? null)
  const [user, setUser] = useState<AuthUser | null>(initialSession?.user ?? null)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    let active = true

    async function bootstrap() {
      try {
        const setupStatus = await api.getSetupStatus()
        if (!active) return

        setNeedsSetup(setupStatus.requiresSetup)

        if (initialSession?.token && !setupStatus.requiresSetup) {
          try {
            const currentUser = await api.getMe(initialSession.token)
            if (!active) return
            setToken(initialSession.token)
            setUser(normalizeUser(currentUser))
          } catch {
            persistSession(null)
            if (!active) return
            setToken(null)
            setUser(null)
          }
        }
      } finally {
        if (active) {
          setInitializing(false)
        }
      }
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [initialSession?.token])

  const applyAuthResponse = (response: AuthResponse) => {
    setToken(response.token)
    setUser(normalizeUser(response.user))
    setNeedsSetup(false)
    persistSession({
      ...response,
      user: normalizeUser(response.user),
    })
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      needsSetup,
      initializing,
      hasPermission: (permission) =>
        Boolean(user?.isAdministrator || user?.permissions.includes(permission)),
      updateThemePreference: async (themePreference) => {
        if (!token) {
          return
        }

        const updatedUser = normalizeUser(await api.updateThemePreference(token, themePreference))
        setUser(updatedUser)
        persistSession(
          updatedUser && token
            ? {
                token,
                expiresAtUtc: new Date().toISOString(),
                user: updatedUser,
              }
            : null,
        )
      },
      login: async (userName, password) => {
        const response = await api.login({ userName, password })
        applyAuthResponse(response)
      },
      completeSetup: async (userName, password) => {
        const response = await api.createInitialAdmin({ userName, password })
        applyAuthResponse(response)
      },
      logout: () => {
        setToken(null)
        setUser(null)
        persistSession(null)
      },
    }),
    [initializing, needsSetup, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
