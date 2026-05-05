const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function toByteArray(data) {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  return new Uint8Array(data || [])
}

function triggerBrowserDownload(bytes, fileName, mimeType = XLSX_MIME) {
  const blob = new Blob([bytes], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}

export async function saveBinaryFile({ bytes, fileName, mimeType = XLSX_MIME } = {}) {
  const safeBytes = toByteArray(bytes)
  const safeFileName = `${fileName || 'export.xlsx'}`.trim() || 'export.xlsx'

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const savedPath = await invoke('save_file_to_downloads', {
      fileName: safeFileName,
      bytes: Array.from(safeBytes)
    })

    if (savedPath) return savedPath
  } catch (error) {
    console.warn('Tauri file export is unavailable, falling back to browser download.', error)
  }

  triggerBrowserDownload(safeBytes, safeFileName, mimeType)
  return safeFileName
}

export { XLSX_MIME }
