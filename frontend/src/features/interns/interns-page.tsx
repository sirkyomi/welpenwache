import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileDown, Plus, SquarePen, Trash2, UsersRound } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
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
import { appendReturnTo, parseCalendarReturnTo } from '@/features/calendar/calendar-navigation'
import { useLanguage } from '@/features/localization/language-provider'
import { ApiError, api } from '@/lib/api'
import { downloadBlob } from '@/lib/download'
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

function getSupervisorsForTeam(teams: Team[], teamId: string) {
  return teams.find((team) => team.id === teamId)?.supervisors ?? []
}

function normalizeRequestedStartDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

type InternSortKey =
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'school'
  | 'gender'
  | 'firstStartDate'
  | 'lastEndDate'
  | 'periodCount'
  | 'teamCount'
  | 'primaryTeam'
  | 'periodStatus'

type InternSortDirection = 'asc' | 'desc'
type InternGroupKey = 'none' | 'team' | 'periodStatus' | 'startMonth' | 'gender' | 'school'
type InternshipStatus = 'current' | 'upcoming' | 'completed' | 'none'

interface DerivedAssignment {
  id: string
  teamName: string
  supervisorName: string | null
  startDate: string
  endDate: string
}

interface DerivedInternListItem {
  intern: Intern
  teamNames: string[]
  teamSummary: string
  firstStartDate: string | null
  lastEndDate: string | null
  primaryTeamName: string | null
  periodCount: number
  teamCount: number
  periodStatus: InternshipStatus
  searchText: string
}

function getTodayIsoDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function normalizeSearchText(value: string, locale: string) {
  return value
    .trim()
    .toLocaleLowerCase(locale)
    .replace(/\u00e4/g, 'ae')
    .replace(/\u00f6/g, 'oe')
    .replace(/\u00fc/g, 'ue')
    .replace(/\u00df/g, 'ss')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function getInternshipStatus(intern: Intern, todayIsoDate: string): InternshipStatus {
  if (intern.internships.length === 0) {
    return 'none'
  }

  if (intern.internships.some((internship) => internship.startDate <= todayIsoDate && internship.endDate >= todayIsoDate)) {
    return 'current'
  }

  if (intern.internships.some((internship) => internship.startDate > todayIsoDate)) {
    return 'upcoming'
  }

  return 'completed'
}

function getDerivedAssignments(intern: Intern): DerivedAssignment[] {
  return intern.internships
    .flatMap((internship) =>
      internship.assignments.map((assignment) => ({
        id: assignment.id,
        teamName: assignment.teamName,
        supervisorName: assignment.supervisorName,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
      })),
    )
    .sort((left, right) => left.startDate.localeCompare(right.startDate) || left.endDate.localeCompare(right.endDate))
}

export function InternsPage() {
  const { hasPermission, token } = useAuth()
  const { formatDateRange, formatMonthYear, languagePreference, t } = useLanguage()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [editingIntern, setEditingIntern] = useState<Intern | null>(null)
  const [internPendingDelete, setInternPendingDelete] = useState<Intern | null>(null)
  const [form, setForm] = useState<InternFormState>(createEmptyForm)
  const [searchValue, setSearchValue] = useState('')
  const [sortKey, setSortKey] = useState<InternSortKey>('fullName')
  const [sortDirection, setSortDirection] = useState<InternSortDirection>('asc')
  const [groupKey, setGroupKey] = useState<InternGroupKey>('none')
  const canManageInterns = hasPermission('interns.manage')
  const canRunCompletion = hasPermission('documents.view') || hasPermission('documents.manage')
  const deferredSearchValue = useDeferredValue(searchValue)

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

  const completionMutation = useMutation({
    mutationFn: async (intern: Intern) => {
      if (!token) {
        return null
      }

      const download = await api.generateCompletionDocuments(token, intern.id)
      return { ...download, intern }
    },
    onSuccess: (result) => {
      if (!result) {
        return
      }

      downloadBlob(result.blob, result.fileName ?? `abschlussunterlagen-${result.intern.id}.zip`)
      toast.success(t('interns.completionSuccess', { name: result.intern.fullName }))
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : t('interns.completionFailed'))
    },
  })

  const interns = useMemo(() => internsQuery.data ?? [], [internsQuery.data])
  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data])
  const requestedCreate = searchParams.get('create') === '1'
  const requestedEditInternId = searchParams.get('edit')
  const requestedStartDate = normalizeRequestedStartDate(searchParams.get('startDate'))
  const calendarReturnTo = parseCalendarReturnTo(searchParams.get('returnTo'))
  const collator = useMemo(
    () => new Intl.Collator(languagePreference === 'de' ? 'de-DE' : 'en-GB', { numeric: true, sensitivity: 'base' }),
    [languagePreference],
  )

  const openCreate = (startDate?: string) => {
    setEditingIntern(null)
    setForm(createEmptyForm(startDate))
    setOpen(true)
  }

  const openEdit = (intern: Intern) => {
    setEditingIntern(intern)
    setForm({
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
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!canManageInterns || !requestedEditInternId || interns.length === 0) {
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
  }, [canManageInterns, interns, requestedEditInternId, searchParams, setSearchParams])

  useEffect(() => {
    if (!canManageInterns || !requestedCreate) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      openCreate(requestedStartDate)

      const nextSearchParams = new URLSearchParams(searchParams)
      nextSearchParams.delete('create')
      nextSearchParams.delete('startDate')
      setSearchParams(nextSearchParams, { replace: true })
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [canManageInterns, requestedCreate, requestedStartDate, searchParams, setSearchParams])

  const deleteIntern = async (intern: Intern) => {
    await deleteMutation.mutateAsync(intern)
  }

  const genderLabels = useMemo<Record<Gender, string>>(
    () => ({
      male: t('interns.genderMale'),
      female: t('interns.genderFemale'),
      diverse: t('interns.genderDiverse'),
    }),
    [t],
  )

  const periodStatusLabels = useMemo<Record<InternshipStatus, string>>(
    () => ({
      current: t('interns.groupLabelCurrent'),
      upcoming: t('interns.groupLabelUpcoming'),
      completed: t('interns.groupLabelCompleted'),
      none: t('interns.groupLabelNoPeriod'),
    }),
    [t],
  )

  const sortOptions = [
    { value: 'fullName' as const, label: t('interns.sortFullName') },
    { value: 'firstName' as const, label: t('interns.sortFirstName') },
    { value: 'lastName' as const, label: t('interns.sortLastName') },
    { value: 'school' as const, label: t('interns.sortSchool') },
    { value: 'gender' as const, label: t('interns.sortGender') },
    { value: 'firstStartDate' as const, label: t('interns.sortFirstStartDate') },
    { value: 'lastEndDate' as const, label: t('interns.sortLastEndDate') },
    { value: 'periodCount' as const, label: t('interns.sortPeriodCount') },
    { value: 'teamCount' as const, label: t('interns.sortTeamCount') },
    { value: 'primaryTeam' as const, label: t('interns.sortPrimaryTeam') },
    { value: 'periodStatus' as const, label: t('interns.sortPeriodStatus') },
  ]

  const groupOptions = [
    { value: 'none' as const, label: t('interns.groupNone') },
    { value: 'team' as const, label: t('interns.groupByTeam') },
    { value: 'periodStatus' as const, label: t('interns.groupByPeriodStatus') },
    { value: 'startMonth' as const, label: t('interns.groupByStartMonth') },
    { value: 'gender' as const, label: t('interns.groupByGender') },
    { value: 'school' as const, label: t('interns.groupBySchool') },
  ]

  const derivedInterns = useMemo<DerivedInternListItem[]>(() => {
    const todayIsoDate = getTodayIsoDate()

    return interns.map((intern) => {
      const assignments = getDerivedAssignments(intern)
      const currentAssignment = assignments.find(
        (assignment) => assignment.startDate <= todayIsoDate && assignment.endDate >= todayIsoDate,
      )
      const upcomingAssignment = assignments.find((assignment) => assignment.startDate > todayIsoDate)
      const primaryAssignment = currentAssignment ?? upcomingAssignment ?? assignments.at(-1) ?? null
      const teamNames = Array.from(new Set(assignments.map((assignment) => assignment.teamName).filter(Boolean))).sort(
        collator.compare,
      )
      const teamSummary = teamNames.join(', ')
      const firstStartDate = intern.internships.reduce<string | null>(
        (current, internship) =>
          current === null || internship.startDate < current ? internship.startDate : current,
        null,
      )
      const lastEndDate = intern.internships.reduce<string | null>(
        (current, internship) => (current === null || internship.endDate > current ? internship.endDate : current),
        null,
      )
      const supervisorNames = Array.from(
        new Set(assignments.map((assignment) => assignment.supervisorName).filter((value): value is string => Boolean(value))),
      ).sort(collator.compare)
      const noteTexts = intern.internships.map((internship) => internship.note).filter((value): value is string => Boolean(value))

      return {
        intern,
        teamNames,
        teamSummary,
        firstStartDate,
        lastEndDate,
        primaryTeamName: primaryAssignment?.teamName ?? null,
        periodCount: intern.internships.length,
        teamCount: teamNames.length,
        periodStatus: getInternshipStatus(intern, todayIsoDate),
        searchText: [
          intern.fullName,
          intern.firstName,
          intern.lastName,
          intern.school ?? '',
          intern.notes ?? '',
          intern.gender,
          ...teamNames,
          ...supervisorNames,
          ...noteTexts,
        ].join(' '),
      }
    })
      .map((item) => ({
        ...item,
        searchText: normalizeSearchText(item.searchText, languagePreference),
      }))
  }, [collator, interns, languagePreference])

  const visibleInterns = useMemo(() => {
    const normalizedSearch = normalizeSearchText(deferredSearchValue, languagePreference)
    const filteredInterns =
      normalizedSearch.length === 0
        ? derivedInterns
        : derivedInterns.filter((item) => item.searchText.includes(normalizedSearch))

    const compareNullableText = (left: string | null, right: string | null) => {
      if (!left && !right) {
        return 0
      }

      if (!left) {
        return 1
      }

      if (!right) {
        return -1
      }

      return collator.compare(left, right)
    }

    const compareNullableDate = (left: string | null, right: string | null) => {
      if (!left && !right) {
        return 0
      }

      if (!left) {
        return 1
      }

      if (!right) {
        return -1
      }

      return left.localeCompare(right)
    }

    const comparePeriodStatus = (left: InternshipStatus, right: InternshipStatus) => {
      const order: Record<InternshipStatus, number> = {
        current: 0,
        upcoming: 1,
        completed: 2,
        none: 3,
      }

      return order[left] - order[right]
    }

    const sortedInterns = [...filteredInterns].sort((left, right) => {
      let result = 0

      switch (sortKey) {
        case 'firstName':
          result = collator.compare(left.intern.firstName, right.intern.firstName)
          break
        case 'lastName':
          result = collator.compare(left.intern.lastName, right.intern.lastName)
          break
        case 'school':
          result = compareNullableText(left.intern.school, right.intern.school)
          break
        case 'gender':
          result = collator.compare(genderLabels[left.intern.gender], genderLabels[right.intern.gender])
          break
        case 'firstStartDate':
          result = compareNullableDate(left.firstStartDate, right.firstStartDate)
          break
        case 'lastEndDate':
          result = compareNullableDate(left.lastEndDate, right.lastEndDate)
          break
        case 'periodCount':
          result = left.periodCount - right.periodCount
          break
        case 'teamCount':
          result = left.teamCount - right.teamCount
          break
        case 'primaryTeam':
          result = compareNullableText(left.primaryTeamName, right.primaryTeamName)
          break
        case 'periodStatus':
          result = comparePeriodStatus(left.periodStatus, right.periodStatus)
          break
        default:
          result = collator.compare(left.intern.fullName, right.intern.fullName)
          break
      }

      if (result === 0) {
        result = collator.compare(left.intern.fullName, right.intern.fullName)
      }

      return sortDirection === 'desc' ? result * -1 : result
    })

    return sortedInterns
  }, [collator, deferredSearchValue, derivedInterns, genderLabels, languagePreference, sortDirection, sortKey])

  const groupedInterns = useMemo(() => {
    const groups = new Map<string, { label: string | null; items: DerivedInternListItem[] }>()

    for (const item of visibleInterns) {
      let groupLabel: string | null = null

      switch (groupKey) {
        case 'team':
          groupLabel = item.primaryTeamName ?? t('interns.groupLabelNoTeam')
          break
        case 'periodStatus':
          groupLabel = periodStatusLabels[item.periodStatus]
          break
        case 'startMonth':
          groupLabel = item.firstStartDate
            ? formatMonthYear(new Date(`${item.firstStartDate}T00:00:00`))
            : t('interns.groupLabelNoPeriod')
          break
        case 'gender':
          groupLabel = genderLabels[item.intern.gender]
          break
        case 'school':
          groupLabel = item.intern.school?.trim() || t('interns.originMissing')
          break
        default:
          groupLabel = null
          break
      }

      const groupKeyValue = groupLabel ?? 'all'
      const existingGroup = groups.get(groupKeyValue)

      if (existingGroup) {
        existingGroup.items.push(item)
      } else {
        groups.set(groupKeyValue, { label: groupLabel, items: [item] })
      }
    }

    return Array.from(groups.entries())
      .map(([key, value]) => ({
        key,
        label: value.label,
        items: value.items,
      }))
      .sort((left, right) => {
        if (groupKey === 'periodStatus') {
          const order = [
            periodStatusLabels.current,
            periodStatusLabels.upcoming,
            periodStatusLabels.completed,
            periodStatusLabels.none,
          ]

          return order.indexOf(left.label ?? '') - order.indexOf(right.label ?? '')
        }

        if (groupKey === 'team' && left.label === t('interns.groupLabelNoTeam')) {
          return 1
        }

        if (groupKey === 'team' && right.label === t('interns.groupLabelNoTeam')) {
          return -1
        }

        return collator.compare(left.label ?? '', right.label ?? '')
      })
  }, [collator, formatMonthYear, genderLabels, groupKey, periodStatusLabels, t, visibleInterns])

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
          {canManageInterns && (
            <Dialog
              open={open}
              onOpenChange={(nextOpen) => {
                setOpen(nextOpen)

                if (!nextOpen) {
                  setEditingIntern(null)
                  setForm(createEmptyForm())
                }
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={() => openCreate()}>
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
                  <div className="grid gap-4 md:grid-cols-4">
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
                      <Label htmlFor="intern-gender">{t('interns.gender')}</Label>
                      <Select
                        value={form.gender}
                        onValueChange={(value) => setForm((current) => ({ ...current, gender: value as Gender }))}
                      >
                        <SelectTrigger id="intern-gender">
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
        <CardContent className="space-y-6">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
            <div className="space-y-2">
              <Label htmlFor="intern-search">{t('interns.search')}</Label>
              <Input
                id="intern-search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={t('interns.searchPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('interns.sortBy')}</Label>
              <Select value={sortKey} onValueChange={(value) => setSortKey(value as InternSortKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('interns.sortDirection')}</Label>
              <Select
                value={sortDirection}
                onValueChange={(value) => setSortDirection(value as InternSortDirection)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">{t('interns.sortAscending')}</SelectItem>
                  <SelectItem value="desc">{t('interns.sortDescending')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('interns.groupBy')}</Label>
              <Select value={groupKey} onValueChange={(value) => setGroupKey(value as InternGroupKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groupOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{t('interns.visibleCount', { count: visibleInterns.length })}</Badge>
            <Badge variant="outline">{t('interns.totalCount', { count: interns.length })}</Badge>
            {groupKey !== 'none' ? <Badge variant="outline">{t('interns.groupActive')}</Badge> : null}
          </div>

          {visibleInterns.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/80 bg-background/60 px-4 py-8 text-center text-sm text-muted-foreground">
              {t('interns.noSearchResults')}
            </div>
          ) : (
            groupedInterns.map((group) => (
              <div key={group.key} className="space-y-4">
                {group.label ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        {group.label}
                      </h3>
                    </div>
                    <Badge variant="outline">{t('interns.visibleCount', { count: group.items.length })}</Badge>
                  </div>
                ) : null}

                <div className="space-y-4">
                  {group.items.map((item) => (
                    <Card key={item.intern.id} className="border-border/70 bg-card/80">
                      <CardHeader>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-3">
                            <div>
                              <CardTitle className="flex items-center gap-2">
                                <UsersRound className="h-4 w-4 text-primary" />
                                <Link
                                  to={appendReturnTo(`/praktikanten/${item.intern.id}`, calendarReturnTo)}
                                  className="transition-colors hover:text-primary focus:outline-none focus:text-primary"
                                >
                                  {item.intern.fullName}
                                </Link>
                              </CardTitle>
                              <CardDescription>{item.intern.school || t('interns.schoolMissing')}</CardDescription>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary">{periodStatusLabels[item.periodStatus]}</Badge>
                              <Badge variant="outline">{t('interns.plannedPeriods', { count: item.periodCount })}</Badge>
                              <Badge variant="outline">{t('interns.teamCountLabel', { count: item.teamCount })}</Badge>
                              {item.primaryTeamName ? (
                                <Badge variant="outline">
                                  {t('interns.primaryTeamLabel', { name: item.primaryTeamName })}
                                </Badge>
                              ) : null}
                            </div>
                          </div>

                          {canRunCompletion || canManageInterns ? (
                            <div className="flex items-center gap-1 self-start">
                              {canRunCompletion ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void completionMutation.mutateAsync(item.intern)}
                                  disabled={completionMutation.isPending}
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {canManageInterns ? (
                                <Button variant="ghost" size="sm" onClick={() => openEdit(item.intern)}>
                                  <SquarePen className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {canManageInterns ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setInternPendingDelete(item.intern)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {t('interns.genderLabel', { gender: genderLabels[item.intern.gender] })}
                          </p>
                          {item.teamSummary ? (
                            <p className="text-sm text-muted-foreground">
                              {t('interns.teamSummary', { teams: item.teamSummary })}
                            </p>
                          ) : null}
                          {item.intern.notes ? (
                            <p className="text-sm text-muted-foreground">{item.intern.notes}</p>
                          ) : null}
                        </div>

                        <div className="space-y-3">
                          {item.intern.internships.length === 0 ? (
                            <div className="rounded-2xl bg-muted/70 px-3 py-3 text-sm text-muted-foreground">
                              {t('interns.noPlannedInternships')}
                            </div>
                          ) : (
                            item.intern.internships.map((internship) => (
                              <div
                                key={internship.id}
                                className="rounded-2xl border border-border/70 bg-background/70 p-3"
                              >
                                <div className="mb-2">
                                  <p className="text-sm font-semibold">
                                    {formatDateRange(internship.startDate, internship.endDate)}
                                  </p>
                                  {internship.note ? (
                                    <p className="text-xs text-muted-foreground">{internship.note}</p>
                                  ) : null}
                                </div>

                                <div className="space-y-2">
                                  {internship.assignments.map((assignment) => (
                                    <div
                                      key={assignment.id}
                                      className="rounded-2xl border border-border/70 bg-card/75 p-3"
                                    >
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

                        {canRunCompletion ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => void completionMutation.mutateAsync(item.intern)}
                            disabled={completionMutation.isPending}
                          >
                            <FileDown className="h-4 w-4" />
                            {completionMutation.isPending && completionMutation.variables?.id === item.intern.id
                              ? t('interns.completionRunning')
                              : t('interns.completeIntern')}
                          </Button>
                        ) : null}
                      </CardContent>
                    </Card>
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
