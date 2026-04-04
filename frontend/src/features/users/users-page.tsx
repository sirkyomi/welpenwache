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
import { useAuth } from '@/features/auth/auth-provider'
import { ApiError, api } from '@/lib/api'
import type { AuthUser, Permission } from '@/lib/types'

const permissionOptions: Array<{ value: Permission; label: string }> = [
  { value: 'interns.view', label: 'Praktikanten sehen' },
  { value: 'interns.manage', label: 'Praktikanten bearbeiten' },
  { value: 'teams.view', label: 'Teams sehen' },
  { value: 'teams.manage', label: 'Teams verwalten' },
]

const permissionLabels = Object.fromEntries(permissionOptions.map((option) => [option.value, option.label]))

interface UserFormState {
  userName: string
  password: string
  isAdministrator: boolean
  isActive: boolean
  permissions: Permission[]
}

const emptyForm: UserFormState = {
  userName: '',
  password: '',
  isAdministrator: false,
  isActive: true,
  permissions: ['interns.view'],
}

export function UsersPage() {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null)
  const [form, setForm] = useState<UserFormState>(emptyForm)

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(token!),
    enabled: Boolean(token),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        return null
      }

      if (editingUser) {
        return api.updateUser(token, editingUser.id, {
          userName: form.userName,
          isAdministrator: form.isAdministrator,
          isActive: form.isActive,
          newPassword: form.password || null,
          permissions: form.permissions,
        })
      }

      return api.createUser(token, {
        userName: form.userName,
        password: form.password,
        isAdministrator: form.isAdministrator,
        isActive: form.isActive,
        permissions: form.permissions,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(editingUser ? 'Benutzer aktualisiert.' : 'Benutzer angelegt.')
      setOpen(false)
      setEditingUser(null)
      setForm(emptyForm)
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Der Benutzer konnte nicht gespeichert werden.')
    },
  })

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data])

  const openCreate = () => {
    setEditingUser(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const openEdit = (user: AuthUser) => {
    setEditingUser(user)
    setForm({
      userName: user.userName,
      password: '',
      isAdministrator: user.isAdministrator,
      isActive: user.isActive,
      permissions: user.permissions,
    })
    setOpen(true)
  }

  const togglePermission = (permission: Permission, checked: boolean) => {
    setForm((current) => ({
      ...current,
      permissions: checked
        ? [...new Set([...current.permissions, permission])]
        : current.permissions.filter((value) => value !== permission),
    }))
  }

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Benutzer</CardTitle>
            <CardDescription>
              Administratoren können neue Konten anlegen und vorhandene Berechtigungen verwalten.
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Benutzer anlegen
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingUser ? 'Benutzer bearbeiten' : 'Neues Benutzerkonto'}</DialogTitle>
                <DialogDescription>
                  Konten bestehen aus Benutzername, Passwort und den verfügbaren Rechten.
                </DialogDescription>
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
                    <Label htmlFor="user-name">Benutzername</Label>
                    <Input
                      id="user-name"
                      value={form.userName}
                      onChange={(event) => setForm((current) => ({ ...current, userName: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-password">{editingUser ? 'Neues Passwort' : 'Passwort'}</Label>
                    <Input
                      id="user-password"
                      type="password"
                      value={form.password}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                      placeholder={editingUser ? 'Optional' : 'Mindestens 8 Zeichen'}
                    />
                  </div>
                </div>

                <div className="grid gap-3 rounded-2xl border border-border/70 p-4 md:grid-cols-2">
                  <label className="flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={form.isAdministrator}
                      onCheckedChange={(checked) => setForm((current) => ({ ...current, isAdministrator: checked === true }))}
                    />
                    Administrator
                  </label>
                  <label className="flex items-center gap-3 text-sm">
                    <Checkbox
                      checked={form.isActive}
                      onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked === true }))}
                    />
                    Aktiv
                  </label>
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">Rechte</h3>
                    <p className="text-xs text-muted-foreground">Die Oberfläche zeigt nur erlaubte Bereiche an.</p>
                  </div>
                  <div className="grid gap-3 rounded-2xl border border-border/70 p-4 md:grid-cols-2">
                    {permissionOptions.map((permission) => (
                      <label key={permission.value} className="flex items-center gap-3 text-sm">
                        <Checkbox
                          checked={form.permissions.includes(permission.value)}
                          onCheckedChange={(checked) => togglePermission(permission.value, checked === true)}
                        />
                        {permission.label}
                      </label>
                    ))}
                  </div>
                </div>

                <Button className="w-full" type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Speichert ...' : 'Speichern'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {users.map((user) => (
            <Card key={user.id} className="border-border/70 bg-white/70">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{user.userName}</CardTitle>
                    <CardDescription>
                      {user.isAdministrator ? 'Administrator' : 'Benutzer'} · {user.isActive ? 'Aktiv' : 'Deaktiviert'}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                    <SquarePen className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {user.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                  >
                    {permissionLabels[permission] ?? permission}
                  </span>
                ))}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
