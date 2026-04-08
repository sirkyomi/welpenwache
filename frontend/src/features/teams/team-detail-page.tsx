import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, BadgeInfo, CalendarDays, Palette, SquarePen, UserRound, UsersRound } from 'lucide-react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/auth-provider'
import {
  appendReturnTo,
  buildCalendarReturnTarget,
  readCalendarReturnTo,
} from '@/features/calendar/calendar-navigation'
import { useLanguage } from '@/features/localization/language-provider'
import { ApiError, api } from '@/lib/api'

export function TeamDetailPage() {
  const { hasPermission, token } = useAuth()
  const { formatDateRange, t } = useLanguage()
  const { teamId } = useParams<{ teamId: string }>()
  const [searchParams] = useSearchParams()
  const calendarReturnTo = readCalendarReturnTo(searchParams) ?? buildCalendarReturnTarget('/', '')

  const teamQuery = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => api.getTeam(token!, teamId!),
    enabled: Boolean(token && teamId),
  })

  const uniqueInternCount = useMemo(() => {
    const assignments = teamQuery.data?.assignments ?? []
    return new Set(assignments.map((assignment) => assignment.internId)).size
  }, [teamQuery.data])

  if (!teamId) {
    return <Navigate to="/teams" replace />
  }

  if (teamQuery.isPending) {
    return (
      <section className="space-y-6">
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">{t('teams.loading')}</CardContent>
        </Card>
      </section>
    )
  }

  if (teamQuery.isError) {
    const message =
      teamQuery.error instanceof ApiError && teamQuery.error.status === 404
        ? t('teams.notFound')
        : t('teams.detailsLoadFailed')

    return (
      <section className="space-y-6">
        <Button asChild variant="outline">
          <Link to="/teams">
            <ArrowLeft className="h-4 w-4" />
            {t('common.backToOverview')}
          </Link>
        </Button>

        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">{message}</CardContent>
        </Card>
      </section>
    )
  }

  const team = teamQuery.data

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline">
          <Link to={calendarReturnTo}>
            <ArrowLeft className="h-4 w-4" />
            {t('common.backToCalendar')}
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/teams">{t('common.backToOverview')}</Link>
        </Button>
        {hasPermission('teams.manage') ? (
          <Button asChild>
            <Link to={`/teams?edit=${team.id}`}>
              <SquarePen className="h-4 w-4" />
              {t('common.edit')}
            </Link>
          </Button>
        ) : null}
      </div>

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(340px,1fr)] lg:items-start">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm"
                style={{ backgroundColor: team.colorHex }}
              >
                <UsersRound className="h-7 w-7" />
              </div>
              <div>
                <CardTitle className="text-3xl">{team.name}</CardTitle>
                <CardDescription className="mt-1 text-sm">
                  {team.description || t('teams.noDescription')}
                </CardDescription>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:self-start">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Palette className="h-4 w-4 text-primary" />
                {t('teams.teamColor')}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="inline-block h-4 w-4 rounded-full border border-white/70"
                  style={{ backgroundColor: team.colorHex }}
                />
                <code className="rounded-md bg-card px-2 py-1 text-sm">{team.colorHex}</code>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <UsersRound className="h-4 w-4 text-primary" />
                {t('teams.interns')}
              </div>
              <p className="text-sm text-muted-foreground">{t('teams.linkedInterns', { count: uniqueInternCount })}</p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="h-4 w-4 text-primary" />
                {t('teams.timeframes')}
              </div>
              <p className="text-sm text-muted-foreground">{t('teams.plannedAssignments', { count: team.assignments.length })}</p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <UserRound className="h-4 w-4 text-primary" />
                {t('teams.supervisors')}
              </div>
              <p className="text-sm text-muted-foreground">{t('teams.storedSupervisors', { count: team.supervisors.length })}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-3xl border border-border/70 bg-background/75 p-5">
            <div className="mb-3 flex items-center gap-2">
              <BadgeInfo className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">{t('teams.supervisorsInTeam')}</h2>
            </div>
            {team.supervisors.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('teams.noSupervisorsInTeam')}</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {team.supervisors.map((supervisor) => (
                  <div key={supervisor.id} className="rounded-2xl border border-border/70 bg-card/80 p-4">
                    <p className="font-semibold">{supervisor.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {supervisor.notes || t('teams.noNote')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {team.assignments.length === 0 ? (
            <div className="rounded-2xl bg-muted/70 px-4 py-4 text-sm text-muted-foreground">
              {t('teams.noAssignments')}
            </div>
          ) : (
            team.assignments.map((assignment, index) => (
              <div key={assignment.assignmentId} className="rounded-3xl border border-border/70 bg-background/75 p-5">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{t('teams.assignmentTitle', { index: index + 1 })}</h2>
                    <p className="text-sm text-muted-foreground">
                      {formatDateRange(assignment.startDate, assignment.endDate)}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    {team.isArchived ? t('teams.archivedTeam') : t('teams.activeTeam')}
                  </span>
                </div>

                <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                  <p className="text-sm text-muted-foreground">{t('teams.intern')}</p>
                  <Link
                    to={appendReturnTo(`/praktikanten/${assignment.internId}`, calendarReturnTo)}
                    className="mt-1 inline-block text-base font-semibold transition-colors hover:text-primary focus:outline-none focus:text-primary"
                  >
                    {assignment.internName}
                  </Link>
                  <div className="mt-3 border-t border-border/60 pt-3">
                    <p className="text-sm text-muted-foreground">{t('interns.supervisor')}</p>
                    <p className="text-sm font-medium">
                      {assignment.supervisorName || t('teams.noSupervisorAssigned')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  )
}
