function toUpper(value) {
  return `${value || ''}`.trim().toUpperCase()
}

export function isExcelCellCode(value) {
  return /^[A-Z]+[1-9]\d*$/.test(toUpper(value))
}

export function normalizeExcelCellCode(value) {
  const raw = toUpper(value)
  return isExcelCellCode(raw) ? raw : ''
}

export function indexToExcelCellCode(index, column = 'A') {
  const safeIndex = Math.max(1, Number(index) || 1)
  const safeColumn = `${column || 'A'}`.trim().toUpperCase() || 'A'
  return `${safeColumn}${safeIndex}`
}

export function flattenRows(sections = []) {
  const rows = []

  for (const section of sections || []) {
    for (const work of section?.works || []) rows.push(work)
    for (const material of section?.materials || []) rows.push(material)
  }

  return rows
}

function replaceExpressionRefs(expression, aliasMap) {
  return `${expression || ''}`.replace(/\b([A-Z]+[1-9]\d*)\b/gi, (match) => {
    const normalized = normalizeExcelCellCode(match)
    return aliasMap.get(normalized) || normalized || match
  })
}

export function assignExcelCellCodesToSections(sections = [], column = 'A') {
  const rows = flattenRows(sections)
  const aliasMap = new Map()

  let index = 1
  for (const row of rows) {
    const nextCode = indexToExcelCellCode(index, column)
    index += 1

    const previousAliases = new Set([
      normalizeExcelCellCode(row?.code),
      normalizeExcelCellCode(row?.cellCode),
      normalizeExcelCellCode(row?.templateCode)
    ].filter(Boolean))

    if (!row.templateCode) {
      const previousStable = normalizeExcelCellCode(row?.cellCode) || normalizeExcelCellCode(row?.code)
      row.templateCode = previousStable || ''
    }

    for (const alias of previousAliases) {
      aliasMap.set(alias, nextCode)
    }

    row.cellCode = nextCode
    row.code = nextCode
  }

  for (const row of rows) {
    row.expression = replaceExpressionRefs(row?.expression, aliasMap)
  }

  return sections
}

export function nextExcelCellCodeForSections(sections = [], column = 'A') {
  const rows = flattenRows(sections)
  return indexToExcelCellCode(rows.length + 1, column)
}
