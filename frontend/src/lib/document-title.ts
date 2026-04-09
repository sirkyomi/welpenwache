const APP_NAME = 'WelpenWache'

export function buildDocumentTitle(pageTitle?: string) {
  if (!pageTitle) {
    return APP_NAME
  }

  return `${pageTitle} | ${APP_NAME}`
}
