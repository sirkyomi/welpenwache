import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/features/localization/language-provider'
import type { Team } from '@/lib/types'

type EditableTeam = Pick<Team, 'name' | 'description' | 'colorHex' | 'isArchived' | 'supervisors'>

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

export interface TeamFormPayload {
  name: string
  description: string | null
  colorHex: string
  isArchived: boolean
  supervisors: Array<{
    id?: string
    name: string
    notes: string | null
  }>
}

interface TeamFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  team?: EditableTeam | null
  onSubmit: (payload: TeamFormPayload) => Promise<unknown> | unknown
  isPending: boolean
  idPrefix: string
}

const emptyForm: TeamFormState = {
  name: '',
  description: '',
  colorHex: '#2563EB',
  isArchived: false,
  supervisors: [],
}

function buildForm(team?: EditableTeam | null): TeamFormState {
  if (!team) {
    return emptyForm
  }

  return {
    name: team.name,
    description: team.description ?? '',
    colorHex: team.colorHex,
    isArchived: team.isArchived,
    supervisors: team.supervisors.map((supervisor) => ({
      id: supervisor.id,
      name: supervisor.name,
      notes: supervisor.notes ?? '',
    })),
  }
}

function buildPayload(form: TeamFormState): TeamFormPayload {
  return {
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
}

export function TeamFormDialog({
  open,
  onOpenChange,
  team,
  onSubmit,
  isPending,
  idPrefix,
}: TeamFormDialogProps) {
  const { t } = useLanguage()
  const [form, setForm] = useState<TeamFormState>(() => buildForm(team))
  const isEditMode = Boolean(team)

  useEffect(() => {
    if (!open) {
      return
    }

    setForm(buildForm(team))
  }, [open, team])

  const addSupervisor = () => {
    setForm((current) => ({
      ...current,
      supervisors: [...current.supervisors, { name: '', notes: '' }],
    }))
  }

  const updateSupervisor = (index: number, field: keyof SupervisorFormState, value: string) => {
    setForm((current) => ({
      ...current,
      supervisors: current.supervisors.map((supervisor, currentIndex) =>
        currentIndex === index ? { ...supervisor, [field]: value } : supervisor,
      ),
    }))
  }

  const removeSupervisor = (index: number) => {
    setForm((current) => ({
      ...current,
      supervisors: current.supervisors.filter((_, currentIndex) => currentIndex !== index),
    }))
  }

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)

    if (!nextOpen) {
      setForm(buildForm(team))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? t('teams.editTitle') : t('teams.createTitle')}</DialogTitle>
          <DialogDescription>{t('teams.formDescription')}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void onSubmit(buildPayload(form))
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-name`}>{t('common.name')}</Label>
            <Input
              id={`${idPrefix}-name`}
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-color`}>{t('common.color')}</Label>
            <div className="flex items-center gap-3">
              <Input
                id={`${idPrefix}-color`}
                type="color"
                value={form.colorHex}
                onChange={(event) => setForm((current) => ({ ...current, colorHex: event.target.value.toUpperCase() }))}
                className="h-11 w-16 cursor-pointer rounded-xl border-input bg-card p-1"
              />
              <Input value={form.colorHex} readOnly className="font-mono text-sm text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-description`}>{t('common.description')}</Label>
            <Textarea
              id={`${idPrefix}-description`}
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
                    {t('common.remove')}
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
          <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
            <Checkbox
              id={`${idPrefix}-archived`}
              checked={form.isArchived}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, isArchived: checked === true }))}
            />
            <Label htmlFor={`${idPrefix}-archived`}>{t('teams.archiveTeam')}</Label>
          </div>
          <Button className="w-full" type="submit" disabled={isPending}>
            {isPending ? t('common.saving') : t('common.save')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
