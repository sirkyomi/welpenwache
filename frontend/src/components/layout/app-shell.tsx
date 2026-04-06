import { CalendarDays, Github, Languages, MonitorCog, Moon, Shield, Sun, Users, UsersRound } from 'lucide-react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/auth-provider'
import { CalendarPage } from '@/features/calendar/calendar-page'
import { InternDetailPage } from '@/features/interns/intern-detail-page'
import { InternsPage } from '@/features/interns/interns-page'
import { useLanguage } from '@/features/localization/language-provider'
import { TeamDetailPage } from '@/features/teams/team-detail-page'
import { useTheme } from '@/features/theme/theme-provider'
import { TeamsPage } from '@/features/teams/teams-page'
import { UsersPage } from '@/features/users/users-page'
import { SidebarVersion, VersionSummary } from '@/features/version/version-summary'
import type { LanguagePreference } from '@/lib/types'
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
  const { hasPermission, user } = useAuth()
  const { languagePreference, setLanguagePreference, t } = useLanguage()
  const { resolvedTheme, setThemePreference, themePreference } = useTheme()
  const canViewInterns = hasPermission('interns.view') || hasPermission('interns.manage')
  const canViewTeams = hasPermission('teams.view') || hasPermission('teams.manage')

  const handleLanguageChange = async (value: LanguagePreference) => {
    try {
      await setLanguagePreference(value)
      toast.success(t('common.settingsSaved'))
    } catch {
      toast.error(t('common.updateFailed'))
    }
  }

  const navigation = [
    { to: '/', label: t('navigation.calendar'), icon: CalendarDays, visible: canViewInterns },
    { to: '/praktikanten', label: t('navigation.interns'), icon: UsersRound, visible: canViewInterns },
    { to: '/teams', label: t('navigation.teams'), icon: Users, visible: canViewTeams },
    { to: '/benutzer', label: t('navigation.users'), icon: Shield, visible: Boolean(user?.isAdministrator) },
  ].filter((item) => item.visible)

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-card/70 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-primary">WelpenWache</p>
            <h1 className="text-2xl font-semibold">{t('app.subtitle')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" aria-label={t('language.changeAria')}>
                  <Languages className="h-4 w-4" />
                  {languagePreference === 'en' ? t('language.shortEn') : t('language.shortDe')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('language.title')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={languagePreference}
                  onValueChange={(value) => void handleLanguageChange(value as LanguagePreference)}
                >
                  <DropdownMenuRadioItem value="de">{t('language.german')}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="en">{t('language.english')}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t('theme.changeAria')}>
                  {resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('theme.title')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={themePreference}
                  onValueChange={(value) => void setThemePreference(value as 'system' | 'light' | 'dark')}
                >
                  <DropdownMenuRadioItem value="system">
                    <MonitorCog className="h-4 w-4" />
                    {t('common.automatic')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="light">
                    <Sun className="h-4 w-4" />
                    {t('common.light')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <Moon className="h-4 w-4" />
                    {t('common.dark')}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="icon" asChild>
              <a
                href="https://github.com/sirkyomi/welpenwache"
                target="_blank"
                rel="noreferrer"
                aria-label={t('theme.gitHubAria')}
              >
                <Github className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <div className="grid w-full items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-8">
        <aside className="flex flex-col gap-4 rounded-3xl border border-border/80 bg-card/70 px-3 py-4 shadow-sm lg:sticky lg:top-6 lg:h-[calc(100dvh-8rem)]">
          <nav className="flex gap-2 overflow-x-auto lg:flex-1 lg:flex-col">
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
          <div className="space-y-3">
            <VersionSummary />
            <SidebarVersion />
          </div>
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
              path="/praktikanten/:internId"
              element={
                <RestrictedRoute allowed={canViewInterns}>
                  <InternDetailPage />
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
              path="/teams/:teamId"
              element={
                <RestrictedRoute allowed={canViewTeams}>
                  <TeamDetailPage />
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
