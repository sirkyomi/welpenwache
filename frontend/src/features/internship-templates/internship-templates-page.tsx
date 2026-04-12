import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarRange, Plus, SquarePen, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/auth-provider'
import { useLanguage } from '@/features/localization/language-provider'
import { ApiError, api } from '@/lib/api'
import { internshipTemplateQueryKeys } from '@/lib/query-keys'
import type { InternshipTemplate, Team } from '@/lib/types'

interface TemplateAssignmentFormState {
  teamId: string
  supervisorId: string
  startOffsetDays: string
  endOffsetDays: string
}

interface TemplateFormState {
  name: string
  description: string
  isActive: boolean
  assignments: TemplateAssignmentFormState[]
}

const emptyAssignment = (): TemplateAssignmentFormState => ({
  teamId: '',
  supervisorId: '',
  startOffsetDays: '0',
  endOffsetDays: '0',
})

const emptyForm: TemplateFormState = {
  name: '',
  description: '',
  isActive: true,
  assignments: [emptyAssignment()],
}

function getSupervisorsForTeam(teams: Team[], teamId: string) {
  return teams.find((team) => team.id === teamId)?.supervisors ?? []
}

function buildForm(template?: InternshipTemplate | null): TemplateFormState {
  if (!template) {
    return emptyForm
  }

  return {
    name: template.name,
    description: template.description ?? '',
    isActive: template.isActive,
    assignments:
      template.assignments.length > 0
        ? template.assignments.map((assignment) => ({
            teamId: assignment.teamId,
            supervisorId: assignment.supervisorId ?? '',
            startOffsetDays: String(assignment.startOffsetDays),
            endOffsetDays: String(assignment.endOffsetDays),
          }))
        : [emptyAssignment()],
  }
}

