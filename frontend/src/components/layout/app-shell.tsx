import { CalendarDays, LogOut, Shield, Users, UsersRound } from 'lucide-react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-provider'
import { CalendarPage } from '@/features/calendar/calendar-page'
import { InternsPage } from '@/features/interns/interns-page'
import { TeamsPage } from '@/features/teams/teams-page'
import { UsersPage } from '@/features/users/users-page'
import { cn } from '@/lib/utils'

function RestrictedRoute({
  allowed,
  children,
}: {
  allowed: boolean
  children: React.ReactNode
}) {
  return allowed ? <>{children}</> : <Navigate to="/" replace />
}

export function AppShell() {
  const { hasPermission, logout, user } = useAuth()
  const canViewInterns = hasPermission('interns.view') || hasPermission('interns.manage')
  const canViewTeams = hasPermission('teams.view') || hasPermission('teams.manage')

  const navigation = [
    { to: '/', label: 'Kalender', icon: CalendarDays, visible: canViewInterns },
    { to: '/praktikanten', label: 'Praktikanten', icon: UsersRound, visible: canViewInterns },
    { to: '/teams', label: 'Teams', icon: Users, visible: canViewTeams },
    { to: '/benutzer', label: 'Benutzer', icon: Shield, visible: Boolean(user?.isAdministrator) },
  ].filter((item) => item.visible)

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">WelpenWache</p>
            <h1 className="text-2xl font-semibold">Praktikantenplanung</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-2xl bg-secondary/70 px-3 py-2 text-sm text-secondary-foreground sm:block">
              {user?.userName}
            </div>
            <Button variant="outline" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Abmelden
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        <aside className="rounded-3xl border border-border/80 bg-card/70 p-3 shadow-sm">
          <nav className="flex gap-2 overflow-x-auto lg:flex-col">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                    isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground hover:bg-muted',
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <Routes>
            <Route
              path="/"
              element={
                <RestrictedRoute allowed={canViewInterns}>
                  <CalendarPage />
                </RestrictedRoute>
              }
            />
            <Route
              path="/praktikanten"
              element={
                <RestrictedRoute allowed={canViewInterns}>
                  <InternsPage />
                </RestrictedRoute>
              }
            />
            <Route
              path="/teams"
              element={
                <RestrictedRoute allowed={canViewTeams}>
                  <TeamsPage />
                </RestrictedRoute>
              }
            />
            <Route
              path="/benutzer"
              element={
                <RestrictedRoute allowed={Boolean(user?.isAdministrator)}>
                  <UsersPage />
                </RestrictedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
