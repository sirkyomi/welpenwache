import { useMemo, useState } from 'react'
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
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useQueries } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/auth-provider'
import { useLanguage } from '@/features/localization/language-provider'
import { api } from '@/lib/api'
import type { CalendarDayEntry } from '@/lib/types'
import { cn } from '@/lib/utils'

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

export function CalendarPage() {
  const { token } = useAuth()
  const { formatMonthYear, formatWeekday, languagePreference, t, weekDayLabels } = useLanguage()
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const gridDays = useMemo(() => buildCalendarGrid(currentMonth), [currentMonth])

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

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t('calendar.title')}</CardTitle>
            <CardDescription>{t('calendar.description')}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth((value) => subMonths(value, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-44 text-center text-sm font-semibold">{formatMonthYear(currentMonth)}</div>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth((value) => addMonths(value, 1))}>
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
            {gridDays.map((date) => {
              const isoDate = format(date, 'yyyy-MM-dd')
              const entries = dayLookup.get(isoDate) ?? []
              const isWeekend = isSaturday(date) || isSunday(date)
              const isMutedDay = isWeekend || !isSameMonth(date, currentMonth)

              return (
                <div
                  key={isoDate}
                  className={cn(
                    'min-h-40 rounded-2xl border border-border/80 bg-card/80 p-3 shadow-sm',
                    isMutedDay && 'opacity-45',
                    isToday(date) && 'border-primary ring-2 ring-primary/20',
                  )}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold">{format(date, languagePreference === 'en' ? 'd' : 'd.')}</div>
                    <div className="text-xs text-muted-foreground">{formatWeekday(date)}</div>
                  </div>

                  <div className="space-y-2">
                    {entries.length === 0 ? (
                      <div className="rounded-xl bg-muted/70 px-2 py-2 text-xs text-muted-foreground">
                        {t('calendar.noAssignments')}
                      </div>
                    ) : (
                      entries.map((entry) => (
                        <Link
                          key={`${entry.internshipId}-${entry.teamId}`}
                          to={`/praktikanten/${entry.internId}`}
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
  )
}
