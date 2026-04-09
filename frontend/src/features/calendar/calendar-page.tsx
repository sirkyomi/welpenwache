import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSaturday,
  isSameMonth,
  isSunday,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useQueries } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/auth-provider'
import { CalendarCreateInternDialog } from '@/features/calendar/calendar-create-intern-dialog'
import { appendReturnTo, formatCalendarMonth, parseCalendarMonth } from '@/features/calendar/calendar-navigation'
import { useLanguage } from '@/features/localization/language-provider'
import { useTheme } from '@/features/theme/theme-provider'
import { api } from '@/lib/api'
import type { CalendarDayEntry } from '@/lib/types'
import { cn } from '@/lib/utils'

interface CalendarRangeSelection {
  anchorDate: string
  currentDate: string
}

function buildCalendarGrid(currentMonth: Date) {
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    days.push(cursor)
  }

  return days
}

function normalizeRange(selection: CalendarRangeSelection) {
  return selection.anchorDate <= selection.currentDate
    ? { startDate: selection.anchorDate, endDate: selection.currentDate }
    : { startDate: selection.currentDate, endDate: selection.anchorDate }
}

export function CalendarPage() {
  const { hasPermission, token } = useAuth()
  const { formatMonthYear, formatWeekday, languagePreference, t, weekDayLabels } = useLanguage()
  const { resolvedTheme } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const [hoveredCreateDate, setHoveredCreateDate] = useState<string | null>(null)
  const [rangeSelection, setRangeSelection] = useState<CalendarRangeSelection | null>(null)
  const [pendingCreateRange, setPendingCreateRange] = useState<{ startDate: string; endDate?: string } | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const dragPointerIdRef = useRef<number | null>(null)
  const selectionMovedRef = useRef(false)
  const currentMonth = parseCalendarMonth(searchParams.get('month')) ?? startOfMonth(new Date())
  const gridDays = useMemo(() => buildCalendarGrid(currentMonth), [currentMonth])
  const canManageInterns = hasPermission('interns.manage')
  const calendarReturnTo = `/?month=${formatCalendarMonth(currentMonth)}`
  const todayMonth = startOfMonth(new Date())
  const isDisplayingTodayMonth = isSameMonth(currentMonth, todayMonth)

  const setDisplayedMonth = (month: Date) => {
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('month', formatCalendarMonth(month))
    setSearchParams(nextSearchParams)
  }

  const visibleMonths = useMemo(() => {
    const months = new Map<string, { year: number; month: number }>()

    for (const date of gridDays) {
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const key = `${year}-${month}`

      if (!months.has(key)) {
        months.set(key, { year, month })
      }
    }

    return [...months.values()]
  }, [gridDays])

  const calendarQueries = useQueries({
    queries: visibleMonths.map(({ year, month }) => ({
      queryKey: ['calendar', year, month],
      queryFn: () => api.getCalendarMonth(token!, year, month),
      enabled: Boolean(token),
    })),
  })

  const dayLookup = useMemo(() => {
    const days = new Map<string, CalendarDayEntry[]>()

    for (const query of calendarQueries) {
      for (const day of query.data?.days ?? []) {
        days.set(day.date, day.entries)
      }
    }

    return days
  }, [calendarQueries])

  const activeRange = useMemo(() => (rangeSelection ? normalizeRange(rangeSelection) : null), [rangeSelection])

  const finishRangeSelection = useEffectEvent(() => {
    if (!rangeSelection) {
      return
    }

    const normalizedRange = normalizeRange(rangeSelection)
    setPendingCreateRange(
      selectionMovedRef.current
        ? normalizedRange
        : {
            startDate: normalizedRange.startDate,
          },
    )
    setCreateDialogOpen(true)
    setRangeSelection(null)
    setHoveredCreateDate(null)
    dragPointerIdRef.current = null
    selectionMovedRef.current = false
  })

  useEffect(() => {
    if (!rangeSelection) {
      return
    }

    const previousUserSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ew-resize'
    window.getSelection()?.removeAllRanges()

    const handlePointerUp = () => {
      finishRangeSelection()
    }

    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      document.body.style.userSelect = previousUserSelect
      document.body.style.cursor = previousCursor
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [finishRangeSelection, rangeSelection])

  return (
    <>
      <section className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t('calendar.title')}</CardTitle>
              <CardDescription>{t('calendar.description')}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDisplayedMonth(todayMonth)}
                disabled={isDisplayingTodayMonth}
              >
                {languagePreference === 'en' ? 'Today' : 'Heute'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDisplayedMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-44 text-center text-sm font-semibold">{formatMonthYear(currentMonth)}</div>
              <Button variant="outline" size="sm" onClick={() => setDisplayedMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-7 gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {weekDayLabels.map((day) => (
                <div key={day} className="px-2 py-1">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
              {gridDays.map((date, index) => {
                const isoDate = format(date, 'yyyy-MM-dd')
                const entries = dayLookup.get(isoDate) ?? []
                const isWeekend = isSaturday(date) || isSunday(date)
                const isMutedDay = isWeekend || !isSameMonth(date, currentMonth)
                const isRangeSelected = Boolean(activeRange && isoDate >= activeRange.startDate && isoDate <= activeRange.endDate)
                const isHoverPreview = !rangeSelection && hoveredCreateDate === isoDate
                const connectLeft = Boolean(
                  activeRange &&
                    isRangeSelected &&
                    index % 7 !== 0 &&
                    gridDays[index - 1] &&
                    format(gridDays[index - 1], 'yyyy-MM-dd') >= activeRange.startDate &&
                    format(gridDays[index - 1], 'yyyy-MM-dd') <= activeRange.endDate,
                )
                const connectRight = Boolean(
                  activeRange &&
                    isRangeSelected &&
                    index % 7 !== 6 &&
                    gridDays[index + 1] &&
                    format(gridDays[index + 1], 'yyyy-MM-dd') >= activeRange.startDate &&
                    format(gridDays[index + 1], 'yyyy-MM-dd') <= activeRange.endDate,
                )

                return (
                  <div
                    key={isoDate}
                    className={cn(
                      'group/day relative min-h-44 select-none rounded-2xl border border-border/80 bg-card/80 p-3 pb-[3.75rem] shadow-sm',
                      canManageInterns && !rangeSelection && 'cursor-pointer',
                      (isRangeSelected || isHoverPreview) && 'z-20',
                      isMutedDay && 'opacity-45',
                      isToday(date) && 'border-primary ring-2 ring-primary/20',
                    )}
                    onPointerEnter={() => {
                      if (canManageInterns) {
                        setHoveredCreateDate(isoDate)

                        if (rangeSelection) {
                          setRangeSelection((current) =>
                            current
                              ? {
                                  ...current,
                                  currentDate: isoDate,
                                }
                              : current,
                          )
                          if (rangeSelection.anchorDate !== isoDate) {
                            selectionMovedRef.current = true
                          }
                        }
                      }
                    }}
                    onPointerLeave={() => {
                      if (canManageInterns && !rangeSelection) {
                        setHoveredCreateDate((current) => (current === isoDate ? null : current))
                      }
                    }}
                    onPointerDown={(event) => {
                      if (!canManageInterns) {
                        return
                      }

                      const target = event.target as HTMLElement
                      if (target.closest('a')) {
                        return
                      }

                      event.preventDefault()
                      selectionMovedRef.current = false
                      dragPointerIdRef.current = event.pointerId
                      setRangeSelection({
                        anchorDate: isoDate,
                        currentDate: isoDate,
                      })
                      setHoveredCreateDate(isoDate)
                    }}
                  >
                    {canManageInterns ? (
                      <div
                        className={cn(
                          'pointer-events-none absolute bottom-4 z-20 h-7 transition-opacity duration-150',
                          isRangeSelected || isHoverPreview ? 'opacity-100' : 'opacity-0 group-hover/day:opacity-100',
                          isRangeSelected && connectLeft ? '-left-[0.32rem]' : 'left-3',
                          isRangeSelected && connectRight ? '-right-[0.32rem]' : 'right-3',
                        )}
                      >
                        <div
                          className={cn(
                            'absolute inset-0 border border-[#d39a5f]/60 bg-[#d39a5f]/16 transition-all duration-150',
                            isRangeSelected
                              ? cn(
                                  connectLeft ? 'rounded-l-none border-l-0' : 'rounded-l-lg',
                                  connectRight ? 'rounded-r-none border-r-0' : 'rounded-r-lg',
                                )
                              : 'rounded-lg',
                          )}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Plus
                            className={cn('h-4 w-4', isRangeSelected ? 'opacity-0' : undefined)}
                            style={{ color: resolvedTheme === 'dark' ? '#f8ead7' : '#7a3f12' }}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{format(date, languagePreference === 'en' ? 'd' : 'd.')}</div>
                      <div className="text-xs text-muted-foreground">{formatWeekday(date)}</div>
                    </div>

                    <div className="relative z-10 space-y-2">
                      {entries.length === 0 ? (
                        <div className="rounded-xl bg-muted/70 px-2 py-2 text-xs text-muted-foreground">
                          {t('calendar.noAssignments')}
                        </div>
                      ) : (
                        entries.map((entry) => (
                          <Link
                            key={`${entry.internshipId}-${entry.teamId}`}
                            to={appendReturnTo(`/praktikanten/${entry.internId}`, calendarReturnTo)}
                            className="block rounded-2xl border px-2.5 py-2.5 text-xs shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30"
                            style={{
                              backgroundColor: `${entry.teamColorHex}1A`,
                              borderColor: `${entry.teamColorHex}55`,
                            }}
                          >
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <div
                                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/40 bg-background/55 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                                style={{ color: entry.teamColorHex }}
                              >
                                <span
                                  className="h-1.5 w-1.5 flex-none rounded-full"
                                  style={{ backgroundColor: entry.teamColorHex }}
                                />
                                <span className="truncate">{entry.teamName}</span>
                              </div>
                            </div>
                            <div className="text-sm font-semibold leading-tight text-foreground">{entry.internName}</div>
                            {entry.supervisorName ? (
                              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="font-medium">{t('interns.supervisor')}:</span>
                                <span className="truncate">{entry.supervisorName}</span>
                              </div>
                            ) : null}
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      <CalendarCreateInternDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open)
          if (!open) {
            setPendingCreateRange(null)
          }
        }}
        initialRange={pendingCreateRange}
      />
    </>
  )
}
