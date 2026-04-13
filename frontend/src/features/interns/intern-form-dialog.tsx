import { startTransition, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
import type { Gender, Intern, InternshipTemplate, Team } from '@/lib/types'

interface AssignmentFormState {
  teamId: string
  supervisorId: string
  startDate: string
  endDate: string
}

interface InternshipFormState {
  templateId: string
  startDate: string
  endDate: string
  note: string
  assignments: AssignmentFormState[]
}

interface InternFormState {
  firstName: string
  lastName: string
  gender: Gender
  school: string
  notes: string
  internships: InternshipFormState[]
}

export interface InternFormDialogInitialRange {
  startDate: string
  endDate?: string
}

export interface InternFormPayload {
  firstName: string
  lastName: string
  gender: Gender
  school: string | null
  notes: string | null
  internships: Array<{
    startDate: string
    endDate: string
    note: string | null
    assignments: Array<{
      teamId: string
      supervisorId: string | null
      startDate: string
      endDate: string
    }>
  }>
}

interface InternFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  intern?: Intern | null
  teams: Team[]
  initialRange?: InternFormDialogInitialRange | null
  onSubmit: (payload: InternFormPayload) => Promise<unknown> | unknown
  isPending: boolean
  idPrefix: string
}

interface PendingTemplateApplication {
  internshipIndex: number
  templateId: string
  startDate: string
}

function getSupervisorsForTeam(teams: Team[], teamId: string) {
  return teams.find((team) => team.id === teamId)?.supervisors ?? []
}

function createEmptyAssignment(startDate = '', endDate = ''): AssignmentFormState {
  return {
    teamId: '',
    supervisorId: '',
    startDate,
    endDate,
  }
}

function createEmptyInternship(startDate = '', endDate = ''): InternshipFormState {
  return {
    templateId: '',
    startDate,
    endDate,
    note: '',
    assignments: [createEmptyAssignment(startDate, endDate)],
  }
}

function createEmptyForm(initialRange?: InternFormDialogInitialRange | null): InternFormState {
  return {
    firstName: '',
    lastName: '',
    gender: 'male',
    school: '',
    notes: '',
    internships: initialRange ? [createEmptyInternship(initialRange.startDate, initialRange.endDate ?? '')] : [],
  }
}

function buildForm(intern?: Intern | null, initialRange?: InternFormDialogInitialRange | null): InternFormState {
  if (!intern) {
    return createEmptyForm(initialRange)
  }

  return {
    firstName: intern.firstName,
    lastName: intern.lastName,
    gender: intern.gender,
    school: intern.school ?? '',
    notes: intern.notes ?? '',
    internships: intern.internships.map((internship) => ({
      templateId: '',
      startDate: internship.startDate,
      endDate: internship.endDate,
      note: internship.note ?? '',
      assignments: internship.assignments.map((assignment) => ({
        teamId: assignment.teamId,
        supervisorId: assignment.supervisorId ?? '',
        startDate: assignment.startDate,
        endDate: assignment.endDate,
      })),
    })),
  }
}

function buildPayload(form: InternFormState): InternFormPayload {
  return {
    firstName: form.firstName,
    lastName: form.lastName,
    gender: form.gender,
    school: form.school || null,
    notes: form.notes || null,
    internships: form.internships.map((internship) => ({
      startDate: internship.startDate,
      endDate: internship.endDate,
      note: internship.note || null,
      assignments: internship.assignments.map((assignment) => ({
        teamId: assignment.teamId,
        supervisorId: assignment.supervisorId || null,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
      })),
    })),
  }
}

