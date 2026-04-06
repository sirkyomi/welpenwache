export type Permission =
  | 'interns.view'
  | 'interns.manage'
  | 'teams.view'
  | 'teams.manage'

export type ThemePreference = 'system' | 'light' | 'dark'
export type LanguagePreference = 'de' | 'en'

export interface SetupStatusResponse {
  requiresSetup: boolean
}

export interface AuthUser {
  id: string
  userName: string
  isAdministrator: boolean
  isActive: boolean
  permissions: Permission[]
  languagePreference: LanguagePreference
  themePreference: ThemePreference
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
  supervisors: Supervisor[]
}

export interface Supervisor {
  id: string
  teamId: string
  name: string
  notes: string | null
}

export interface TeamAssignmentSummary {
  assignmentId: string
  internshipId: string
  internId: string
  internName: string
  supervisorId: string | null
  supervisorName: string | null
  startDate: string
  endDate: string
}

export interface TeamDetail extends Team {
  assignments: TeamAssignmentSummary[]
}

export interface Assignment {
  id: string
  teamId: string
  teamName: string
  teamColorHex: string
  supervisorId: string | null
  supervisorName: string | null
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

export interface ApplicationVersionResponse {
  version: string
}

export interface ApiErrorPayload {
  code?: string
  message?: string
  title?: string
}
