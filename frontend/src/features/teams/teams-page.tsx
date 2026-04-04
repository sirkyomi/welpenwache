import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, SquarePen } from 'lucide-react'
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
import { ApiError, api } from '@/lib/api'
import type { Team } from '@/lib/types'

interface TeamFormState {
  name: string
  description: string
  colorHex: string
  isArchived: boolean
}

const emptyForm: TeamFormState = {
  name: '',
  description: '',
  colorHex: '#2563EB',
  isArchived: false,
}

export function TeamsPage() {
  const { hasPermission, token } = useAuth()
  const queryClient = useQueryClient()
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
      }

      return editingTeam
        ? api.updateTeam(token, editingTeam.id, payload)
        : api.createTeam(token, payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams'] })
      toast.success(editingTeam ? 'Team aktualisiert.' : 'Team angelegt.')
      setOpen(false)
      setEditingTeam(null)
      setForm(emptyForm)
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Das Team konnte nicht gespeichert werden.')
    },
  })

  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data])

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
    })
    setOpen(true)
  }

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Teams</CardTitle>
            <CardDescription>
              Lege Teams an und pflege Farben und Beschreibungen für die Kalenderübersicht.
            </CardDescription>
          </div>
          {hasPermission('teams.manage') && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Team anlegen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingTeam ? 'Team bearbeiten' : 'Neues Team'}</DialogTitle>
                  <DialogDescription>
                    Alle Texte bleiben in der Oberfläche auf Deutsch, die API-Namen im Code auf Englisch.
                  </DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void saveMutation.mutateAsync()
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="team-name">Name</Label>
                    <Input
                      id="team-name"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team-color">Farbe</Label>
                    <Input
                      id="team-color"
                      value={form.colorHex}
                      onChange={(event) => setForm((current) => ({ ...current, colorHex: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team-description">Beschreibung</Label>
                    <Textarea
                      id="team-description"
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    />
                  </div>
                  <label className="flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={form.isArchived}
                      onCheckedChange={(checked) => setForm((current) => ({ ...current, isArchived: checked === true }))}
                    />
                    Team archivieren
                  </label>
                  <Button className="w-full" type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Speichert ...' : 'Speichern'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <Card key={team.id} className="border-border/70 bg-white/70">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      <span className="inline-block h-4 w-4 rounded-full" style={{ backgroundColor: team.colorHex }} />
                      {team.name}
                    </CardTitle>
                    <CardDescription>{team.description || 'Keine Beschreibung hinterlegt.'}</CardDescription>
                  </div>
                  {hasPermission('teams.manage') && (
                    <Button variant="ghost" size="sm" onClick={() => openEdit(team)}>
                      <SquarePen className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs font-medium text-muted-foreground">
                  {team.isArchived ? 'Archiviert' : 'Aktiv'}
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
