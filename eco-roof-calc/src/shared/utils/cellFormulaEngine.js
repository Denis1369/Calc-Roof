import { evaluate } from 'mathjs'

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalize(value) {
  return `${value || ''}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function round3(value) {
  return Math.round(toNumber(value) * 1000) / 1000
}

export function isCellCode(value) {
  return /^C\d+$/i.test(`${value || ''}`.trim())
}

export function normalizeCellCode(value) {
  const raw = `${value || ''}`.trim().toUpperCase()
  return isCellCode(raw) ? raw : ''
}

export function extractItemCode(item) {
  if (item?.itemCode) return `${item.itemCode}`
  if (item?.productCode) return `${item.productCode}`

  const rawCode = `${item?.code || ''}`.trim()
  if (rawCode && !isCellCode(rawCode)) {
    return rawCode
  }

  return ''
}

export function normalizeFormulaExpression(expression) {
  return `${expression || ''}`
    .replace(/^=/, '')
    .replace(/\bs\b/g, 'S')
    .replace(/\bp\b/g, 'P')
    .replace(/\bid\b/gi, 'ID')
    .replace(/\bod\b/gi, 'OD')
    .replace(/\bpd\b/gi, 'PD')
    .replace(/\ba\b/g, 'A')
    .trim()
}

export function buildZoneScope(zone) {
  const scope = {
    S: toNumber(zone?.roofParams?.area, zone?.S ?? 0),
    P: toNumber(zone?.roofParams?.perimeter, zone?.P ?? 0),
    PD: toNumber(zone?.roofParams?.parapetDrains, zone?.PD ?? 0),
    OD: toNumber(zone?.roofParams?.parapetDrains, zone?.OD ?? 0),
    ID: toNumber(zone?.roofParams?.innerDrains, zone?.ID ?? 0),
    A: toNumber(zone?.roofParams?.aerators, zone?.A ?? 0)
  }

  for (const param of zone?.customParams || []) {
    const symbol = `${param?.symbol || ''}`.trim()
    if (!symbol) continue
    scope[symbol] = toNumber(param?.value, 0)
  }

  return scope
}

export function replaceCoefficients(expression, coefficientsDb = []) {
  return `${expression || ''}`.replace(/\[(.*?)\]/g, (_, coefficientName) => {
    const target = normalize(coefficientName)

    const found = coefficientsDb.find((item) => {
      const name = normalize(item.name || item.название)
      const key = normalize(item.normalize_key || item.код || '')
      return name === target || key === target
    })

    return `${toNumber(found?.value ?? found?.значение ?? 1, 1)}`
  })
}

function injectMissingCellRefs(prepared, rowContext) {
  const context = { ...(rowContext || {}) }
  const refs = prepared.match(/\bC\d+\b/gi) || []

  for (const ref of refs) {
    const code = ref.toUpperCase()
    if (!Object.prototype.hasOwnProperty.call(context, code)) {
      context[code] = 0
    }
  }

  return context
}

export function evaluateCellExpression(expression, scope = {}, coefficientsDb = [], rowContext = {}) {
  const expr = normalizeFormulaExpression(expression || '0')
  if (!expr) return 0

  const prepared = replaceCoefficients(expr, coefficientsDb)
  const context = injectMissingCellRefs(prepared, rowContext)

  try {
    const value = evaluate(prepared, {
      ...scope,
      ...context
    })
    return round3(value)
  } catch {
    return 0
  }
}

export function flattenSectionRows(sections = []) {
  const rows = []

  for (const section of sections || []) {
    for (const work of section.works || []) {
      rows.push({ kind: 'work', row: work, section })
    }

    for (const material of section.materials || []) {
      rows.push({ kind: 'material', row: material, section })
    }
  }

  return rows
}

export function buildRowContext(rows = []) {
  const context = {}

  for (const entry of rows) {
    const row = entry?.row || entry
    const code = normalizeCellCode(row?.code)
    if (code) {
      context[code] = toNumber(row?.qty, 0)
    }
  }

  return context
}

export function recalculateSectionRowsByCode(sections = [], scope = {}, coefficientsDb = []) {
  const rows = flattenSectionRows(sections)
  if (!rows.length) return

  const maxPasses = Math.max(6, rows.length * 2)

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false
    const context = buildRowContext(rows)

    for (const entry of rows) {
      const row = entry.row
      const nextQty = evaluateCellExpression(row?.expression, scope, coefficientsDb, context)

      if (round3(nextQty) !== round3(row?.qty)) {
        changed = true
      }

      row.qty = nextQty

      const code = normalizeCellCode(row?.code)
      if (code) {
        context[code] = nextQty
      }
    }

    if (!changed) {
      break
    }
  }
}

export function nextCustomCellCode(zone) {
  const used = new Set()

  for (const section of zone?.sections || []) {
    for (const work of section.works || []) {
      const code = normalizeCellCode(work?.code)
      if (code) used.add(code)
    }
    for (const material of section.materials || []) {
      const code = normalizeCellCode(material?.code)
      if (code) used.add(code)
    }
  }

  let value = 9000
  while (used.has(`C${value}`)) {
    value += 1
  }

  return `C${value}`
}
