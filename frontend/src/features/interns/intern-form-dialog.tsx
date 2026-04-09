import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/features/localization/language-provider'
import type { Gender, Intern, Team } from '@/lib/types'

interface AssignmentFormState {
  teamId: string
  supervisorId: string
  startDate: string
  endDate: string
}

interface InternshipFormState {
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
  startDate?: string
  onSubmit: (payload: InternFormPayload) => Promise<unknown> | unknown
  isPending: boolean
  idPrefix: string
}

function getSupervisorsForTeam(teams: Team[], teamId: string) {
  return teams.find((team) => team.id === teamId)?.supervisors ?? []
}

function createEmptyAssignment(startDate = ''): AssignmentFormState {
  return {
    teamId: '',
    supervisorId: '',
    startDate,
    endDate: '',
  }
}

function createEmptyInternship(startDate = ''): InternshipFormState {
  return {
    startDate,
    endDate: '',
    note: '',
    assignments: [createEmptyAssignment(startDate)],
  }
}

function createEmptyForm(startDate?: string): InternFormState {
  return {
    firstName: '',
    lastName: '',
    gender: 'male',
    school: '',
    notes: '',
    internships: startDate ? [createEmptyInternship(startDate)] : [],
  }
}

function buildForm(intern?: Intern | null, startDate?: string): InternFormState {
  if (!intern) {
    return createEmptyForm(startDate)
  }

  return {
    firstName: intern.firstName,
    lastName: intern.lastName,
    gender: intern.gender,
    school: intern.school ?? '',
    notes: intern.notes ?? '',
    internships: intern.internships.map((internship) => ({
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
  startDate,
  onSubmit,
  isPending,
  idPrefix,
}: InternFormDialogProps) {
  const { t } = useLanguage()
  const [form, setForm] = useState<InternFormState>(() => buildForm(intern, startDate))
  const isEditMode = Boolean(intern)

  useEffect(() => {
    if (!open) {
      return
    }

    setForm(buildForm(intern, startDate))
  }, [intern, open, startDate])

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)

    if (!nextOpen) {
      setForm(buildForm(intern, startDate))
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
      internships: [...current.internships, createEmptyInternship()],
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? t('interns.editTitle') : t('interns.createTitle')}</DialogTitle>
          <DialogDescription>{t('interns.formDescription')}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            void onSubmit(buildPayload(form))
          }}
        >
          <div className="grid gap-4 md:grid-cols-4">
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

                <div className="grid gap-4 md:grid-cols-3">
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
                        className="grid gap-3 rounded-2xl border border-border/70 p-4 md:grid-cols-[1.2fr_1.2fr_1fr_1fr_auto]"
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
  )
}
