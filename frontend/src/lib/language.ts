import type { LanguagePreference } from '@/lib/types'

export const languageStorageKey = 'welpenwache.language'

export function normalizeLanguagePreference(value: unknown): LanguagePreference {
  if (typeof value !== 'string') {
    return 'de'
  }

  const normalizedValue = value.trim().toLowerCase()
  return normalizedValue.startsWith('en') ? 'en' : 'de'
}

export function getBrowserLanguagePreference(): LanguagePreference {
  if (typeof navigator === 'undefined') {
    return 'de'
  }

  return normalizeLanguagePreference(navigator.languages?.[0] ?? navigator.language)
}

export function readStoredLanguagePreference(): LanguagePreference | null {
  if (typeof window === 'undefined') {
    return null
  }

  const value = window.localStorage.getItem(languageStorageKey)
  return value ? normalizeLanguagePreference(value) : null
}

export function writeStoredLanguagePreference(languagePreference: LanguagePreference) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(languageStorageKey, languagePreference)
}
