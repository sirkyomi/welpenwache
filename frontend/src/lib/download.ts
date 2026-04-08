export function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  link.click()
  window.URL.revokeObjectURL(objectUrl)
}
