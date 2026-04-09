import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { Gender, Team } from '@/lib/types'

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

interface CalendarCreateInternDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialRange: {
    startDate: string
    endDate?: string
  } | null
}

function createAssignment(startDate = '', endDate = ''): AssignmentFormState {
  return {
    teamId: '',
    supervisorId: '',
    startDate,
    endDate,
  }
}

function createInternship(startDate = '', endDate = ''): InternshipFormState {
  return {
    startDate,
    endDate,
    note: '',
    assignments: [createAssignment(startDate, endDate)],
  }
}

function createForm(range?: { startDate: string; endDate?: string } | null): InternFormState {
  return {
    firstName: '',
    lastName: '',
    gender: 'male',
    school: '',
    notes: '',
    internships: range ? [createInternship(range.startDate, range.endDate ?? '')] : [],
  }
}

function getSupervisorsForTeam(teams: Team[], teamId: string) {
  return teams.find((team) => team.id === teamId)?.supervisors ?? []
}

export function CalendarCreateInternDialog({
  open,
  onOpenChange,
  initialRange,
}: CalendarCreateInternDialogProps) {
  const { token } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<InternFormState>(() => createForm(initialRange))

  useEffect(() => {
    if (open) {
      setForm(createForm(initialRange))
    }
  }, [initialRange, open])

  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.getTeams(token!),
    enabled: open && Boolean(token),
  })

  const teams = teamsQuery.data ?? []

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        return null
      }

      return api.createIntern(token, {
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
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['interns'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      toast.success(t('interns.created'))
      onOpenChange(false)
      setForm(createForm(initialRange))
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('interns.saveFailed'))
    },
  })

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
                currentAssignmentIndex === assignmentIndex
                  ? { ...assignment, [field]: value }
                  : assignment,
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
    const range = initialRange ?? { startDate: '', endDate: '' }
    setForm((current) => ({
      ...current,
      internships: [...current.internships, createInternship(range.startDate, range.endDate)],
    }))
  }

  const removeInternship = (internshipIndex: number) => {
    setForm((current) => ({
      ...current,
      internships: current.internships.filter((_, index) => index !== internshipIndex),
    }))
  }

  const addAssignment = (internshipIndex: number) => {
    const internship = form.internships[internshipIndex]
    setForm((current) => ({
      ...current,
      internships: current.internships.map((currentInternship, index) =>
        index === internshipIndex
          ? {
              ...currentInternship,
              assignments: [
                ...currentInternship.assignments,
                createAssignment(internship?.startDate ?? '', internship?.endDate ?? ''),
              ],
            }
          : currentInternship,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('interns.createTitle')}</DialogTitle>
          <DialogDescription>{t('interns.formDescription')}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            void saveMutation.mutateAsync()
          }}
        >
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="calendar-intern-first-name">{t('interns.firstName')}</Label>
              <Input
                id="calendar-intern-first-name"
                value={form.firstName}
                onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-intern-last-name">{t('interns.lastName')}</Label>
              <Input
                id="calendar-intern-last-name"
                value={form.lastName}
                onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-intern-gender">{t('interns.gender')}</Label>
              <Select
                value={form.gender}
                onValueChange={(value) => setForm((current) => ({ ...current, gender: value as Gender }))}
              >
                <SelectTrigger id="calendar-intern-gender">
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
              <Label htmlFor="calendar-intern-school">{t('interns.school')}</Label>
              <Input
                id="calendar-intern-school"
                value={form.school}
                onChange={(event) => setForm((current) => ({ ...current, school: event.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="calendar-intern-notes">{t('interns.notes')}</Label>
            <Textarea
              id="calendar-intern-notes"
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
                <Plus className="h-4 w-4" />
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
                      <Plus className="h-4 w-4" />
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

          <Button className="w-full" type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
