import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import { de, enGB, type Locale } from 'date-fns/locale'

import { useAuth } from '@/features/auth/auth-provider'
import { translate } from '@/features/localization/translations'
import {
  getBrowserLanguagePreference,
  normalizeLanguagePreference,
  readStoredLanguagePreference,
  writeStoredLanguagePreference,
} from '@/lib/language'
import type { LanguagePreference } from '@/lib/types'

interface LanguageContextValue {
  languagePreference: LanguagePreference
  locale: Locale
  setLanguagePreference: (languagePreference: LanguagePreference) => Promise<void>
  t: (key: string, params?: Record<string, string | number>) => string
  formatDate: (value: string) => string
  formatDateRange: (startDate: string, endDate: string) => string
  formatMonthYear: (value: Date) => string
  formatWeekday: (value: Date) => string
  weekDayLabels: string[]
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function getDateLocale(languagePreference: LanguagePreference) {
  return languagePreference === 'en' ? enGB : de
}

function readLanguagePreference() {
  if (typeof window === 'undefined') {
    return 'de'
  }

  return readStoredLanguagePreference() ?? getBrowserLanguagePreference()
}

export function LanguageProvider({ children }: PropsWithChildren) {
  const { token, updateLanguagePreference, user } = useAuth()
  const [fallbackLanguagePreference, setFallbackLanguagePreference] =
    useState<LanguagePreference>(readLanguagePreference)

  const languagePreference = normalizeLanguagePreference(user?.languagePreference ?? fallbackLanguagePreference)
  const locale = getDateLocale(languagePreference)

  useEffect(() => {
    writeStoredLanguagePreference(languagePreference)
    setFallbackLanguagePreference(languagePreference)
  }, [languagePreference])

  const weekDayLabels = useMemo(() => {
    const start = startOfWeek(new Date(2026, 0, 5), {
      locale,
      weekStartsOn: 1,
    })

    return Array.from({ length: 7 }, (_, index) => format(addDays(start, index), 'EEE', { locale }))
  }, [locale])

  const value = useMemo<LanguageContextValue>(
    () => ({
      languagePreference,
      locale,
      setLanguagePreference: async (nextLanguagePreference) => {
        const previousLanguagePreference = languagePreference
        setFallbackLanguagePreference(nextLanguagePreference)
        writeStoredLanguagePreference(nextLanguagePreference)

        if (!token) {
          return
        }

        try {
          await updateLanguagePreference(nextLanguagePreference)
        } catch (error) {
          setFallbackLanguagePreference(previousLanguagePreference)
          writeStoredLanguagePreference(previousLanguagePreference)
          throw error
        }
      },
      t: (key, params) => translate(languagePreference, key, params),
      formatDate: (value) => format(parseISO(value), 'P', { locale }),
      formatDateRange: (startDate, endDate) =>
        `${format(parseISO(startDate), 'P', { locale })} ${translate(languagePreference, 'common.to')} ${format(parseISO(endDate), 'P', { locale })}`,
      formatMonthYear: (value) => format(value, 'MMMM yyyy', { locale }),
      formatWeekday: (value) => format(value, 'EEE', { locale }),
      weekDayLabels,
    }),
    [languagePreference, locale, token, updateLanguagePreference, weekDayLabels],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }

  return context
}
