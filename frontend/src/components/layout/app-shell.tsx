import { CalendarDays, FileCog, Github, Languages, MonitorCog, Moon, ScrollText, Shield, Sun, Users, UsersRound } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
import { AuditLogPage } from '@/features/audit-log/audit-log-page'
import { CalendarPage } from '@/features/calendar/calendar-page'
import { DocumentTemplatesPage } from '@/features/document-templates/document-templates-page'
import { InternDetailPage } from '@/features/interns/intern-detail-page'
import { InternsPage } from '@/features/interns/interns-page'
import { useLanguage } from '@/features/localization/language-provider'
import { TeamDetailPage } from '@/features/teams/team-detail-page'
import { useTheme } from '@/features/theme/theme-provider'
import { TeamsPage } from '@/features/teams/teams-page'
import { UsersPage } from '@/features/users/users-page'
import { SidebarVersion, VersionSummary } from '@/features/version/version-summary'
import type { LanguagePreference } from '@/lib/types'
import { buildDocumentTitle } from '@/lib/document-title'
import { cn } from '@/lib/utils'

function RestrictedRoute({
  allowed,
  redirectTo,
  children,
}: {
  allowed: boolean
  redirectTo: string
  children: React.ReactNode
}) {
  return allowed ? <>{children}</> : <Navigate to={redirectTo} replace />
}

export function AppShell() {
  const { hasPermission, user } = useAuth()
  const { languagePreference, setLanguagePreference, t } = useLanguage()
  const { resolvedTheme, setThemePreference, themePreference } = useTheme()
  const location = useLocation()
  const canViewCalendar = hasPermission('interns.view') || hasPermission('interns.manage')
  const canViewInterns =
    canViewCalendar || hasPermission('documents.view') || hasPermission('documents.manage')
  const canViewTeams = hasPermission('teams.view') || hasPermission('teams.manage')
  const canViewDocumentTemplates =
    hasPermission('documents.view') || hasPermission('documents.manage')
  const canViewAuditLog = Boolean(user?.isAdministrator)
  const canManageUsers = Boolean(user?.isAdministrator)
  const fallbackRoute = canViewCalendar
    ? '/'
    : canViewInterns
      ? '/praktikanten'
      : canViewTeams
        ? '/teams'
        : canViewDocumentTemplates
          ? '/dokumentvorlagen'
          : canViewAuditLog
            ? '/audit-log'
          : canManageUsers
            ? '/benutzer'
            : '/'

  const handleLanguageChange = async (value: LanguagePreference) => {
    try {
      await setLanguagePreference(value)
      toast.success(t('common.settingsSaved'))
    } catch {
      toast.error(t('common.updateFailed'))
    }
  }

  const navigation = [
    { to: '/', label: t('navigation.calendar'), icon: CalendarDays, visible: canViewCalendar },
    { to: '/praktikanten', label: t('navigation.interns'), icon: UsersRound, visible: canViewInterns },
    { to: '/teams', label: t('navigation.teams'), icon: Users, visible: canViewTeams },
    { to: '/dokumentvorlagen', label: t('navigation.documentTemplates'), icon: FileCog, visible: canViewDocumentTemplates },
    { to: '/audit-log', label: t('navigation.auditLog'), icon: ScrollText, visible: canViewAuditLog },
    { to: '/benutzer', label: t('navigation.users'), icon: Shield, visible: canManageUsers },
  ].filter((item) => item.visible)

  useEffect(() => {
    const routeTitle = (() => {
      if (location.pathname === '/') {
        return t('navigation.calendar')
      }

      if (location.pathname.startsWith('/praktikanten')) {
        return t('navigation.interns')
      }

      if (location.pathname.startsWith('/teams')) {
        return t('navigation.teams')
      }

      if (location.pathname.startsWith('/dokumentvorlagen')) {
        return t('navigation.documentTemplates')
      }

      if (location.pathname.startsWith('/audit-log')) {
        return t('navigation.auditLog')
      }

      if (location.pathname.startsWith('/benutzer')) {
        return t('navigation.users')
      }

      return undefined
    })()

    document.title = buildDocumentTitle(routeTitle)
  }, [location.pathname, t])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border/70 bg-card/70 backdrop-blur">
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

      <div className="grid min-h-0 flex-1 w-full gap-6 overflow-hidden px-4 py-6 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:px-8">
        <aside className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/70 px-3 py-4 shadow-sm lg:h-full lg:max-h-full">
          <nav className="flex gap-2 overflow-x-auto lg:flex-1 lg:flex-col lg:overflow-x-visible">
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

        <main className="min-w-0 min-h-0 overflow-y-auto pr-1">
          <Routes>
            <Route
              path="/"
              element={
                canViewCalendar ? <CalendarPage /> : <Navigate to={fallbackRoute} replace />
              }
            />
            <Route
              path="/praktikanten"
              element={
                <RestrictedRoute allowed={canViewInterns} redirectTo={fallbackRoute}>
                  <InternsPage />
                </RestrictedRoute>
              }
            />
            <Route
              path="/praktikanten/:internId"
              element={
                <RestrictedRoute allowed={canViewInterns} redirectTo={fallbackRoute}>
                  <InternDetailPage />
                </RestrictedRoute>
              }
            />
            <Route
              path="/teams"
              element={
                <RestrictedRoute allowed={canViewTeams} redirectTo={fallbackRoute}>
                  <TeamsPage />
                </RestrictedRoute>
              }
            />
            <Route
              path="/teams/:teamId"
              element={
                <RestrictedRoute allowed={canViewTeams} redirectTo={fallbackRoute}>
                  <TeamDetailPage />
                </RestrictedRoute>
              }
            />
            <Route
              path="/audit-log"
              element={
                <RestrictedRoute allowed={canViewAuditLog} redirectTo={fallbackRoute}>
                  <AuditLogPage />
                </RestrictedRoute>
              }
            />
            <Route
              path="/benutzer"
              element={
                <RestrictedRoute allowed={canManageUsers} redirectTo={fallbackRoute}>
                  <UsersPage />
                </RestrictedRoute>
              }
            />
            <Route
              path="/dokumentvorlagen"
              element={
                <RestrictedRoute allowed={canViewDocumentTemplates} redirectTo={fallbackRoute}>
                  <DocumentTemplatesPage />
                </RestrictedRoute>
              }
            />
            <Route path="*" element={<Navigate to={fallbackRoute} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
