import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

export function formatGermanDate(value: string) {
  return format(parseISO(value), 'dd.MM.yyyy', { locale: de })
}

export function formatGermanDateRange(startDate: string, endDate: string) {
  return `${formatGermanDate(startDate)} bis ${formatGermanDate(endDate)}`
}
