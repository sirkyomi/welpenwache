import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, GraduationCap, NotebookText, SquarePen, UsersRound } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/auth-provider'
import { useLanguage } from '@/features/localization/language-provider'
import { ApiError, api } from '@/lib/api'

export function InternDetailPage() {
  const { hasPermission, token } = useAuth()
  const { formatDateRange, t } = useLanguage()
  const { internId } = useParams<{ internId: string }>()

  const internQuery = useQuery({
    queryKey: ['intern', internId],
    queryFn: () => api.getIntern(token!, internId!),
    enabled: Boolean(token && internId),
  })

  if (!internId) {
    return <Navigate to="/praktikanten" replace />
  }

  if (internQuery.isPending) {
    return (
      <section className="space-y-6">
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">{t('interns.loading')}</CardContent>
        </Card>
      </section>
    )
  }

  if (internQuery.isError) {
    const message =
      internQuery.error instanceof ApiError && internQuery.error.status === 404
        ? t('interns.notFound')
        : t('interns.detailsLoadFailed')

    return (
      <section className="space-y-6">
        <Button asChild variant="outline">
          <Link to="/praktikanten">
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

  const intern = internQuery.data

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            {t('common.backToCalendar')}
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/praktikanten">{t('common.backToOverview')}</Link>
        </Button>
        {hasPermission('interns.manage') ? (
          <Button asChild>
            <Link to={`/praktikanten?edit=${intern.id}`}>
              <SquarePen className="h-4 w-4" />
              {t('common.edit')}
            </Link>
          </Button>
        ) : null}
      </div>

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(260px,1fr)] lg:items-start">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UsersRound className="h-7 w-7" />
              </div>
              <div>
                <CardTitle className="text-3xl">{intern.fullName}</CardTitle>
                <CardDescription className="mt-1 text-sm">
                  {intern.school || t('interns.schoolMissing')}
                </CardDescription>
              </div>
            </div>

            {intern.notes ? (
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <NotebookText className="h-4 w-4 text-primary" />
                  {t('interns.notes')}
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{intern.notes}</p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <GraduationCap className="h-4 w-4 text-primary" />
                {t('interns.origin')}
              </div>
              <p className="text-sm text-muted-foreground">{intern.school || t('interns.originMissing')}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="h-4 w-4 text-primary" />
                {t('interns.timeframes')}
              </div>
              <p className="text-sm text-muted-foreground">{t('interns.plannedPeriods', { count: intern.internships.length })}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {intern.internships.length === 0 ? (
            <div className="rounded-2xl bg-muted/70 px-4 py-4 text-sm text-muted-foreground">
              {t('interns.noPlannedInternships')}
            </div>
          ) : (
            intern.internships.map((internship, index) => (
              <div key={internship.id} className="rounded-3xl border border-border/70 bg-background/75 p-5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{t('interns.internshipTitle', { index: index + 1 })}</h2>
                    <p className="text-sm text-muted-foreground">
                      {formatDateRange(internship.startDate, internship.endDate)}
                    </p>
                  </div>
                  {internship.note ? (
                    <div className="max-w-xl rounded-2xl bg-card/80 px-4 py-3 text-sm text-muted-foreground">
                      {internship.note}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {internship.assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="rounded-2xl border p-4 shadow-sm"
                      style={{
                        backgroundColor: `${assignment.teamColorHex}14`,
                        borderColor: `${assignment.teamColorHex}55`,
                      }}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <Link
                            to={`/teams/${assignment.teamId}`}
                            className="text-base font-semibold transition-colors hover:text-primary focus:outline-none focus:text-primary"
                          >
                            {assignment.teamName}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {formatDateRange(assignment.startDate, assignment.endDate)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t('interns.supervisorPrefix', {
                              name: assignment.supervisorName || t('interns.supervisorMissing'),
                            })}
                          </p>
                        </div>
                        <span
                          className="inline-block h-4 w-4 shrink-0 rounded-full border border-white/70"
                          style={{ backgroundColor: assignment.teamColorHex }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  )
}
