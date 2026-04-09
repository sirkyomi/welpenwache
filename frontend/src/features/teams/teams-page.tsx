import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, SquarePen } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/auth-provider'
import { useLanguage } from '@/features/localization/language-provider'
import { TeamFormDialog, type TeamFormPayload } from '@/features/teams/team-form-dialog'
import { ApiError, api } from '@/lib/api'
import type { Team } from '@/lib/types'

export function TeamsPage() {
  const { hasPermission, token } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)

  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.getTeams(token!),
    enabled: Boolean(token),
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: TeamFormPayload) => {
      if (!token) return null

      return editingTeam
        ? api.updateTeam(token, editingTeam.id, payload)
        : api.createTeam(token, payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams'] })
      toast.success(editingTeam ? t('teams.updated') : t('teams.created'))
      setOpen(false)
      setEditingTeam(null)
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('teams.saveFailed'))
    },
  })

  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data])
  const requestedEditTeamId = searchParams.get('edit')

  const openCreate = () => {
    setEditingTeam(null)
    setOpen(true)
  }

  const openEdit = (team: Team) => {
    setEditingTeam(team)
    setOpen(true)
  }

  useEffect(() => {
    if (!hasPermission('teams.manage') || !requestedEditTeamId || teams.length === 0) {
      return
    }

    const requestedTeam = teams.find((team) => team.id === requestedEditTeamId)
    if (!requestedTeam) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      openEdit(requestedTeam)

      const nextSearchParams = new URLSearchParams(searchParams)
      nextSearchParams.delete('edit')
      setSearchParams(nextSearchParams, { replace: true })
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [hasPermission, requestedEditTeamId, searchParams, setSearchParams, teams])

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t('teams.title')}</CardTitle>
            <CardDescription>{t('teams.description')}</CardDescription>
          </div>
          {hasPermission('teams.manage') && (
            <>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                {t('teams.create')}
              </Button>
              <TeamFormDialog
                open={open}
                onOpenChange={(nextOpen) => {
                  setOpen(nextOpen)

                  if (!nextOpen) {
                    setEditingTeam(null)
                  }
                }}
                team={editingTeam}
                onSubmit={(payload) => saveMutation.mutateAsync(payload)}
                isPending={saveMutation.isPending}
                idPrefix="team-list-form"
              />
            </>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <Card key={team.id} className="border-border/70 bg-card/80">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      <span className="inline-block h-4 w-4 rounded-full" style={{ backgroundColor: team.colorHex }} />
                      <Link
                        to={`/teams/${team.id}`}
                        className="transition-colors hover:text-primary focus:outline-none focus:text-primary"
                      >
                        {team.name}
                      </Link>
                    </CardTitle>
                    <CardDescription>{team.description || t('teams.noDescription')}</CardDescription>
                  </div>
                  {hasPermission('teams.manage') && (
                    <Button variant="ghost" size="sm" onClick={() => openEdit(team)}>
                      <SquarePen className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                  <span>{team.isArchived ? t('common.archived') : t('common.active')}</span>
                  <span>{t('teams.storedSupervisors', { count: team.supervisors.length })}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
