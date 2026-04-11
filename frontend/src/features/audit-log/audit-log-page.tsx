import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { Expand } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/features/auth/auth-provider'
import { AuditLogDiffViewer, type AuditLogDiffViewerHandle } from '@/features/audit-log/audit-log-diff-viewer'
import { useLanguage } from '@/features/localization/language-provider'
import { ApiError, api } from '@/lib/api'
import type { AuditLogAction } from '@/lib/types'
import { cn } from '@/lib/utils'

interface AuditLogFilters {
  entityType: string
  action: string
  user: string
  from: string
  to: string
}

const initialFilters: AuditLogFilters = {
  entityType: 'all',
  action: 'all',
  user: '',
  from: '',
  to: '',
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

function getActionLabel(action: AuditLogAction, t: (key: string) => string) {
  switch (action) {
    case 'create':
      return t('auditLog.actions.create')
    case 'update':
      return t('auditLog.actions.update')
    case 'delete':
      return t('auditLog.actions.delete')
    default:
      return action
  }
}

function getEntityTypeLabel(entityType: string, t: (key: string) => string) {
  const translationKey = `auditLog.entityTypes.${entityType}`
  const translatedLabel = t(translationKey)

  return translatedLabel === translationKey ? entityType : translatedLabel
}

function getActionBadgeVariant(action: AuditLogAction): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (action) {
    case 'create':
      return 'default'
    case 'delete':
      return 'destructive'
    case 'update':
      return 'secondary'
    default:
      return 'outline'
  }
}

function matchesDateRange(timestampUtc: string, from: string, to: string) {
  const timestamp = new Date(timestampUtc)
  if (Number.isNaN(timestamp.getTime())) {
    return false
  }

  if (from) {
    const start = new Date(`${from}T00:00:00`)
    if (timestamp < start) {
      return false
    }
  }

  if (to) {
    const end = new Date(`${to}T23:59:59.999`)
    if (timestamp > end) {
      return false
    }
  }

  return true
}

