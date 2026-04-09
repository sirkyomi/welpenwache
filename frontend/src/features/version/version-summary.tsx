import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, LogOut, Shield } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-provider'
import { useLanguage } from '@/features/localization/language-provider'
import { api } from '@/lib/api'
import type { Permission } from '@/lib/types'
import { cn } from '@/lib/utils'

function formatVersion(version: string | null | undefined, unavailableText: string) {
  if (!version) {
    return unavailableText
  }

  return version.startsWith('v') ? version : `v${version}`
}

export function SidebarVersion() {
  const { t } = useLanguage()
  const versionQuery = useQuery({
    queryKey: ['application-version'],
    queryFn: () => api.getApplicationVersion(),
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  })

  const version = versionQuery.data?.version ?? __APP_VERSION__

  return (
    <p className="px-3 text-center text-xs font-medium text-muted-foreground">
      {formatVersion(version, t('version.unavailableVersion'))}
    </p>
  )
}

export function VersionSummary() {
  const { logout, user } = useAuth()
  const { t } = useLanguage()
  const [permissionsOpen, setPermissionsOpen] = useState(false)
  const initials = (user?.userName ?? t('common.unknown')).slice(0, 2).toUpperCase()
  const permissionLabels: Record<Permission, string> = {
    'interns.view': t('users.permissionInternsView'),
    'interns.manage': t('users.permissionInternsManage'),
    'teams.view': t('users.permissionTeamsView'),
    'teams.manage': t('users.permissionTeamsManage'),
    'documents.view': t('users.permissionDocumentsView'),
    'documents.manage': t('users.permissionDocumentsManage'),
  }
  const permissionGroups = [
    {
      title: t('navigation.interns'),
      permissions: [
        { key: 'interns.view' as const, label: permissionLabels['interns.view'] },
        { key: 'interns.manage' as const, label: permissionLabels['interns.manage'] },
      ],
    },
    {
      title: t('navigation.teams'),
      permissions: [
        { key: 'teams.view' as const, label: permissionLabels['teams.view'] },
        { key: 'teams.manage' as const, label: permissionLabels['teams.manage'] },
      ],
    },
    {
      title: t('navigation.documentTemplates'),
      permissions: [
        { key: 'documents.view' as const, label: permissionLabels['documents.view'] },
        { key: 'documents.manage' as const, label: permissionLabels['documents.manage'] },
      ],
    },
  ]

  return (
    <section className="min-w-0 rounded-xl border border-border/70 bg-gradient-to-br from-card/90 to-card/60 p-3 shadow-[0_12px_30px_-18px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-sm font-black tracking-[0.14em] text-primary">
          {initials}
        </div>
        <div className="min-w-0 flex-1 self-center">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">{t('common.user')}</p>
          <p className="truncate text-sm font-semibold text-foreground">{user?.userName ?? t('common.unknown')}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setPermissionsOpen((current) => !current)}
          className="h-11 w-11 shrink-0 rounded-2xl border border-border/70 bg-background/60 text-muted-foreground hover:bg-background hover:text-foreground"
          aria-label={permissionsOpen ? 'Berechtigungen einklappen' : 'Berechtigungen ausklappen'}
        >
          {permissionsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>
      <div
        className={cn(
          'grid overflow-hidden transition-all duration-300 ease-out',
          permissionsOpen ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="min-h-0">
          <div className="space-y-2 rounded-2xl border border-border/70 bg-background/45 p-3">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              <span>{t('users.permissions')}</span>
            </div>
            {user?.isAdministrator ? (
              <div className="rounded-2xl border border-border/70 bg-background/60 px-3 py-2 text-xs font-semibold text-foreground">
                {t('users.administrator')}
              </div>
            ) : null}
            <div className="space-y-2">
              {permissionGroups.map((group) => (
                <div key={group.title} className="rounded-2xl border border-border/60 bg-background/35 px-3 py-2">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    {group.title}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.permissions.map((permission) => {
                      const enabled = Boolean(user?.isAdministrator || user?.permissions.includes(permission.key))

                      return (
                        <span
                          key={permission.key}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-xs font-medium',
                            enabled
                              ? 'border-border/70 bg-background/70 text-foreground'
                              : 'border-border/40 bg-background/30 text-muted-foreground line-through',
                          )}
                        >
                          {permission.label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 border-t border-border/70" />
      <Button
        variant="ghost"
        size="sm"
        onClick={logout}
        className="mt-3 w-full justify-start rounded-xl border border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/60 hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        {t('common.logout')}
      </Button>
    </section>
  )
}