export function InternFormDialog({
  open,
  onOpenChange,
  intern,
  teams,
  initialRange,
  onSubmit,
  isPending,
  idPrefix,
}: InternFormDialogProps) {
  const { token } = useAuth()
  const { t } = useLanguage()
  const [form, setForm] = useState<InternFormState>(() => buildForm(intern, initialRange))
  const [pendingTemplateApplication, setPendingTemplateApplication] = useState<PendingTemplateApplication | null>(null)
  const isEditMode = Boolean(intern)

  const templatesQuery = useQuery({
    queryKey: internshipTemplateQueryKeys.active,
    queryFn: () => api.getInternshipTemplates(token!),
    enabled: Boolean(token),
  })

  const activeTemplates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data])

  const applyTemplateMutation = useMutation({
    mutationFn: async ({
      internshipIndex,
      templateId,
      startDate: internshipStartDate,
    }: {
      internshipIndex: number
      templateId: string
      startDate: string
    }) => {
      if (!token) {
        return null
      }

      const result = await api.applyInternshipTemplate(token, templateId, { startDate: internshipStartDate })
      return { internshipIndex, result }
    },
    onSuccess: (payload) => {
      if (!payload) {
        return
      }

      setForm((current) => ({
        ...current,
        internships: current.internships.map((internship, index) =>
          index === payload.internshipIndex
            ? {
                ...internship,
                endDate: payload.result.internshipEndDate,
                assignments: payload.result.assignments.map((assignment) => ({
                  teamId: assignment.teamId,
                  supervisorId: assignment.supervisorId ?? '',
                  startDate: assignment.startDate,
                  endDate: assignment.endDate,
                })),
              }
            : internship,
        ),
      }))
      toast.success(t('internshipTemplates.applyTemplateSuccess'))
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('internshipTemplates.applyTemplateError'))
    },
  })

  useEffect(() => {
    if (!open) {
      return
    }

    startTransition(() => {
      setForm(buildForm(intern, initialRange))
    })
  }, [initialRange, intern, open])

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)

    if (!nextOpen) {
      setForm(buildForm(intern, initialRange))
      setPendingTemplateApplication(null)
    }
  }

  const updateInternship = (
    internshipIndex: number,
    field: keyof Omit<InternshipFormState, 'assignments'>,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      internships: current.internships.map((internship, index) =>
        index === internshipIndex ? { ...internship, [field]: value } : internship,
      ),
    }))
  }

  const updateAssignment = (
    internshipIndex: number,
    assignmentIndex: number,
    field: keyof AssignmentFormState,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      internships: current.internships.map((internship, index) =>
        index === internshipIndex
          ? {
              ...internship,
              assignments: internship.assignments.map((assignment, currentAssignmentIndex) =>
                currentAssignmentIndex === assignmentIndex ? { ...assignment, [field]: value } : assignment,
              ),
            }
          : internship,
      ),
    }))
  }

  const updateAssignmentTeam = (internshipIndex: number, assignmentIndex: number, teamId: string) => {
    setForm((current) => ({
      ...current,
      internships: current.internships.map((internship, currentInternshipIndex) =>
        currentInternshipIndex === internshipIndex
          ? {
              ...internship,
              assignments: internship.assignments.map((assignment, currentAssignmentIndex) => {
                if (currentAssignmentIndex !== assignmentIndex) {
                  return assignment
                }

                const nextSupervisors = getSupervisorsForTeam(teams, teamId)
                const supervisorStillValid = nextSupervisors.some(
                  (supervisor) => supervisor.id === assignment.supervisorId,
                )

                return {
                  ...assignment,
                  teamId,
                  supervisorId: supervisorStillValid ? assignment.supervisorId : '',
                }
              }),
            }
          : internship,
      ),
    }))
  }

  const addInternship = () => {
    setForm((current) => ({
      ...current,
      internships: [
        ...current.internships,
        createEmptyInternship(initialRange?.startDate ?? '', initialRange?.endDate ?? ''),
      ],
    }))
  }

  const removeInternship = (internshipIndex: number) => {
    setForm((current) => ({
      ...current,
      internships: current.internships.filter((_, index) => index !== internshipIndex),
    }))
  }

  const addAssignment = (internshipIndex: number) => {
    setForm((current) => ({
      ...current,
      internships: current.internships.map((internship, index) =>
        index === internshipIndex
          ? { ...internship, assignments: [...internship.assignments, createEmptyAssignment()] }
          : internship,
      ),
    }))
  }

  const removeAssignment = (internshipIndex: number, assignmentIndex: number) => {
    setForm((current) => ({
      ...current,
      internships: current.internships.map((internship, index) =>
        index === internshipIndex
          ? {
              ...internship,
              assignments: internship.assignments.filter(
                (_, currentAssignmentIndex) => currentAssignmentIndex !== assignmentIndex,
              ),
            }
          : internship,
      ),
    }))
  }

  const applyTemplate = async (internshipIndex: number) => {
    const internship = form.internships[internshipIndex]
    if (!internship) {
      return
    }

    if (!internship.startDate) {
      toast.error(t('internshipTemplates.applyTemplateMissingStartDate'))
      return
    }

    if (!internship.templateId) {
      return
    }

    const hasMeaningfulAssignments = internship.assignments.some((assignment) =>
      Boolean(assignment.teamId || assignment.supervisorId || assignment.startDate || assignment.endDate),
    )

    if (hasMeaningfulAssignments) {
      setPendingTemplateApplication({
        internshipIndex,
        templateId: internship.templateId,
        startDate: internship.startDate,
      })
      return
    }

    await applyTemplateMutation.mutateAsync({
      internshipIndex,
      templateId: internship.templateId,
      startDate: internship.startDate,
    })
  }

  const confirmTemplateApplication = async () => {
    if (!pendingTemplateApplication) {
      return
    }

    const nextTemplateApplication = pendingTemplateApplication
    setPendingTemplateApplication(null)
    await applyTemplateMutation.mutateAsync(nextTemplateApplication)
  }

  return (
    <>
      <Dialog
        open={Boolean(pendingTemplateApplication)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !applyTemplateMutation.isPending) {
            setPendingTemplateApplication(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('internshipTemplates.applyTemplateConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('internshipTemplates.applyTemplateConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingTemplateApplication(null)}
              disabled={applyTemplateMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={() => void confirmTemplateApplication()} disabled={applyTemplateMutation.isPending}>
              {applyTemplateMutation.isPending
                ? t('common.saving')
                : t('internshipTemplates.applyTemplateConfirmAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-x-hidden overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{isEditMode ? t('interns.editTitle') : t('interns.createTitle')}</DialogTitle>
            <DialogDescription>{t('interns.formDescription')}</DialogDescription>
          </DialogHeader>

          <form
            className="min-w-0 space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              void onSubmit(buildPayload(form))
            }}
          >
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-first-name`}>{t('interns.firstName')}</Label>
                <Input
                  id={`${idPrefix}-first-name`}
                  value={form.firstName}
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-last-name`}>{t('interns.lastName')}</Label>
                <Input
                  id={`${idPrefix}-last-name`}
                  value={form.lastName}
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-gender`}>{t('interns.gender')}</Label>
                <Select
                  value={form.gender}
                  onValueChange={(value) => setForm((current) => ({ ...current, gender: value as Gender }))}
                >
                  <SelectTrigger id={`${idPrefix}-gender`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t('interns.genderMale')}</SelectItem>
                    <SelectItem value="female">{t('interns.genderFemale')}</SelectItem>
                    <SelectItem value="diverse">{t('interns.genderDiverse')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-school`}>{t('interns.school')}</Label>
                <Input
                  id={`${idPrefix}-school`}
                  value={form.school}
                  onChange={(event) => setForm((current) => ({ ...current, school: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-notes`}>{t('interns.notes')}</Label>
              <Textarea
                id={`${idPrefix}-notes`}
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">{t('interns.internships')}</h3>
                  <p className="text-xs text-muted-foreground">{t('interns.internshipsDescription')}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addInternship}>
                  {t('interns.addInternship')}
                </Button>
              </div>

              {form.internships.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-4 text-sm text-muted-foreground">
                  {t('interns.noInternshipsYet')}
                </div>
              ) : null}

              {form.internships.map((internship, internshipIndex) => (
                <div key={internshipIndex} className="space-y-4 rounded-3xl border border-border/80 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold">{t('interns.internshipTitle', { index: internshipIndex + 1 })}</h4>
                      <p className="text-xs text-muted-foreground">{t('interns.internshipExample')}</p>
                    </div>
                    <Button type="button" variant="ghost" onClick={() => removeInternship(internshipIndex)}>
                      {t('common.remove')}
                    </Button>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label>{t('interns.startDate')}</Label>
                      <Input
                        type="date"
                        value={internship.startDate}
                        onChange={(event) => updateInternship(internshipIndex, 'startDate', event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('interns.endDate')}</Label>
                      <Input
                        type="date"
                        value={internship.endDate}
                        onChange={(event) => updateInternship(internshipIndex, 'endDate', event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('interns.internshipNote')}</Label>
                      <Input
                        value={internship.note}
                        onChange={(event) => updateInternship(internshipIndex, 'note', event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 rounded-2xl border border-border/70 bg-background/60 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="space-y-2">
                      <Label>{t('internshipTemplates.selectTemplate')}</Label>
                      <Select
                        value={internship.templateId}
                        onValueChange={(value) => updateInternship(internshipIndex, 'templateId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('internshipTemplates.templatePlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {templatesQuery.isPending ? (
                            <SelectItem value="__loading__" disabled>
                              {t('internshipTemplates.selectLoading')}
                            </SelectItem>
                          ) : templatesQuery.isError ? (
                            <SelectItem value="__error__" disabled>
                              {t('internshipTemplates.selectLoadFailed')}
                            </SelectItem>
                          ) : activeTemplates.length === 0 ? (
                            <SelectItem value="__empty__" disabled>
                              {t('internshipTemplates.selectEmptyActive')}
                            </SelectItem>
                          ) : (
                            activeTemplates.map((template: InternshipTemplate) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">{t('internshipTemplates.applyTemplateHelp')}</p>
                    </div>
                    <div className="flex self-stretch items-center lg:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void applyTemplate(internshipIndex)}
                        disabled={!internship.templateId || applyTemplateMutation.isPending}
                      >
                        {t('internshipTemplates.applyTemplate')}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-sm font-semibold">{t('interns.assignments')}</h5>
                        <p className="text-xs text-muted-foreground">{t('interns.assignmentsDescription')}</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => addAssignment(internshipIndex)}>
                        {t('interns.addAssignment')}
                      </Button>
                    </div>

                    {internship.assignments.map((assignment, assignmentIndex) => {
                      const supervisors = getSupervisorsForTeam(teams, assignment.teamId)

                      return (
                        <div
                          key={`${internshipIndex}-${assignmentIndex}`}
                          className="grid gap-3 rounded-2xl border border-border/70 p-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                        >
                          <div className="space-y-2">
                            <Label>{t('interns.team')}</Label>
                            <Select
                              value={assignment.teamId}
                              onValueChange={(value) => updateAssignmentTeam(internshipIndex, assignmentIndex, value)}
                            >
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
                            <Label>{t('interns.supervisor')}</Label>
                            <Select
                              value={assignment.supervisorId}
                              onValueChange={(value) => updateAssignment(internshipIndex, assignmentIndex, 'supervisorId', value)}
                              disabled={!assignment.teamId || supervisors.length === 0}
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    !assignment.teamId
                                      ? t('interns.supervisorChooseTeam')
                                      : supervisors.length === 0
                                        ? t('interns.supervisorUnavailable')
                                        : t('interns.supervisorPlaceholder')
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {supervisors.map((supervisor) => (
                                  <SelectItem key={supervisor.id} value={supervisor.id}>
                                    {supervisor.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>{t('interns.from')}</Label>
                            <Input
                              type="date"
                              value={assignment.startDate}
                              onChange={(event) => updateAssignment(internshipIndex, assignmentIndex, 'startDate', event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t('interns.until')}</Label>
                            <Input
                              type="date"
                              value={assignment.endDate}
                              onChange={(event) => updateAssignment(internshipIndex, assignmentIndex, 'endDate', event.target.value)}
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={internship.assignments.length === 1}
                              onClick={() => removeAssignment(internshipIndex, assignmentIndex)}
                            >
                              {t('common.remove')}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <Button className="w-full" type="submit" disabled={isPending}>
              {isPending ? t('common.saving') : t('common.save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
