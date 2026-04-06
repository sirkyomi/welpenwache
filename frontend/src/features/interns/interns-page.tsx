import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, SquarePen, Trash2, UsersRound } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/auth-provider'
import { useLanguage } from '@/features/localization/language-provider'
import { ApiError, api } from '@/lib/api'
import type { Intern, Team } from '@/lib/types'

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
  school: string
  notes: string
  internships: InternshipFormState[]
}

function createEmptyAssignment(): AssignmentFormState {
  return {
    teamId: '',
    supervisorId: '',
    startDate: '',
    endDate: '',
  }
}

function createEmptyInternship(): InternshipFormState {
  return {
    startDate: '',
    endDate: '',
    note: '',
    assignments: [createEmptyAssignment()],
  }
}

function createEmptyForm(): InternFormState {
  return {
    firstName: '',
    lastName: '',
    school: '',
    notes: '',
    internships: [],
  }
}

function getSupervisorsForTeam(teams: Team[], teamId: string) {
  return teams.find((team) => team.id === teamId)?.supervisors ?? []
}

export function InternsPage() {
  const { hasPermission, token } = useAuth()
  const { formatDateRange, t } = useLanguage()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [editingIntern, setEditingIntern] = useState<Intern | null>(null)
  const [internPendingDelete, setInternPendingDelete] = useState<Intern | null>(null)
  const [form, setForm] = useState<InternFormState>(createEmptyForm)

  const internsQuery = useQuery({
    queryKey: ['interns'],
    queryFn: () => api.getInterns(token!),
    enabled: Boolean(token),
  })

  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.getTeams(token!),
    enabled: Boolean(token),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        return null
      }

      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
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

      return editingIntern
        ? api.updateIntern(token, editingIntern.id, payload)
        : api.createIntern(token, payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['interns'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      toast.success(editingIntern ? t('interns.updated') : t('interns.created'))
      setOpen(false)
      setEditingIntern(null)
      setForm(createEmptyForm())
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('interns.saveFailed'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (intern: Intern) => {
      if (!token) {
        return
      }

      await api.deleteIntern(token, intern.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['interns'] })
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      setInternPendingDelete(null)
      toast.success(t('interns.deleted'))
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('interns.deleteFailed'))
    },
  })

  const interns = useMemo(() => internsQuery.data ?? [], [internsQuery.data])
  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data])
  const requestedEditInternId = searchParams.get('edit')

  const openCreate = () => {
    setEditingIntern(null)
    setForm(createEmptyForm())
    setOpen(true)
  }

  const openEdit = (intern: Intern) => {
    setEditingIntern(intern)
    setForm({
      firstName: intern.firstName,
      lastName: intern.lastName,
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
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!hasPermission('interns.manage') || !requestedEditInternId || interns.length === 0) {
      return
    }

    const requestedIntern = interns.find((intern) => intern.id === requestedEditInternId)
    if (!requestedIntern) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      openEdit(requestedIntern)

      const nextSearchParams = new URLSearchParams(searchParams)
      nextSearchParams.delete('edit')
      setSearchParams(nextSearchParams, { replace: true })
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [hasPermission, interns, requestedEditInternId, searchParams, setSearchParams])

  const deleteIntern = async (intern: Intern) => {
    await deleteMutation.mutateAsync(intern)
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
    <section className="space-y-6">
      <Dialog
        open={Boolean(internPendingDelete)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteMutation.isPending) {
            setInternPendingDelete(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('interns.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {internPendingDelete
                ? t('interns.deleteDescription', { name: internPendingDelete.fullName })
                : t('interns.deleteDescriptionFallback')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setInternPendingDelete(null)}
              disabled={deleteMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => internPendingDelete && void deleteIntern(internPendingDelete)}
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
            <CardTitle>{t('interns.title')}</CardTitle>
            <CardDescription>{t('interns.description')}</CardDescription>
          </div>
          {hasPermission('interns.manage') && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  {t('interns.create')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                  <DialogTitle>{editingIntern ? t('interns.editTitle') : t('interns.createTitle')}</DialogTitle>
                  <DialogDescription>{t('interns.formDescription')}</DialogDescription>
                </DialogHeader>

                <form
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void saveMutation.mutateAsync()
                  }}
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="intern-first-name">{t('interns.firstName')}</Label>
                      <Input
                        id="intern-first-name"
                        value={form.firstName}
                        onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="intern-last-name">{t('interns.lastName')}</Label>
                      <Input
                        id="intern-last-name"
                        value={form.lastName}
                        onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="intern-school">{t('interns.school')}</Label>
                      <Input
                        id="intern-school"
                        value={form.school}
                        onChange={(event) => setForm((current) => ({ ...current, school: event.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="intern-notes">{t('interns.notes')}</Label>
                    <Textarea
                      id="intern-notes"
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
          )}
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {interns.map((intern) => (
            <Card key={intern.id} className="border-border/70 bg-card/80">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <UsersRound className="h-4 w-4 text-primary" />
                      <Link
                        to={`/praktikanten/${intern.id}`}
                        className="transition-colors hover:text-primary focus:outline-none focus:text-primary"
                      >
                        {intern.fullName}
                      </Link>
                    </CardTitle>
                    <CardDescription>{intern.school || t('interns.schoolMissing')}</CardDescription>
                  </div>
                  {hasPermission('interns.manage') ? (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(intern)}>
                        <SquarePen className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInternPendingDelete(intern)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {intern.notes ? <p className="text-sm text-muted-foreground">{intern.notes}</p> : null}

                <div className="space-y-3">
                  {intern.internships.length === 0 ? (
                    <div className="rounded-2xl bg-muted/70 px-3 py-3 text-sm text-muted-foreground">
                      {t('interns.noPlannedInternships')}
                    </div>
                  ) : (
                    intern.internships.map((internship) => (
                      <div key={internship.id} className="rounded-2xl border border-border/70 bg-background/70 p-3">
                        <div className="mb-2">
                          <p className="text-sm font-semibold">
                            {formatDateRange(internship.startDate, internship.endDate)}
                          </p>
                          {internship.note ? <p className="text-xs text-muted-foreground">{internship.note}</p> : null}
                        </div>

                        <div className="space-y-2">
                          {internship.assignments.map((assignment) => (
                            <div key={assignment.id} className="rounded-2xl border border-border/70 bg-card/75 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold">{assignment.teamName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDateRange(assignment.startDate, assignment.endDate)}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {t('interns.supervisorPrefix', {
                                      name: assignment.supervisorName || t('interns.supervisorMissing'),
                                    })}
                                  </p>
                                </div>
                                <span
                                  className="inline-block h-3 w-3 rounded-full"
                                  style={{ backgroundColor: assignment.teamColorHex }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
