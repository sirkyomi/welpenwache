import { useState } from 'react'
import { ShieldCheck, UserRoundCog } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/auth-provider'
import { ApiError } from '@/lib/api'

function AuthCard({
  icon,
  title,
  description,
  submitLabel,
  successMessage,
  onSubmit,
}: {
  icon: React.ReactNode
  title: string
  description: string
  submitLabel: string
  successMessage: string
  onSubmit: (userName: string, password: string) => Promise<void>
}) {
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)

    try {
      await onSubmit(userName, password)
      toast.success(successMessage)
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Die Aktion konnte nicht abgeschlossen werden.'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-border/70 bg-card/95 shadow-xl">
      <CardHeader className="space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="userName">Benutzername</Label>
            <Input
              id="userName"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              placeholder="z. B. admin"
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mindestens 8 Zeichen"
              autoComplete="current-password"
            />
          </div>
          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? 'Bitte warten ...' : submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function SetupScreen() {
  const { completeSetup } = useAuth()

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AuthCard
        icon={<UserRoundCog className="h-6 w-6" />}
        title="Ersteinrichtung"
        description="Lege den ersten Administrator für WelpenWache an."
        submitLabel="Administrator anlegen"
        successMessage="Administrator wurde angelegt."
        onSubmit={completeSetup}
      />
    </main>
  )
}

export function LoginScreen() {
  const { login } = useAuth()

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AuthCard
        icon={<ShieldCheck className="h-6 w-6" />}
        title="Anmelden"
        description="Melde dich mit deinem Benutzerkonto an."
        submitLabel="Einloggen"
        successMessage="Anmeldung erfolgreich."
        onSubmit={login}
      />
    </main>
  )
}
