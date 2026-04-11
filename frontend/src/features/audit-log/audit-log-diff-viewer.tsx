import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Minimize2 } from 'lucide-react'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/features/localization/language-provider'
import { useTheme } from '@/features/theme/theme-provider'

interface AuditLogDiffViewerProps {
  changes: unknown
}

export interface AuditLogDiffViewerHandle {
  openFullscreen: () => void
}

interface DiffEntry {
  path: string
  oldValue: unknown
  newValue: unknown
}

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return value
  }

  const looksLikeJson =
    (trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) ||
    (trimmedValue.startsWith('[') && trimmedValue.endsWith(']')) ||
    trimmedValue === 'null' ||
    trimmedValue === 'true' ||
    trimmedValue === 'false' ||
    /^-?\d+(\.\d+)?$/.test(trimmedValue)

  if (!looksLikeJson) {
    return value
  }

  try {
    return JSON.parse(trimmedValue) as unknown
  } catch {
    return value
  }
}

function getDiffLeaf(record: JsonRecord) {
  const hasOld = 'old' in record || 'oldValue' in record || 'before' in record
  const hasNew = 'new' in record || 'newValue' in record || 'after' in record

  if (!hasOld && !hasNew) {
    return null
  }

  return {
    hasOld,
    oldValue: record.old ?? record.oldValue ?? record.before,
    hasNew,
    newValue: record.new ?? record.newValue ?? record.after,
  }
}

function collectDiffEntries(value: unknown, currentPath = ''): DiffEntry[] {
  const parsedValue = parseMaybeJson(value)

  if (Array.isArray(parsedValue)) {
    return parsedValue.flatMap((entry) => {
      const parsedEntry = parseMaybeJson(entry)
      if (!isRecord(parsedEntry) || typeof parsedEntry.path !== 'string') {
        return []
      }

      return [
        {
          path: parsedEntry.path,
          oldValue: parseMaybeJson(parsedEntry.oldValue ?? parsedEntry.old ?? parsedEntry.before),
          newValue: parseMaybeJson(parsedEntry.newValue ?? parsedEntry.new ?? parsedEntry.after),
        },
      ]
    })
  }

  if (!isRecord(parsedValue)) {
    return []
  }

  const entries: DiffEntry[] = []

  for (const [key, childValue] of Object.entries(parsedValue)) {
    const nextPath = currentPath ? `${currentPath}.${key}` : key
    const parsedChildValue = parseMaybeJson(childValue)

    if (isRecord(parsedChildValue)) {
      const diffLeaf = getDiffLeaf(parsedChildValue)
      if (diffLeaf) {
        entries.push({
          path: nextPath,
          oldValue: diffLeaf.hasOld ? parseMaybeJson(diffLeaf.oldValue) : undefined,
          newValue: diffLeaf.hasNew ? parseMaybeJson(diffLeaf.newValue) : undefined,
        })
        continue
      }

      entries.push(...collectDiffEntries(parsedChildValue, nextPath))
      continue
    }

    entries.push({
      path: nextPath,
      oldValue: undefined,
      newValue: parsedChildValue,
    })
  }

  return entries
}

function extractRootSnapshots(value: unknown) {
  const parsedValue = parseMaybeJson(value)

  if (!isRecord(parsedValue)) {
    return null
  }

  const hasBeforeAfter = 'before' in parsedValue || 'after' in parsedValue
  const hasOldNew = 'old' in parsedValue || 'new' in parsedValue
  const hasOldValueNewValue = 'oldValue' in parsedValue || 'newValue' in parsedValue

  if (!hasBeforeAfter && !hasOldNew && !hasOldValueNewValue) {
    return null
  }

  return {
    beforeSnapshot: parseMaybeJson(parsedValue.before ?? parsedValue.old ?? parsedValue.oldValue) ?? {},
    afterSnapshot: parseMaybeJson(parsedValue.after ?? parsedValue.new ?? parsedValue.newValue) ?? {},
  }
}

function setNestedValue(target: JsonRecord, path: string, value: unknown) {
  const segments = path.split('.')
  let current: JsonRecord = target

  for (const [index, segment] of segments.entries()) {
    const isLastSegment = index === segments.length - 1

    if (isLastSegment) {
      current[segment] = value
      return
    }

    const existingValue = current[segment]
    if (!isRecord(existingValue)) {
      current[segment] = {}
    }

    current = current[segment] as JsonRecord
  }
}

