import { format, isValid, parse, startOfMonth } from 'date-fns'

const CALENDAR_MONTH_PARAM = 'month'
const CALENDAR_RETURN_TO_PARAM = 'returnTo'

export function parseCalendarMonth(value: string | null) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return null
  }

  const parsedMonth = parse(`${value}-01`, 'yyyy-MM-dd', new Date())
  return isValid(parsedMonth) ? startOfMonth(parsedMonth) : null
}

export function formatCalendarMonth(month: Date) {
  return format(startOfMonth(month), 'yyyy-MM')
}

export function readCalendarMonth(searchParams: URLSearchParams) {
  return parseCalendarMonth(searchParams.get(CALENDAR_MONTH_PARAM))
}

export function writeCalendarMonth(searchParams: URLSearchParams, month: Date) {
  const nextSearchParams = new URLSearchParams(searchParams)
  nextSearchParams.set(CALENDAR_MONTH_PARAM, formatCalendarMonth(month))
  return nextSearchParams
}

export function buildCalendarReturnTo(month: Date) {
  const searchParams = new URLSearchParams({
    [CALENDAR_MONTH_PARAM]: formatCalendarMonth(month),
  })

  return `/?${searchParams.toString()}`
}

export function buildCalendarReturnTarget(pathname: string, search: string) {
  const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`

  if (!search || search === '?') {
    return normalizedPathname
  }

  return `${normalizedPathname}${search.startsWith('?') ? search : `?${search}`}`
}

export function appendReturnTo(pathname: string, returnTo: string | null, params?: URLSearchParams) {
  const nextSearchParams = new URLSearchParams(params)

  if (returnTo) {
    nextSearchParams.set(CALENDAR_RETURN_TO_PARAM, returnTo)
  }

  const search = nextSearchParams.toString()
  return search ? `${pathname}?${search}` : pathname
}

export function parseCalendarReturnTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null
  }

  return value
}

export function readCalendarReturnTo(searchParams: URLSearchParams) {
  return parseCalendarReturnTo(searchParams.get(CALENDAR_RETURN_TO_PARAM))
}
