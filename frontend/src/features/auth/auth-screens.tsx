import { useState } from 'react'
import { Languages, ShieldCheck, UserRoundCog } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/auth-provider'
import { useLanguage } from '@/features/localization/language-provider'
import { ApiError } from '@/lib/api'
import type { LanguagePreference } from '@/lib/types'

function AuthLanguageSwitcher() {
  const { languagePreference, setLanguagePreference, t } = useLanguage()

  const handleLanguageChange = async (value: LanguagePreference) => {
    try {
      await setLanguagePreference(value)
      toast.success(t('common.settingsSaved'))
    } catch {
      toast.error(t('common.updateFailed'))
    }
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" aria-label={t('language.changeAria')}>
            <Languages className="h-4 w-4" />
            {languagePreference === 'en' ? t('language.shortEn') : t('language.shortDe')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t('language.title')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={languagePreference}
            onValueChange={(value) => void handleLanguageChange(value as LanguagePreference)}
          >
            <DropdownMenuRadioItem value="de">{t('language.german')}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="en">{t('language.english')}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

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
  const { t } = useLanguage()
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
      const message = error instanceof ApiError ? error.message : t('auth.actionFailed')
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
            <Label htmlFor="userName">{t('auth.username')}</Label>
            <Input
              id="userName"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              placeholder={t('auth.usernamePlaceholder')}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              autoComplete="current-password"
            />
          </div>
          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? t('auth.wait') : submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function SetupScreen() {
  const { completeSetup } = useAuth()
  const { t } = useLanguage()

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <AuthLanguageSwitcher />
        <AuthCard
          icon={<UserRoundCog className="h-6 w-6" />}
          title={t('auth.setupTitle')}
          description={t('auth.setupDescription')}
          submitLabel={t('auth.setupSubmit')}
          successMessage={t('auth.setupSuccess')}
          onSubmit={completeSetup}
        />
      </div>
    </main>
  )
}

export function LoginScreen() {
  const { login } = useAuth()
  const { t } = useLanguage()

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <AuthLanguageSwitcher />
        <AuthCard
          icon={<ShieldCheck className="h-6 w-6" />}
          title={t('auth.loginTitle')}
          description={t('auth.loginDescription')}
          submitLabel={t('auth.loginSubmit')}
          successMessage={t('auth.loginSuccess')}
          onSubmit={login}
        />
      </div>
    </main>
  )
}
