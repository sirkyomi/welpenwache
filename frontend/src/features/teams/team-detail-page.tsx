import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Palette, SquarePen, UsersRound } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/auth-provider'
import { formatGermanDateRange } from '@/features/interns/intern-formatters'
import { ApiError, api } from '@/lib/api'

export function TeamDetailPage() {
  const { hasPermission, token } = useAuth()
  const { teamId } = useParams<{ teamId: string }>()

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
          <CardContent className="py-10 text-sm text-muted-foreground">Team wird geladen ...</CardContent>
        </Card>
      </section>
    )
  }

  if (teamQuery.isError) {
    const message =
      teamQuery.error instanceof ApiError && teamQuery.error.status === 404
        ? 'Das angeforderte Team wurde nicht gefunden.'
        : 'Die Detailansicht konnte nicht geladen werden.'

    return (
      <section className="space-y-6">
        <Button asChild variant="outline">
          <Link to="/teams">
            <ArrowLeft className="h-4 w-4" />
            Zurück zur Übersicht
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
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Zurück zum Kalender
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/teams">Zurück zur Übersicht</Link>
        </Button>
        {hasPermission('teams.manage') ? (
          <Button asChild>
            <Link to={`/teams?edit=${team.id}`}>
              <SquarePen className="h-4 w-4" />
              Bearbeiten
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
                  {team.description || 'Keine Beschreibung hinterlegt.'}
                </CardDescription>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 lg:self-start">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Palette className="h-4 w-4 text-primary" />
                Teamfarbe
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
                Praktikanten
              </div>
              <p className="text-sm text-muted-foreground">{uniqueInternCount} verknüpft</p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="h-4 w-4 text-primary" />
                Zeiträume
              </div>
              <p className="text-sm text-muted-foreground">{team.assignments.length} geplant</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {team.assignments.length === 0 ? (
            <div className="rounded-2xl bg-muted/70 px-4 py-4 text-sm text-muted-foreground">
              Für dieses Team gibt es noch keine Zuweisungen.
            </div>
          ) : (
            team.assignments.map((assignment, index) => (
              <div key={assignment.assignmentId} className="rounded-3xl border border-border/70 bg-background/75 p-5">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Zuweisung {index + 1}</h2>
                    <p className="text-sm text-muted-foreground">
                      {formatGermanDateRange(assignment.startDate, assignment.endDate)}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    {team.isArchived ? 'Archiviertes Team' : 'Aktives Team'}
                  </span>
                </div>

                <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                  <p className="text-sm text-muted-foreground">Praktikant</p>
                  <Link
                    to={`/praktikanten/${assignment.internId}`}
                    className="mt-1 inline-block text-base font-semibold transition-colors hover:text-primary focus:outline-none focus:text-primary"
                  >
                    {assignment.internName}
                  </Link>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  )
}