function buildDiffSnapshots(entries: DiffEntry[]) {
  const beforeSnapshot: JsonRecord = {}
  const afterSnapshot: JsonRecord = {}

  for (const entry of entries) {
    if (entry.oldValue !== undefined) {
      setNestedValue(beforeSnapshot, entry.path, entry.oldValue)
    }

    if (entry.newValue !== undefined) {
      setNestedValue(afterSnapshot, entry.path, entry.newValue)
    }
  }

  return {
    beforeSnapshot,
    afterSnapshot,
  }
}

function normalizeDiffValue(value: unknown): string | Record<string, unknown> {
  if (isRecord(value)) {
    return value
  }

  if (Array.isArray(value)) {
    return { value }
  }

  if (value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const diffViewerStyles = {
  variables: {
    light: {
      diffViewerBackground: 'var(--color-card)',
      diffViewerTitleBackground: 'color-mix(in srgb, var(--color-muted) 72%, white 28%)',
      diffViewerTitleColor: 'var(--color-foreground)',
      diffViewerTitleBorderColor: 'var(--color-border)',
      diffViewerColor: 'var(--color-foreground)',
      gutterBackground: 'color-mix(in srgb, var(--color-muted) 86%, white 14%)',
      gutterBackgroundDark: 'color-mix(in srgb, var(--color-muted) 92%, var(--color-card) 8%)',
      gutterColor: 'var(--color-muted-foreground)',
      addedBackground: 'color-mix(in srgb, var(--color-accent) 74%, white 26%)',
      addedColor: 'var(--color-accent-foreground)',
      addedGutterBackground: 'color-mix(in srgb, var(--color-accent) 88%, var(--color-card) 12%)',
      addedGutterColor: 'var(--color-accent-foreground)',
      removedBackground: 'color-mix(in srgb, var(--color-destructive) 14%, white 86%)',
      removedColor: 'var(--color-foreground)',
      removedGutterBackground: 'color-mix(in srgb, var(--color-destructive) 22%, var(--color-card) 78%)',
      removedGutterColor: 'var(--color-destructive)',
      changedBackground: 'color-mix(in srgb, var(--color-secondary) 60%, white 40%)',
      wordAddedBackground: 'color-mix(in srgb, var(--color-accent) 92%, #ffffff 8%)',
      wordRemovedBackground: 'color-mix(in srgb, var(--color-destructive) 24%, #ffffff 76%)',
      highlightBackground: 'color-mix(in srgb, var(--color-primary) 12%, var(--color-card) 88%)',
      highlightGutterBackground: 'color-mix(in srgb, var(--color-primary) 18%, var(--color-card) 82%)',
      emptyLineBackground: 'color-mix(in srgb, var(--color-muted) 56%, white 44%)',
      codeFoldBackground: 'color-mix(in srgb, var(--color-muted) 72%, white 28%)',
      codeFoldGutterBackground: 'color-mix(in srgb, var(--color-muted) 82%, white 18%)',
      codeFoldContentColor: 'var(--color-muted-foreground)',
    },
    dark: {
      diffViewerBackground: 'color-mix(in srgb, var(--color-card) 92%, black 8%)',
      diffViewerTitleBackground: 'color-mix(in srgb, var(--color-muted) 64%, black 36%)',
      diffViewerTitleColor: 'var(--color-foreground)',
      diffViewerTitleBorderColor: 'var(--color-border)',
      diffViewerColor: 'var(--color-foreground)',
      gutterBackground: 'color-mix(in srgb, var(--color-muted) 76%, black 24%)',
      gutterBackgroundDark: 'color-mix(in srgb, var(--color-muted) 88%, black 12%)',
      gutterColor: 'var(--color-muted-foreground)',
      addedBackground: 'color-mix(in srgb, var(--color-accent) 46%, var(--color-card) 54%)',
      addedColor: 'var(--color-foreground)',
      addedGutterBackground: 'color-mix(in srgb, var(--color-accent) 58%, var(--color-card) 42%)',
      addedGutterColor: 'var(--color-accent-foreground)',
      removedBackground: 'color-mix(in srgb, var(--color-destructive) 24%, var(--color-card) 76%)',
      removedColor: 'var(--color-foreground)',
      removedGutterBackground: 'color-mix(in srgb, var(--color-destructive) 34%, var(--color-card) 66%)',
      removedGutterColor: '#ffc3bd',
      changedBackground: 'color-mix(in srgb, var(--color-secondary) 54%, var(--color-card) 46%)',
      wordAddedBackground: 'color-mix(in srgb, var(--color-accent) 72%, var(--color-card) 28%)',
      wordRemovedBackground: 'color-mix(in srgb, var(--color-destructive) 36%, var(--color-card) 64%)',
      highlightBackground: 'color-mix(in srgb, var(--color-primary) 24%, var(--color-card) 76%)',
      highlightGutterBackground: 'color-mix(in srgb, var(--color-primary) 28%, var(--color-card) 72%)',
      emptyLineBackground: 'color-mix(in srgb, var(--color-muted) 68%, black 32%)',
      codeFoldBackground: 'color-mix(in srgb, var(--color-muted) 72%, black 28%)',
      codeFoldGutterBackground: 'color-mix(in srgb, var(--color-muted) 82%, black 18%)',
      codeFoldContentColor: 'var(--color-muted-foreground)',
    },
  },
  diffContainer: {
    border: '1px solid var(--color-border)',
    borderRadius: '1rem',
    overflow: 'hidden',
    background: 'var(--color-card)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
  },
  titleBlock: {
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
    fontSize: '0.9rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  contentText: {
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
    fontSize: '1rem',
    lineHeight: 1.95,
    fontWeight: 700,
  },
  line: {
    minHeight: '2.8rem',
  },
  lineNumber: {
    minWidth: '4.2rem',
    fontSize: '0.94rem',
    fontWeight: 700,
  },
  marker: {
    fontWeight: 700,
    fontSize: '1rem',
  },
  gutter: {
    paddingInline: '0.75rem',
  },
  lineContent: {
    paddingInline: '1.1rem',
    paddingBlock: '0.45rem',
  },
  content: {
    fontVariantNumeric: 'tabular-nums',
  },
} as const

export const AuditLogDiffViewer = forwardRef<AuditLogDiffViewerHandle, AuditLogDiffViewerProps>(function AuditLogDiffViewer(
  { changes }: AuditLogDiffViewerProps,
  ref,
) {
  const { t } = useLanguage()
  const { resolvedTheme } = useTheme()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const parsedChanges = parseMaybeJson(changes)
  const rootSnapshots = extractRootSnapshots(parsedChanges)
  const diffEntries = collectDiffEntries(parsedChanges)
  const rawChanges =
    parsedChanges === null || parsedChanges === undefined
      ? null
      : typeof parsedChanges === 'string'
        ? parsedChanges
        : JSON.stringify(parsedChanges, null, 2)

  if (!rootSnapshots && diffEntries.length === 0) {
    if (!rawChanges) {
      return (
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
          {t('auditLog.noChanges')}
        </div>
      )
    }

    return (
      <Card className="border-border/70 bg-background/70">
        <CardHeader>
          <CardTitle className="text-base">{t('auditLog.rawChangesTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-2xl border border-border/70 bg-card/70 p-4 text-xs leading-6 text-muted-foreground">
            {rawChanges}
          </pre>
        </CardContent>
      </Card>
    )
  }

  const { beforeSnapshot, afterSnapshot } = rootSnapshots ?? buildDiffSnapshots(diffEntries)

  useEffect(() => {
    if (!isFullscreen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isFullscreen])

  useImperativeHandle(ref, () => ({
    openFullscreen: () => setIsFullscreen(true),
  }))

  const diffContent = (
    <ReactDiffViewer
      oldValue={normalizeDiffValue(beforeSnapshot)}
      newValue={normalizeDiffValue(afterSnapshot)}
      splitView
      compareMethod={DiffMethod.JSON}
      useDarkTheme={resolvedTheme === 'dark'}
      showDiffOnly
      extraLinesSurroundingDiff={2}
      hideSummary
      leftTitle={t('auditLog.previousValue')}
      rightTitle={t('auditLog.nextValue')}
      styles={diffViewerStyles}
    />
  )

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-sm">{diffContent}</div>

      {isFullscreen ? (
        <div
          className="fixed inset-0 z-[120] animate-in fade-in duration-200 bg-background/80 p-4 backdrop-blur sm:p-6"
          onClick={() => setIsFullscreen(false)}
        >
          <div
            className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-4 py-3 sm:px-5">
              <div>
                <p className="text-sm font-semibold text-foreground">{t('auditLog.diffTitle')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('auditLog.previousValue')} / {t('auditLog.nextValue')}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                aria-label="Exit fullscreen diff"
                onClick={() => setIsFullscreen(false)}
              >
                <Minimize2 className="h-4 w-4" />
                Schließen
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-4">{diffContent}</div>
          </div>
        </div>
      ) : null}
    </>
  )
})
