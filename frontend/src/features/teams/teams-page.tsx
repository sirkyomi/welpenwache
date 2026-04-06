import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, SquarePen, Trash2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/auth-provider'
import { useLanguage } from '@/features/localization/language-provider'
import { ApiError, api } from '@/lib/api'
import type { Team } from '@/lib/types'

interface SupervisorFormState {
  id?: string
  name: string
  notes: string
}

interface TeamFormState {
  name: string
  description: string
  colorHex: string
  isArchived: boolean
  supervisors: SupervisorFormState[]
}

const emptyForm: TeamFormState = {
  name: '',
  description: '',
  colorHex: '#2563EB',
  isArchived: false,
  supervisors: [],
}

export function TeamsPage() {
  const { hasPermission, token } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [form, setForm] = useState<TeamFormState>(emptyForm)

  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.getTeams(token!),
    enabled: Boolean(token),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token) return null

      const payload = {
        name: form.name,
        description: form.description || null,
        colorHex: form.colorHex,
        isArchived: form.isArchived,
        supervisors: form.supervisors.map((supervisor) => ({
          ...(supervisor.id ? { id: supervisor.id } : {}),
          name: supervisor.name,
          notes: supervisor.notes || null,
        })),
      }

      return editingTeam
        ? api.updateTeam(token, editingTeam.id, payload)
        : api.createTeam(token, payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams'] })
      toast.success(editingTeam ? t('teams.updated') : t('teams.created'))
      setOpen(false)
      setEditingTeam(null)
      setForm(emptyForm)
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('teams.saveFailed'))
    },
  })

  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data])
  const requestedEditTeamId = searchParams.get('edit')

  const openCreate = () => {
    setEditingTeam(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const openEdit = (team: Team) => {
    setEditingTeam(team)
    setForm({
      name: team.name,
      description: team.description ?? '',
      colorHex: team.colorHex,
      isArchived: team.isArchived,
      supervisors: team.supervisors.map((supervisor) => ({
        id: supervisor.id,
        name: supervisor.name,
        notes: supervisor.notes ?? '',
      })),
    })
    setOpen(true)
  }

  const updateSupervisor = (index: number, field: keyof SupervisorFormState, value: string) => {
    setForm((current) => ({
      ...current,
      supervisors: current.supervisors.map((supervisor, currentIndex) =>
        currentIndex === index ? { ...supervisor, [field]: value } : supervisor,
      ),
    }))
  }

  const addSupervisor = () => {
    setForm((current) => ({
      ...current,
      supervisors: [...current.supervisors, { name: '', notes: '' }],
    }))
  }

  const removeSupervisor = (index: number) => {
    setForm((current) => ({
      ...current,
      supervisors: current.supervisors.filter((_, currentIndex) => currentIndex !== index),
    }))
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
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  {t('teams.create')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingTeam ? t('teams.editTitle') : t('teams.createTitle')}</DialogTitle>
                  <DialogDescription>{t('teams.formDescription')}</DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void saveMutation.mutateAsync()
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="team-name">{t('common.name')}</Label>
                    <Input
                      id="team-name"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team-color">{t('common.color')}</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="team-color"
                        type="color"
                        value={form.colorHex}
                        onChange={(event) => setForm((current) => ({ ...current, colorHex: event.target.value.toUpperCase() }))}
                        className="h-11 w-16 cursor-pointer rounded-xl border-input bg-card p-1"
                      />
                      <Input value={form.colorHex} readOnly className="font-mono text-sm text-muted-foreground" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team-description">{t('common.description')}</Label>
                    <Textarea
                      id="team-description"
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-3 rounded-2xl border border-border/70 bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{t('teams.supervisors')}</p>
                        <p className="text-xs text-muted-foreground">{t('teams.supervisorsDescription')}</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={addSupervisor}>
                        <Plus className="h-4 w-4" />
                        {t('teams.addSupervisor')}
                      </Button>
                    </div>

                    {form.supervisors.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/80 px-3 py-4 text-sm text-muted-foreground">
                        {t('teams.noSupervisors')}
                      </div>
                    ) : null}

                    {form.supervisors.map((supervisor, index) => (
                      <div key={supervisor.id ?? `new-${index}`} className="space-y-3 rounded-2xl border border-border/70 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{t('teams.supervisorTitle', { index: index + 1 })}</p>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeSupervisor(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label>{t('common.name')}</Label>
                          <Input
                            value={supervisor.name}
                            onChange={(event) => updateSupervisor(index, 'name', event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('teams.note')}</Label>
                          <Textarea
                            value={supervisor.notes}
                            onChange={(event) => updateSupervisor(index, 'notes', event.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={form.isArchived}
                      onCheckedChange={(checked) => setForm((current) => ({ ...current, isArchived: checked === true }))}
                    />
                    {t('teams.archiveTeam')}
                  </label>
                  <Button className="w-full" type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? t('common.saving') : t('common.save')}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
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
