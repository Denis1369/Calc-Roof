export function normalizeKey(value) {
  return `${value || ''}`
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/®/g, '')
    .replace(/[^a-zа-я0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
}

export function normalizeText(value, fallback = '') {
  return `${value ?? fallback}`.trim()
}