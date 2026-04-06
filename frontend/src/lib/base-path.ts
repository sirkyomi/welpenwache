const rawBaseUrl = new URL(document.baseURI).pathname ?? '/'

export const appBasePath = normalizeBasePath(rawBaseUrl)
export const routerBaseName = appBasePath === '/' ? undefined : appBasePath.slice(0, -1)
export const apiBaseUrl = resolveRequestBaseUrl()

function resolveRequestBaseUrl() {
  const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
  if (configuredApiUrl) {
    return configuredApiUrl.replace(/\/+$/, '')
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:5150'
  }

  return new URL(document.baseURI).toString().replace(/\/+$/, '')
}

function normalizeBasePath(value: string) {
  const normalized = value.trim()
  if (!normalized || normalized === '/') {
    return '/'
  }

  return `/${normalized.replace(/^\/+|\/+$/g, '')}/`
}
