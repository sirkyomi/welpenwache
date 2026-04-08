import type {
  ApplicationVersionResponse,
  ApiErrorPayload,
  AuthResponse,
  AuthUser,
  CalendarMonth,
  DocumentTemplate,
  DocumentTemplatePurpose,
  Gender,
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

interface DownloadResponse {
  blob: Blob
  fileName: string | null
}

function buildHeaders(init?: RequestInit, token?: string) {
  const languagePreference = readStoredLanguagePreference()
  const headers = new Headers(init?.headers)

  if (languagePreference && !headers.has('Accept-Language')) {
    headers.set('Accept-Language', languagePreference)
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return headers
}

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: buildHeaders(init, token),
  })

  const text = await response.text()
  const data = parseResponseText(text)

  if (!response.ok) {
    throw new ApiError(response.status, (data as ApiErrorPayload | undefined) ?? undefined)
  }

  return data as T
}

async function requestDownload(path: string, init?: RequestInit, token?: string): Promise<DownloadResponse> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: buildHeaders(init, token),
  })

  if (!response.ok) {
    const text = await response.text()
    const data = parseResponseText(text)
    throw new ApiError(response.status, (data as ApiErrorPayload | undefined) ?? undefined)
  }

  const blob = await response.blob()
  const fileName = extractFileName(response.headers.get('Content-Disposition'))
  return { blob, fileName }
}

function extractFileName(contentDisposition: string | null) {
  if (!contentDisposition) {
    return null
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match) {
    return decodeURIComponent(utf8Match[1])
  }

  const fallbackMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  return fallbackMatch?.[1] ?? null
}

function parseResponseText(text: string) {
  if (!text) {
    return undefined
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
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
      gender: Gender
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
      gender: Gender
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
  generateCompletionDocuments: (token: string, internId: string) =>
    requestDownload(`/api/interns/${internId}/completion-documents`, { method: 'POST' }, token),
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
  getDocumentTemplates: (token: string) =>
    request<DocumentTemplate[]>('/api/document-templates', undefined, token),
  createDocumentTemplate: (
    token: string,
    payload: {
      name: string
      purpose: DocumentTemplatePurpose
      language: LanguagePreference
      isActive: boolean
      file: File
    },
  ) => {
    const formData = new FormData()
    formData.set('name', payload.name)
    formData.set('purpose', payload.purpose)
    formData.set('language', payload.language)
    formData.set('isActive', String(payload.isActive))
    formData.set('file', payload.file)

    return request<DocumentTemplate>('/api/document-templates', { method: 'POST', body: formData }, token)
  },
  updateDocumentTemplate: (
    token: string,
    id: string,
    payload: {
      name: string
      purpose: DocumentTemplatePurpose
      language: LanguagePreference
      isActive: boolean
      file?: File | null
    },
  ) => {
    const formData = new FormData()
    formData.set('name', payload.name)
    formData.set('purpose', payload.purpose)
    formData.set('language', payload.language)
    formData.set('isActive', String(payload.isActive))

    if (payload.file) {
      formData.set('file', payload.file)
    }

    return request<DocumentTemplate>(`/api/document-templates/${id}`, { method: 'PUT', body: formData }, token)
  },
}
