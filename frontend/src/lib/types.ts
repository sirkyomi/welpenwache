export type Permission =
  | 'interns.view'
  | 'interns.manage'
  | 'teams.view'
  | 'teams.manage'

export interface SetupStatusResponse {
  requiresSetup: boolean
}

export interface AuthUser {
  id: string
  userName: string
  isAdministrator: boolean
  isActive: boolean
  permissions: Permission[]
}

export interface AuthResponse {
  token: string
  expiresAtUtc: string
  user: AuthUser
}

export interface Team {
  id: string
  name: string
  description: string | null
  colorHex: string
  isArchived: boolean
}

export interface Assignment {
  id: string
  teamId: string
  teamName: string
  teamColorHex: string
  startDate: string
  endDate: string
}

export interface Internship {
  id: string
  startDate: string
  endDate: string
  note: string | null
  assignments: Assignment[]
}

export interface Intern {
  id: string
  firstName: string
  lastName: string
  fullName: string
  school: string | null
  notes: string | null
  internships: Internship[]
}

export interface CalendarDayEntry {
  internId: string
  internName: string
  internshipId: string
  teamId: string
  teamName: string
  teamColorHex: string
}

export interface CalendarDay {
  date: string
  entries: CalendarDayEntry[]
}

export interface CalendarMonth {
  year: number
  month: number
  days: CalendarDay[]
}

export interface ApiErrorPayload {
  code?: string
  message?: string
  title?: string
}