export function AuditLogPage() {
  const { token } = useAuth()
  const { languagePreference, t } = useLanguage()
  const diffViewerRef = useRef<AuditLogDiffViewerHandle | null>(null)
  const [filters, setFilters] = useState<AuditLogFilters>(initialFilters)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const deferredUserFilter = useDeferredValue(filters.user)
  const locale = languagePreference === 'en' ? 'en-GB' : 'de-DE'

  const auditLogQuery = useQuery({
    queryKey: ['audit-log', filters],
    queryFn: () =>
      api.getAuditLogs(token!, {
        entityType: filters.entityType !== 'all' ? filters.entityType : undefined,
        action: filters.action !== 'all' ? filters.action : undefined,
        user: filters.user.trim() || undefined,
        fromUtc: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : undefined,
        toUtc: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined,
      }),
    enabled: Boolean(token),
  })

  const allEntries = useMemo(() => auditLogQuery.data ?? [], [auditLogQuery.data])
  const collator = useMemo(
    () => new Intl.Collator(locale, { numeric: true, sensitivity: 'base' }),
    [locale],
  )
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale],
  )

  const entityTypes = useMemo(
    () =>
      Array.from(new Set(allEntries.map((entry) => entry.entityType).filter(Boolean))).sort(collator.compare),
    [allEntries, collator],
  )

  const actions = useMemo(() => {
    const discoveredActions = Array.from(new Set(allEntries.map((entry) => entry.action).filter(Boolean)))
    const knownActions: AuditLogAction[] = ['create', 'update', 'delete']
    const knownActionSet = new Set(knownActions)

    return [
      ...knownActions.filter((action) => discoveredActions.includes(action)),
      ...discoveredActions.filter((action) => !knownActionSet.has(action)).sort(collator.compare),
    ]
  }, [allEntries, collator])

  const visibleEntries = useMemo(() => {
    const normalizedUserFilter = normalizeSearchText(deferredUserFilter, locale)

    return allEntries.filter((entry) => {
      if (normalizedUserFilter) {
        const userText = normalizeSearchText(
          [entry.userName, entry.userId].filter((value): value is string => Boolean(value)).join(' '),
          locale,
        )
        if (!userText.includes(normalizedUserFilter)) {
          return false
        }
      }
      return matchesDateRange(entry.timestampUtc, filters.from, filters.to)
    })
  }, [allEntries, deferredUserFilter, filters.from, filters.to, locale])

  const resolvedSelectedEntryId = useMemo(() => {
    if (visibleEntries.length === 0) {
      return null
    }

    return selectedEntryId && visibleEntries.some((entry) => entry.id === selectedEntryId)
      ? selectedEntryId
      : visibleEntries[0].id
  }, [selectedEntryId, visibleEntries])

  const auditLogDetailQuery = useQuery({
    queryKey: ['audit-log', 'detail', resolvedSelectedEntryId],
    queryFn: () => api.getAuditLog(token!, resolvedSelectedEntryId!),
    enabled: Boolean(token && resolvedSelectedEntryId),
  })

  const selectedEntry = useMemo(
    () => visibleEntries.find((entry) => entry.id === resolvedSelectedEntryId) ?? null,
    [resolvedSelectedEntryId, visibleEntries],
  )

  const selectedDetail = auditLogDetailQuery.data ?? null
  const selectedMetadata = selectedDetail?.metadata

  const resetFilters = () => {
    setFilters(initialFilters)
  }

  const formatTimestamp = (value: string) => {
    const timestamp = new Date(value)
    if (Number.isNaN(timestamp.getTime())) {
      return value
    }

    return dateTimeFormatter.format(timestamp)
  }

  return (
    <section className="flex h-full min-h-0 flex-col space-y-6">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>{t('auditLog.title')}</CardTitle>
          <CardDescription>{t('auditLog.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col space-y-6 overflow-hidden">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(180px,0.9fr)_minmax(180px,0.9fr)_minmax(160px,0.8fr)_minmax(160px,0.8fr)_auto]">
            <div className="space-y-2">
              <Label htmlFor="audit-log-user-filter">{t('auditLog.userFilter')}</Label>
              <Input
                id="audit-log-user-filter"
                value={filters.user}
                onChange={(event) => setFilters((current) => ({ ...current, user: event.target.value }))}
                placeholder={t('auditLog.userPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('auditLog.entityTypeFilter')}</Label>
              <Select
                value={filters.entityType}
                onValueChange={(value) => setFilters((current) => ({ ...current, entityType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  {entityTypes.map((entityType) => (
                    <SelectItem key={entityType} value={entityType}>
                      {getEntityTypeLabel(entityType, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('auditLog.actionFilter')}</Label>
              <Select
                value={filters.action}
                onValueChange={(value) => setFilters((current) => ({ ...current, action: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  {actions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {getActionLabel(action, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-log-from">{t('auditLog.dateFrom')}</Label>
              <Input
                id="audit-log-from"
                type="date"
                value={filters.from}
                onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-log-to">{t('auditLog.dateTo')}</Label>
              <Input
                id="audit-log-to"
                type="date"
                value={filters.to}
                onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
              />
            </div>

            <div className="flex items-end">
              <Button type="button" variant="outline" className="w-full xl:w-auto" onClick={resetFilters}>
                {t('auditLog.resetFilters')}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{t('auditLog.visibleCount', { count: visibleEntries.length })}</Badge>
            <Badge variant="outline">{t('auditLog.totalCount', { count: allEntries.length })}</Badge>
          </div>

          {auditLogQuery.isPending ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-5 text-sm text-muted-foreground">
              {t('auditLog.loading')}
            </div>
          ) : null}

          {auditLogQuery.isError ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-5 text-sm text-muted-foreground">
              {auditLogQuery.error instanceof ApiError ? auditLogQuery.error.message : t('auditLog.loadFailed')}
            </div>
          ) : null}

          {!auditLogQuery.isPending && !auditLogQuery.isError && visibleEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-5 text-sm text-muted-foreground">
              {allEntries.length === 0 ? t('auditLog.empty') : t('auditLog.noFilterResults')}
            </div>
          ) : null}

          {!auditLogQuery.isPending && !auditLogQuery.isError && visibleEntries.length > 0 ? (
            <div className="grid min-h-0 flex-1 gap-6 overflow-hidden xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,2.05fr)]">
              <Card className="border-border/70 bg-card/80 xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-base">{t('auditLog.listTitle')}</CardTitle>
                  <CardDescription>{t('auditLog.listDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('auditLog.tableTimestamp')}</TableHead>
                        <TableHead>{t('auditLog.tableAction')}</TableHead>
                        <TableHead>{t('auditLog.tableReference')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleEntries.map((entry) => {
                        const isSelected = entry.id === resolvedSelectedEntryId
                        const primaryReference = entry.entityDisplayName || entry.entityId || t('common.notAvailable')

                        return (
                          <TableRow
                            key={entry.id}
                            data-state={isSelected ? 'selected' : undefined}
                            tabIndex={0}
                            role="button"
                            className={cn('cursor-pointer', isSelected ? 'bg-muted/60' : '')}
                            onClick={() => setSelectedEntryId(entry.id)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                setSelectedEntryId(entry.id)
                              }
                            }}
                          >
                            <TableCell className="whitespace-nowrap align-top">{formatTimestamp(entry.timestampUtc)}</TableCell>
                            <TableCell>
                              <Badge variant={getActionBadgeVariant(entry.action)}>{getActionLabel(entry.action, t)}</Badge>
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="space-y-1">
                                <p className="font-medium">{primaryReference}</p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span>{getEntityTypeLabel(entry.entityType, t)}</span>
                                  {entry.userName || entry.userId ? <span>|</span> : null}
                                  {entry.userName || entry.userId ? (
                                    <span>{t('auditLog.changedByInline', { name: entry.userName || entry.userId || t('common.unknown') })}</span>
                                  ) : null}
                                </div>
                                {entry.entityDisplayName && entry.entityId ? (
                                  <p className="text-xs text-muted-foreground line-clamp-1">{entry.entityId}</p>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/85 xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden">
                <CardHeader className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{t('auditLog.detailsTitle')}</CardTitle>
                      <CardDescription>
                        {selectedEntry ? formatTimestamp(selectedEntry.timestampUtc) : t('auditLog.noSelection')}
                      </CardDescription>
                    </div>
                    {selectedEntry ? (
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={getActionBadgeVariant(selectedEntry.action)}>
                          {getActionLabel(selectedEntry.action, t)}
                        </Badge>
                        <Badge variant="outline">{getEntityTypeLabel(selectedEntry.entityType, t)}</Badge>
                        <Badge variant="outline">{selectedEntry.userName || selectedEntry.userId || t('common.unknown')}</Badge>
                        <Badge variant="outline">{t('auditLog.changeCountBadge', { count: selectedEntry.changeCount })}</Badge>
                      </div>
                    ) : null}
                  </div>

                  {selectedEntry ? (
                    <div className="grid gap-3 rounded-2xl border border-border/70 bg-background/60 p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="font-medium">{t('auditLog.objectLabel')}</p>
                        <p className="text-muted-foreground">
                          {selectedEntry.entityDisplayName || selectedEntry.entityId || t('common.notAvailable')}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium">{t('auditLog.objectIdLabel')}</p>
                        <p className="break-words text-muted-foreground">{selectedEntry.entityId || t('common.notAvailable')}</p>
                      </div>
                      <div>
                        <p className="font-medium">{t('auditLog.changedByLabel')}</p>
                        <p className="text-muted-foreground">
                          {selectedEntry.userName || selectedEntry.userId || t('common.unknown')}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium">{t('auditLog.timestampLabel')}</p>
                        <p className="text-muted-foreground">{formatTimestamp(selectedEntry.timestampUtc)}</p>
                      </div>
                    </div>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-6 xl:min-h-0 xl:flex-1 xl:overflow-hidden">
                  {selectedEntry ? (
                    <>
                      {auditLogDetailQuery.isPending ? (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-5 text-sm text-muted-foreground">
                          {t('auditLog.detailsLoading')}
                        </div>
                      ) : null}

                      {auditLogDetailQuery.isError ? (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-5 text-sm text-muted-foreground">
                          {auditLogDetailQuery.error instanceof ApiError ? auditLogDetailQuery.error.message : t('auditLog.loadDetailsFailed')}
                        </div>
                      ) : null}

                      <div className="space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold">{t('auditLog.diffTitle')}</h3>
                            <p className="text-sm text-muted-foreground">{t('auditLog.diffDescription')}</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => diffViewerRef.current?.openFullscreen()}
                          >
                            <Expand className="h-4 w-4" />
                            Vollbild
                          </Button>
                        </div>
                        {selectedMetadata ? (
                          <AuditLogDiffViewer ref={diffViewerRef} changes={selectedMetadata} />
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                            {t('auditLog.noChanges')}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-5 text-sm text-muted-foreground">
                      {t('auditLog.noSelection')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}