export function InternshipTemplatesPage() {
  const { hasPermission, token } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<InternshipTemplate | null>(null)
  const [templatePendingDelete, setTemplatePendingDelete] = useState<InternshipTemplate | null>(null)
  const [form, setForm] = useState<TemplateFormState>(emptyForm)
  const canManageTemplates = hasPermission('interns.manage')

  const templatesQuery = useQuery({
    queryKey: internshipTemplateQueryKeys.collection(canManageTemplates ? 'all' : 'active'),
    queryFn: () => api.getInternshipTemplates(token!, { includeInactive: canManageTemplates }),
    enabled: Boolean(token),
  })

  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.getTeams(token!),
    enabled: Boolean(token),
  })

  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data])
  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        return null
      }

      const payload = {
        name: form.name,
        description: form.description || null,
        isActive: form.isActive,
        assignments: form.assignments.map((assignment, index) => ({
          teamId: assignment.teamId,
          supervisorId: assignment.supervisorId || null,
          startOffsetDays: Number(assignment.startOffsetDays),
          endOffsetDays: Number(assignment.endOffsetDays),
          sortOrder: index,
        })),
      }

      return editingTemplate
        ? api.updateInternshipTemplate(token, editingTemplate.id, payload)
        : api.createInternshipTemplate(token, payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: internshipTemplateQueryKeys.all })
      toast.success(editingTemplate ? t('internshipTemplates.updated') : t('internshipTemplates.created'))
      setOpen(false)
      setEditingTemplate(null)
      setForm(emptyForm)
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('internshipTemplates.saveFailed'))
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: async (template: InternshipTemplate) => {
      if (!token) {
        return null
      }

      return api.updateInternshipTemplate(token, template.id, {
        name: template.name,
        description: template.description,
        isActive: !template.isActive,
        assignments: template.assignments.map((assignment) => ({
          teamId: assignment.teamId,
          supervisorId: assignment.supervisorId,
          startOffsetDays: assignment.startOffsetDays,
          endOffsetDays: assignment.endOffsetDays,
          sortOrder: assignment.sortOrder,
        })),
      })
    },
    onSuccess: async (_, template) => {
      await queryClient.invalidateQueries({ queryKey: internshipTemplateQueryKeys.all })
      toast.success(template.isActive ? t('internshipTemplates.deactivated') : t('internshipTemplates.activated'))
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('internshipTemplates.statusFailed'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (template: InternshipTemplate) => {
      if (!token) {
        return
      }

      await api.deleteInternshipTemplate(token, template.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: internshipTemplateQueryKeys.all })
      setTemplatePendingDelete(null)
      toast.success(t('internshipTemplates.deleted'))
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('internshipTemplates.deleteFailed'))
    },
  })

  const openCreate = () => {
    setEditingTemplate(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const openEdit = (template: InternshipTemplate) => {
    setEditingTemplate(template)
    setForm(buildForm(template))
    setOpen(true)
  }

  const updateAssignment = (
    assignmentIndex: number,
    field: keyof TemplateAssignmentFormState,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      assignments: current.assignments.map((assignment, index) =>
        index === assignmentIndex ? { ...assignment, [field]: value } : assignment,
      ),
    }))
  }

  const updateAssignmentTeam = (assignmentIndex: number, teamId: string) => {
    setForm((current) => ({
      ...current,
      assignments: current.assignments.map((assignment, index) => {
        if (index !== assignmentIndex) {
          return assignment
        }

        const nextSupervisors = getSupervisorsForTeam(teams, teamId)
        const supervisorStillValid = nextSupervisors.some((supervisor) => supervisor.id === assignment.supervisorId)

        return {
          ...assignment,
          teamId,
          supervisorId: supervisorStillValid ? assignment.supervisorId : '',
        }
      }),
    }))
  }

  const addAssignment = () => {
    setForm((current) => ({
      ...current,
      assignments: [...current.assignments, emptyAssignment()],
    }))
  }

  const removeAssignment = (assignmentIndex: number) => {
    setForm((current) => ({
      ...current,
      assignments: current.assignments.filter((_, index) => index !== assignmentIndex),
    }))
  }

  const deleteTemplate = async (template: InternshipTemplate) => {
    await deleteMutation.mutateAsync(template)
  }

  return (
    <section className="space-y-6">
      <Dialog
        open={Boolean(templatePendingDelete)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteMutation.isPending) {
            setTemplatePendingDelete(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('internshipTemplates.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {templatePendingDelete
                ? t('internshipTemplates.deleteDescription', { name: templatePendingDelete.name })
                : t('internshipTemplates.deleteDescriptionFallback')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTemplatePendingDelete(null)}
              disabled={deleteMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => templatePendingDelete && void deleteTemplate(templatePendingDelete)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t('common.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t('internshipTemplates.title')}</CardTitle>
            <CardDescription>{t('internshipTemplates.description')}</CardDescription>
          </div>
          {canManageTemplates ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('internshipTemplates.create')}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen)

              if (!nextOpen) {
                setEditingTemplate(null)
                setForm(emptyForm)
              }
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? t('internshipTemplates.editTitle') : t('internshipTemplates.createTitle')}
                </DialogTitle>
                <DialogDescription>{t('internshipTemplates.formDescription')}</DialogDescription>
              </DialogHeader>

              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  void saveMutation.mutateAsync()
                }}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="internship-template-name">{t('internshipTemplates.name')}</Label>
                    <Input
                      id="internship-template-name"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <label className="flex items-center gap-3 text-sm">
                      <Checkbox
                        checked={form.isActive}
                        onCheckedChange={(checked) =>
                          setForm((current) => ({ ...current, isActive: checked === true }))
                        }
                      />
                      {t('internshipTemplates.active')}
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="internship-template-description">{t('internshipTemplates.descriptionLabel')}</Label>
                  <Textarea
                    id="internship-template-description"
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">{t('internshipTemplates.assignments')}</h3>
                      <p className="text-xs text-muted-foreground">{t('internshipTemplates.assignmentsDescription')}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addAssignment}>
                      <Plus className="h-4 w-4" />
                      {t('internshipTemplates.addAssignment')}
                    </Button>
                  </div>

                  {form.assignments.map((assignment, assignmentIndex) => {
                    const supervisors = getSupervisorsForTeam(teams, assignment.teamId)

                    return (
                      <div
                        key={assignmentIndex}
                        className="grid gap-3 rounded-2xl border border-border/70 p-4 md:grid-cols-[1.2fr_1.2fr_1fr_1fr_auto]"
                      >
                        <div className="space-y-2">
                          <Label>{t('interns.team')}</Label>
                          <Select value={assignment.teamId} onValueChange={(value) => updateAssignmentTeam(assignmentIndex, value)}>
                            <SelectTrigger>
                              <SelectValue placeholder={t('interns.teamPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                              {teams.map((team) => (
                                <SelectItem key={team.id} value={team.id}>
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>{t('internshipTemplates.supervisorOptional')}</Label>
                          <Select
                            value={assignment.supervisorId || '__none__'}
                            onValueChange={(value) =>
                              updateAssignment(assignmentIndex, 'supervisorId', value === '__none__' ? '' : value)
                            }
                            disabled={!assignment.teamId}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  !assignment.teamId
                                    ? t('interns.supervisorChooseTeam')
                                    : supervisors.length === 0
                                      ? t('internshipTemplates.noSupervisorOptional')
                                      : t('interns.supervisorPlaceholder')
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">{t('internshipTemplates.noSupervisorOptional')}</SelectItem>
                              {supervisors.map((supervisor) => (
                                <SelectItem key={supervisor.id} value={supervisor.id}>
                                  {supervisor.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>{t('internshipTemplates.startOffsetDays')}</Label>
                          <Input
                            type="number"
                            value={assignment.startOffsetDays}
                            onChange={(event) => updateAssignment(assignmentIndex, 'startOffsetDays', event.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>{t('internshipTemplates.endOffsetDays')}</Label>
                          <Input
                            type="number"
                            value={assignment.endOffsetDays}
                            onChange={(event) => updateAssignment(assignmentIndex, 'endOffsetDays', event.target.value)}
                          />
                        </div>

                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={form.assignments.length === 1}
                            onClick={() => removeAssignment(assignmentIndex)}
                          >
                            {t('common.remove')}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <Button className="w-full" type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? t('common.saving') : t('common.save')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {!canManageTemplates ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-5 text-sm text-muted-foreground">
              {t('internshipTemplates.readOnlyHint')}
            </div>
          ) : null}

          {templatesQuery.isPending ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-5 text-sm text-muted-foreground">
              {t('internshipTemplates.loading')}
            </div>
          ) : null}

          {templatesQuery.isError ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-5 text-sm text-muted-foreground">
              {t('internshipTemplates.loadFailed')}
            </div>
          ) : null}

          {!templatesQuery.isPending && !templatesQuery.isError && templates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-5 text-sm text-muted-foreground">
              {t('internshipTemplates.empty')}
            </div>
          ) : null}

          {!templatesQuery.isPending && !templatesQuery.isError
            ? templates.map((template) => (
                <Card key={template.id} className="border-border/70 bg-card/80">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <CalendarRange className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle>{template.name}</CardTitle>
                            <CardDescription>
                              {template.description || t('internshipTemplates.noDescription')}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={template.isActive ? 'default' : 'secondary'}>
                            {template.isActive ? t('internshipTemplates.statusActive') : t('internshipTemplates.statusInactive')}
                          </Badge>
                          <Badge variant="outline">
                            {t('internshipTemplates.segmentCount', { count: template.assignments.length })}
                          </Badge>
                        </div>
                      </div>

                      {canManageTemplates ? (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(template)}>
                          <SquarePen className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 rounded-2xl border border-border/70 bg-background/60 p-4">
                      {template.assignments.map((assignment) => (
                        <div key={assignment.id} className="rounded-2xl border border-border/70 bg-card/75 p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium">{assignment.teamName}</p>
                              <p className="text-muted-foreground">
                                {t('internshipTemplates.offsetRange', {
                                  start: assignment.startOffsetDays,
                                  end: assignment.endOffsetDays,
                                })}
                              </p>
                            </div>
                            <p className="text-muted-foreground">
                              {assignment.supervisorName
                                ? t('interns.supervisorPrefix', { name: assignment.supervisorName })
                                : t('internshipTemplates.noSupervisorOptional')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {canManageTemplates ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void toggleStatusMutation.mutateAsync(template)}
                          disabled={toggleStatusMutation.isPending || deleteMutation.isPending}
                        >
                          {template.isActive ? t('internshipTemplates.deactivate') : t('internshipTemplates.activate')}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => openEdit(template)}>
                          {t('common.edit')}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setTemplatePendingDelete(template)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                          {t('common.delete')}
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))
            : null}
        </CardContent>
      </Card>
    </section>
  )
}
