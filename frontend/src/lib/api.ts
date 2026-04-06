import type {
  ApplicationVersionResponse,
  ApiErrorPayload,
  AuthResponse,
  AuthUser,
  CalendarMonth,
  Intern,
  LanguagePreference,
  Permission,
  SetupStatusResponse,
  TeamDetail,
  Team,
  ThemePreference,
} from '@/lib/types'
import { apiBaseUrl } from '@/lib/base-path'
import { readStoredLanguagePreference } from '@/lib/language'

const API_URL = apiBaseUrl

export class ApiError extends Error {
  status: number
  payload?: ApiErrorPayload

  constructor(status: number, payload?: ApiErrorPayload) {
    super(
      payload?.message ??
        payload?.title ??
        (readStoredLanguagePreference() === 'en'
          ? 'The request could not be processed.'
          : 'Die Anfrage konnte nicht verarbeitet werden.'),
    )
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const languagePreference = readStoredLanguagePreference()

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(languagePreference ? { 'Accept-Language': languagePreference } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  const text = await response.text()
  const data = text ? (JSON.parse(text) as unknown) : undefined

  if (!response.ok) {
    throw new ApiError(response.status, (data as ApiErrorPayload | undefined) ?? undefined)
  }

  return data as T
}

export const api = {
  getApplicationVersion: () => request<ApplicationVersionResponse>('/api/version'),
  getSetupStatus: () => request<SetupStatusResponse>('/api/setup/status'),
  createInitialAdmin: (payload: { userName: string; password: string }) =>
    request<AuthResponse>('/api/setup/admin', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: { userName: string; password: string }) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  getMe: (token: string) => request<AuthUser>('/api/auth/me', undefined, token),
  updateLanguagePreference: (token: string, languagePreference: LanguagePreference) =>
    request<AuthUser>('/api/auth/language', { method: 'PUT', body: JSON.stringify({ languagePreference }) }, token),
  updateThemePreference: (token: string, themePreference: ThemePreference) =>
    request<AuthUser>('/api/auth/theme', { method: 'PUT', body: JSON.stringify({ themePreference }) }, token),
  getTeams: (token: string) => request<Team[]>('/api/teams', undefined, token),
  getTeam: (token: string, id: string) => request<TeamDetail>(`/api/teams/${id}`, undefined, token),
  createTeam: (
    token: string,
    payload: {
      name: string
      description: string | null
      colorHex: string
      isArchived: boolean
      supervisors: Array<{ id?: string; name: string; notes: string | null }>
    },
  ) => request<Team>('/api/teams', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateTeam: (
    token: string,
    id: string,
    payload: {
      name: string
      description: string | null
      colorHex: string
      isArchived: boolean
      supervisors: Array<{ id?: string; name: string; notes: string | null }>
    },
  ) => request<Team>(`/api/teams/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, token),
  getInterns: (token: string) => request<Intern[]>('/api/interns', undefined, token),
  getIntern: (token: string, id: string) => request<Intern>(`/api/interns/${id}`, undefined, token),
  createIntern: (
    token: string,
    payload: {
      firstName: string
      lastName: string
      school: string | null
      notes: string | null
      internships: Array<{
        startDate: string
        endDate: string
        note: string | null
        assignments: Array<{ teamId: string; supervisorId: string | null; startDate: string; endDate: string }>
      }>
    },
  ) => request<Intern>('/api/interns', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateIntern: (
    token: string,
    id: string,
    payload: {
      firstName: string
      lastName: string
      school: string | null
      notes: string | null
      internships: Array<{
        startDate: string
        endDate: string
        note: string | null
        assignments: Array<{ teamId: string; supervisorId: string | null; startDate: string; endDate: string }>
      }>
    },
  ) => request<Intern>(`/api/interns/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, token),
  deleteIntern: (token: string, id: string) =>
    request<void>(`/api/interns/${id}`, { method: 'DELETE' }, token),
  getCalendarMonth: (token: string, year: number, month: number) =>
    request<CalendarMonth>(`/api/calendar/month?year=${year}&month=${month}`, undefined, token),
  getUsers: (token: string) => request<AuthUser[]>('/api/users', undefined, token),
  createUser: (
    token: string,
    payload: {
      userName: string
      password: string
      isAdministrator: boolean
      isActive: boolean
      permissions: Permission[]
    },
  ) => request<AuthUser>('/api/users', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateUser: (
    token: string,
    id: string,
    payload: {
      userName: string
      isAdministrator: boolean
      isActive: boolean
      newPassword: string | null
      permissions: Permission[]
    },
  ) => request<AuthUser>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, token),
}
