import { useQuery } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-provider'
import { useLanguage } from '@/features/localization/language-provider'
import { api } from '@/lib/api'

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

  return (
    <section className="min-w-0 rounded-[1.75rem] border border-border/70 bg-card/60 px-4 py-3 shadow-[0_12px_30px_-18px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">{t('version.label')}</p>
          <p className="truncate text-sm font-semibold text-foreground">{user?.userName ?? t('common.unknown')}</p>
        </div>

        <Button variant="outline" size="sm" onClick={logout} className="shrink-0 rounded-full">
          <LogOut className="h-4 w-4" />
          {t('common.logout')}
        </Button>
      </div>
    </section>
  )
}
