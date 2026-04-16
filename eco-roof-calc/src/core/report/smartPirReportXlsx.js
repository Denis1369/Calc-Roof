import { normalizeFormulaExpression } from '@/core/utils/cellFormulaEngine'
import { normalizeExcelCellCode } from '@/core/utils/excelCellCodes'

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function round2(value) {
  return Math.round(toNumber(value) * 100) / 100
}

function formatQty(value) {
  const num = round2(value)
  return Number.isInteger(num) ? num : Number(num.toFixed(2))
}

function normalize(value) {
  return `${value || ''}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function getZoneKey(zone, index) {
  return `${zone?.id || `zone-${index + 1}`}`
}

function getItemTotal(item) {
  return round2(toNumber(item?.qty, 0) * toNumber(item?.price, 0))
}

function getSectionTotals(section) {
  const worksTotal = round2(
    (section?.works || []).reduce((sum, item) => sum + getItemTotal(item), 0)
  )

  const materialsTotal = round2(
    (section?.materials || []).reduce((sum, item) => sum + getItemTotal(item), 0)
  )

  return {
    worksTotal,
    materialsTotal,
    total: round2(worksTotal + materialsTotal)
  }
}

function hasContent(section) {
  return (section?.works || []).length > 0 || (section?.materials || []).length > 0
}

function getGlobalRoofParams(zones = []) {
  return zones.reduce(
    (acc, zone) => {
      acc.area += toNumber(zone?.roofParams?.area, 0)
      acc.perimeter += toNumber(zone?.roofParams?.perimeter, 0)
      acc.parapetDrains += toNumber(zone?.roofParams?.parapetDrains, 0)
      acc.innerDrains += toNumber(zone?.roofParams?.innerDrains, 0)
      acc.aerators += toNumber(zone?.roofParams?.aerators, 0)
      return acc
    },
    {
      area: 0,
      perimeter: 0,
      parapetDrains: 0,
      innerDrains: 0,
      aerators: 0
    }
  )
}

function sanitizeFileName(value = '') {
  const safe = `${value || ''}`
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')

  return safe || 'Смета'
}

function formulaFromRefs(refs = []) {
  if (!refs.length) return '0'
  if (refs.length === 1) return refs[0]
  return `SUM(${refs.join(',')})`
}

function applyBorder(cell, border = 'thin') {
  cell.border = {
    top: { style: border, color: { argb: 'FF000000' } },
    left: { style: border, color: { argb: 'FF000000' } },
    bottom: { style: border, color: { argb: 'FF000000' } },
    right: { style: border, color: { argb: 'FF000000' } }
  }
}

function styleRange(worksheet, rowIndex, fromCol, toCol, style = {}, border = 'thin') {
  for (let col = fromCol; col <= toCol; col += 1) {
    const cell = worksheet.getCell(rowIndex, col)
    applyBorder(cell, border)

    if (style.font) cell.font = style.font
    if (style.alignment) cell.alignment = style.alignment
    if (style.fill) cell.fill = style.fill
    if (style.numFmt) cell.numFmt = style.numFmt
  }
}

function setMergedValue(worksheet, range, value, style = {}) {
  worksheet.mergeCells(range)
  const cell = worksheet.getCell(range.split(':')[0])
  cell.value = value

  if (style.font) cell.font = style.font
  if (style.alignment) cell.alignment = style.alignment
  if (style.fill) cell.fill = style.fill
  if (style.numFmt) cell.numFmt = style.numFmt
  return cell
}

function buildRoofInfoText(roof, zones = []) {
  const zoneLines = zones.length > 1
    ? zones.map((zone, index) => `Участок ${index + 1} «${zone?.name || `Участок ${index + 1}`}»: S = ${formatQty(zone?.roofParams?.area)} м2; P = ${formatQty(zone?.roofParams?.perimeter)} пог.м.`)
    : []

  return [
    'Данные крыши:',
    `Суммарная площадь кровли = ${formatQty(roof.area)} м2;`,
    `Примыкания к парапету и вертикальным конструкциям = ${formatQty(roof.perimeter)} пог.м.;`,
    `Водоотведение: внутреннее - ${formatQty(roof.innerDrains)} шт.;`,
    `Водоотведение: наружнее - ${formatQty(roof.parapetDrains)} шт.;`,
    `Аэраторы - ${formatQty(roof.aerators)} шт.`,
    ...zoneLines
  ].join('\n')
}

function triggerBrowserDownload(buffer, fileName) {
  const blob = new Blob(
    [buffer],
    {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  )

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

function getSheetCellRef(sheetName, address, absolute = true) {
  if (!address) return '0'
  if (!absolute) return address

  const normalized = `${address}`.replace(/([A-Z]+)(\d+)/i, (_match, col, row) => `$${col.toUpperCase()}$${row}`)
  const escapedName = `${sheetName || 'Лист1'}`.replaceAll("'", "''")
  return `'${escapedName}'!${normalized}`
}

function collectUsedCoefficientNames(zones = []) {
  const names = new Set()

  for (const zone of zones || []) {
    for (const section of zone?.sections || []) {
      for (const item of [...(section?.works || []), ...(section?.materials || [])]) {
        const matches = `${item?.expression || ''}`.match(/\[(.*?)\]/g) || []
        for (const match of matches) {
          const key = normalize(match.slice(1, -1))
          if (key) names.add(key)
        }
      }
    }
  }

  return Array.from(names)
}

function findCoefficient(coefficients = [], key = '') {
  const target = normalize(key)
  if (!target) return null

  return coefficients.find((item) => {
    const byName = normalize(item?.name || item?.название)
    const byKey = normalize(item?.normalize_key || item?.код || '')
    return byName === target || byKey === target
  }) || null
}

function buildZoneVariableDefinitions(zone = {}) {
  const definitions = []
  const seen = new Set()

  const addDefinition = ({ key, label, value, unit = '', aliases = [] }) => {
    const mainKey = normalize(key)
    if (!mainKey || seen.has(mainKey)) return

    definitions.push({
      key,
      label: label || key,
      value: toNumber(value, 0),
      unit,
      aliases: aliases.filter(Boolean)
    })

    seen.add(mainKey)
    for (const alias of aliases) {
      const aliasKey = normalize(alias)
      if (aliasKey) seen.add(aliasKey)
    }
  }

  addDefinition({
    key: 'S',
    label: 'Площадь кровли',
    value: zone?.roofParams?.area,
    unit: 'м2',
    aliases: ['roof_area']
  })

  addDefinition({
    key: 'P',
    label: 'Примыкания к парапету и вертикальным конструкциям',
    value: zone?.roofParams?.perimeter,
    unit: 'пог.м.',
    aliases: ['parapet_perimeter', 'parapet_length', 'roof_perimeter']
  })

  addDefinition({
    key: 'OD',
    label: 'Наружные воронки',
    value: zone?.roofParams?.parapetDrains,
    unit: 'шт',
    aliases: ['PD', 'outer_drains_count', 'parapet_drains_count']
  })

  addDefinition({
    key: 'ID',
    label: 'Внутренние воронки',
    value: zone?.roofParams?.innerDrains,
    unit: 'шт',
    aliases: ['inner_drains_count']
  })

  addDefinition({
    key: 'A',
    label: 'Аэраторы',
    value: zone?.roofParams?.aerators,
    unit: 'шт',
    aliases: ['aerators_count']
  })

  for (const param of zone?.customParams || []) {
    const symbol = `${param?.symbol || ''}`.trim()
    if (!symbol) continue

    addDefinition({
      key: symbol,
      label: param?.name || symbol,
      value: param?.value,
      unit: ''
    })
  }

  for (const [paramKey, rawValue] of Object.entries(zone?.templateMeta?.paramValues || {})) {
    const number = Number(rawValue)
    if (!Number.isFinite(number)) continue
    if (seen.has(normalize(paramKey))) continue

    addDefinition({
      key: paramKey,
      label: paramKey,
      value: number,
      unit: ''
    })
  }

  return definitions
}

function buildFormulaSupportSheet({ workbook, estimateZones, coefficients, fonts, fills, qtyFmt }) {
  const sheetName = 'Коэффициенты'
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: false }]
  })

  worksheet.properties.defaultRowHeight = 20
  worksheet.columns = [
    { width: 24 },
    { width: 22 },
    { width: 42 },
    { width: 14 },
    { width: 12 },
    { width: 42 }
  ]

  let row = 1
  const zoneFormulaRefs = new Map()
  const coefficientRefs = new Map()

  setMergedValue(worksheet, `A${row}:F${row}`, 'Параметры и коэффициенты для формул', {
    font: fonts.title,
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: fills.header
  })
  styleRange(worksheet, row, 1, 6, {
    font: fonts.title,
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: fills.header
  }, 'medium')
  row += 2

  for (let zoneIndex = 0; zoneIndex < estimateZones.length; zoneIndex += 1) {
    const zone = estimateZones[zoneIndex]
    const zoneKey = getZoneKey(zone, zoneIndex)
    const zoneMap = new Map()
    zoneFormulaRefs.set(zoneKey, zoneMap)

    setMergedValue(worksheet, `A${row}:F${row}`, `Параметры зоны: ${zone?.name || `Участок ${zoneIndex + 1}`}`, {
      font: fonts.section,
      alignment: { horizontal: 'left', vertical: 'middle' },
      fill: fills.subtotal
    })
    styleRange(worksheet, row, 1, 6, {
      font: fonts.section,
      alignment: { horizontal: 'left', vertical: 'middle' },
      fill: fills.subtotal
    }, 'medium')
    row += 1

    worksheet.getRow(row).values = ['Участок', 'Символ', 'Параметр', 'Значение', 'Ед.', 'Алиасы']
    styleRange(worksheet, row, 1, 6, {
      font: fonts.header,
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      fill: fills.header
    }, 'medium')
    row += 1

    const definitions = buildZoneVariableDefinitions(zone)

    if (!definitions.length) {
      worksheet.getCell(`A${row}`).value = zone?.name || `Участок ${zoneIndex + 1}`
      worksheet.getCell(`C${row}`).value = 'Параметры для формул не найдены'
      styleRange(worksheet, row, 1, 6, {
        font: { ...fonts.base, italic: true },
        alignment: { vertical: 'middle' }
      })
      row += 1
    } else {
      for (const definition of definitions) {
        worksheet.getCell(`A${row}`).value = zone?.name || `Участок ${zoneIndex + 1}`
        worksheet.getCell(`B${row}`).value = definition.key
        worksheet.getCell(`C${row}`).value = definition.label
        worksheet.getCell(`D${row}`).value = definition.value
        worksheet.getCell(`E${row}`).value = definition.unit || ''
        worksheet.getCell(`F${row}`).value = definition.aliases.join(', ')

        styleRange(worksheet, row, 1, 6, {
          font: fonts.base,
          alignment: { vertical: 'middle', wrapText: true }
        })
        worksheet.getCell(`D${row}`).numFmt = qtyFmt
        worksheet.getCell(`D${row}`).alignment = { horizontal: 'right', vertical: 'middle' }

        const valueRef = getSheetCellRef(sheetName, `D${row}`)
        zoneMap.set(normalize(definition.key), valueRef)
        for (const alias of definition.aliases || []) {
          zoneMap.set(normalize(alias), valueRef)
        }

        row += 1
      }
    }

    row += 1
  }

  const usedCoefficientNames = collectUsedCoefficientNames(estimateZones)

  setMergedValue(worksheet, `A${row}:F${row}`, 'Коэффициенты, используемые в формулах', {
    font: fonts.section,
    alignment: { horizontal: 'left', vertical: 'middle' },
    fill: fills.subtotal
  })
  styleRange(worksheet, row, 1, 6, {
    font: fonts.section,
    alignment: { horizontal: 'left', vertical: 'middle' },
    fill: fills.subtotal
  }, 'medium')
  row += 1

  worksheet.getRow(row).values = ['Группа', 'Ключ', 'Описание', 'Значение', 'Ед.', 'Комментарий']
  styleRange(worksheet, row, 1, 6, {
    font: fonts.header,
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    fill: fills.header
  }, 'medium')
  row += 1

  if (usedCoefficientNames.length) {
    for (const coefficientName of usedCoefficientNames) {
      const found = findCoefficient(coefficients, coefficientName)

      worksheet.getCell(`A${row}`).value = found?.group_name || 'formula'
      worksheet.getCell(`B${row}`).value = found?.name || coefficientName
      worksheet.getCell(`C${row}`).value = found?.description || found?.name || coefficientName
      worksheet.getCell(`D${row}`).value = toNumber(found?.value ?? found?.значение ?? 1, 1)
      worksheet.getCell(`E${row}`).value = found?.unit || ''
      worksheet.getCell(`F${row}`).value = found
        ? 'Используется в формулах сметы'
        : 'Коэффициент не найден в справочнике, подставлено значение 1'

      styleRange(worksheet, row, 1, 6, {
        font: fonts.base,
        alignment: { vertical: 'middle', wrapText: true }
      })
      worksheet.getCell(`D${row}`).numFmt = qtyFmt
      worksheet.getCell(`D${row}`).alignment = { horizontal: 'right', vertical: 'middle' }

      coefficientRefs.set(normalize(coefficientName), getSheetCellRef(sheetName, `D${row}`))
      row += 1
    }
  } else {
    worksheet.getCell(`A${row}`).value = 'formula'
    worksheet.getCell(`C${row}`).value = 'В формулах сметы коэффициенты не используются'
    styleRange(worksheet, row, 1, 6, {
      font: { ...fonts.base, italic: true },
      alignment: { vertical: 'middle' }
    })
    row += 1
  }

  return {
    worksheet,
    zoneFormulaRefs,
    coefficientRefs
  }
}

function buildQtyCellRefMaps(visibleZones = [], startRow = 1) {
  const zoneMaps = new Map()
  let row = startRow

  for (let zoneIndex = 0; zoneIndex < visibleZones.length; zoneIndex += 1) {
    const zone = visibleZones[zoneIndex]
    const zoneKey = getZoneKey(zone, zoneIndex)
    const map = new Map()
    zoneMaps.set(zoneKey, map)

    const zoneSections = (zone?.sections || []).filter(hasContent)

    for (const section of zoneSections) {
      row += 1
      row += 1

      const works = section?.works || []
      if (works.length) {
        for (const item of works) {
          const code = normalizeExcelCellCode(item?.code || item?.cellCode || item?.templateCode)
          if (code) {
            map.set(code, `C${row}`)
          }
          row += 1
        }
      } else {
        row += 1
      }

      row += 1
      row += 1

      const materials = section?.materials || []
      if (materials.length) {
        for (const item of materials) {
          const code = normalizeExcelCellCode(item?.code || item?.cellCode || item?.templateCode)
          if (code) {
            map.set(code, `C${row}`)
          }
          row += 1
        }
      } else {
        row += 1
      }

      row += 1
      row += 1
    }
  }

  return zoneMaps
}

function translateExpressionToExcel(expression, { zoneVarRefs, coefficientRefs, qtyRefsByCode }) {
  const prepared = normalizeFormulaExpression(expression || '0').replace(/^=/, '').trim()
  if (!prepared) return '0'

  return prepared.replace(/\[[^\]]+\]|\b[A-Z]+[1-9]\d*\b|\b[A-Za-z_][A-Za-z0-9_]*\b/gi, (token) => {
    if (!token) return token

    if (token.startsWith('[') && token.endsWith(']')) {
      const key = normalize(token.slice(1, -1))
      return coefficientRefs.get(key) || '1'
    }

    const rowCode = normalizeExcelCellCode(token)
    if (rowCode) {
      return qtyRefsByCode.get(rowCode) || '0'
    }

    const variableRef = zoneVarRefs.get(normalize(token))
    if (variableRef) {
      return variableRef
    }

    return '0'
  })
}

export async function exportSmartPirReportXlsx(payload = {}) {
  const projectName = `${payload?.projectName || 'Новый проект'}`.trim() || 'Новый проект'
  const vatRate = toNumber(payload?.vatRate, 0)
  const estimateZones = Array.isArray(payload?.estimateZones) ? payload.estimateZones : []
  const overheadExpenses = Array.isArray(payload?.overheadExpenses) ? payload.overheadExpenses : []
  const coefficients = Array.isArray(payload?.coefficients) ? payload.coefficients : []
  const visibleZones = estimateZones.filter((zone) => (zone?.sections || []).some(hasContent))
  const roof = getGlobalRoofParams(estimateZones)

  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Eco-Roof'
  workbook.company = 'Eco-Roof'
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.calcProperties.fullCalcOnLoad = true

  const worksheet = workbook.addWorksheet('Смета', {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2
      }
    }
  })

  worksheet.properties.defaultRowHeight = 20
  worksheet.columns = [
    { width: 62 },
    { width: 10 },
    { width: 14 },
    { width: 21 },
    { width: 24 }
  ]

  const fonts = {
    base: { name: 'Arial', size: 12 },
    small: { name: 'Arial', size: 9 },
    title: { name: 'Arial', size: 14, bold: true },
    giant: { name: 'Arial', size: 18, bold: true },
    header: { name: 'Arial', size: 12, bold: true },
    section: { name: 'Arial', size: 12, bold: true },
    italicBold: { name: 'Arial', size: 12, bold: true, italic: true },
    total: { name: 'Arial', size: 16, bold: true, italic: true }
  }

  const fills = {
    header: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } },
    subtotal: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } },
    total: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } },
    grand: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C6E7' } }
  }

  const moneyFmt = '#,##0.00" ₽"'
  const qtyFmt = '#,##0.00'

  const { zoneFormulaRefs, coefficientRefs } = buildFormulaSupportSheet({
    workbook,
    estimateZones,
    coefficients,
    fonts,
    fills,
    qtyFmt
  })

  let row = 1

  setMergedValue(worksheet, `A${row}:E${row}`, 'Приложение №1 к Договору подряда №__________ от __.__.2025 г.', {
    font: { ...fonts.base, size: 11 },
    alignment: { horizontal: 'right', vertical: 'middle' }
  })
  row += 2

  setMergedValue(worksheet, `A${row}:B${row}`, 'Согласовано', {
    font: fonts.small,
    alignment: { horizontal: 'left', vertical: 'middle' }
  })
  setMergedValue(worksheet, `D${row}:E${row}`, 'Утверждаю', {
    font: fonts.small,
    alignment: { horizontal: 'left', vertical: 'middle' }
  })
  row += 1

  setMergedValue(worksheet, `A${row}:B${row}`, '«Подрядчик»', {
    font: fonts.small,
    alignment: { horizontal: 'left', vertical: 'middle' }
  })
  setMergedValue(worksheet, `D${row}:E${row}`, '«Заказчик»', {
    font: fonts.small,
    alignment: { horizontal: 'left', vertical: 'middle' }
  })
  row += 1

  setMergedValue(worksheet, `A${row}:B${row}`, 'ООО «СК-ЮГ»', {
    font: fonts.base,
    alignment: { horizontal: 'left', vertical: 'middle' }
  })
  setMergedValue(worksheet, `D${row}:E${row}`, 'ООО «______________________________»', {
    font: fonts.base,
    alignment: { horizontal: 'left', vertical: 'middle' }
  })
  row += 1

  setMergedValue(worksheet, `A${row}:B${row}`, 'ИНН / КПП: 2312330110 / 231201001', {
    font: fonts.base,
    alignment: { horizontal: 'left', vertical: 'middle' }
  })
  setMergedValue(worksheet, `D${row}:E${row}`, 'ИНН / КПП: _______________________', {
    font: fonts.base,
    alignment: { horizontal: 'left', vertical: 'middle' }
  })
  row += 1

  setMergedValue(worksheet, `A${row}:B${row}`, 'Ген. директор________________  (Панюков А.А.)', {
    font: fonts.base,
    alignment: { horizontal: 'left', vertical: 'middle' }
  })
  setMergedValue(worksheet, `D${row}:E${row}`, 'Директор______________________  (Ф.И.О.)', {
    font: fonts.base,
    alignment: { horizontal: 'left', vertical: 'middle' }
  })
  row += 3

  setMergedValue(worksheet, `A${row}:E${row}`, 'СМЕТА №1', {
    font: { ...fonts.base, size: 11, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' }
  })
  row += 1

  setMergedValue(worksheet, `A${row}:E${row}`, `по коммерческой смете объекта «${projectName}»`, {
    font: fonts.base,
    alignment: { horizontal: 'center', vertical: 'middle' }
  })
  row += 3

  setMergedValue(worksheet, `A${row}:E${row}`, `Наименование объекта: ${projectName}`, {
    font: fonts.base,
    alignment: { horizontal: 'left', vertical: 'middle' }
  })
  row += 1

  setMergedValue(worksheet, `A${row}:E${row}`, 'Адрес объекта: ______________________________', {
    font: fonts.base,
    alignment: { horizontal: 'left', vertical: 'middle' }
  })
  row += 1

  setMergedValue(worksheet, `A${row}:E${row + 1}`, buildRoofInfoText(roof, estimateZones), {
    font: { ...fonts.base, size: 11 },
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true }
  })
  worksheet.getRow(row).height = 74
  worksheet.getRow(row + 1).height = 10
  row += 2

  worksheet.getCell(`A${row}`).value = 'Наименование работ.'
  worksheet.getCell(`B${row}`).value = 'Ед.изм.'
  worksheet.getCell(`C${row}`).value = 'Кол-во'
  worksheet.getCell(`D${row}`).value = `Цена за ед. (с НДС-${formatQty(vatRate)}%)`
  worksheet.getCell(`E${row}`).value = `Сумма (с НДС-${formatQty(vatRate)}%)`
  styleRange(worksheet, row, 1, 5, {
    font: fonts.header,
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    fill: fills.header
  }, 'medium')
  worksheet.getRow(row).height = 24
  row += 1

  const qtyRefsByZone = buildQtyCellRefMaps(visibleZones, row)
  const workSubtotalRefs = []
  const materialSubtotalRefs = []

  const addItemsBlock = (label, items, subtotalLabel, subtotalRefs, context) => {
    setMergedValue(worksheet, `A${row}:E${row}`, label, {
      font: fonts.italicBold,
      alignment: { horizontal: 'center', vertical: 'middle' }
    })
    styleRange(worksheet, row, 1, 5, {
      font: fonts.italicBold,
      alignment: { horizontal: 'center', vertical: 'middle' }
    }, 'medium')
    row += 1

    const startDataRow = row

    if (items.length) {
      items.forEach((item) => {
        worksheet.getCell(`A${row}`).value = item?.name || ''
        worksheet.getCell(`B${row}`).value = item?.unit || ''

        const excelExpression = translateExpressionToExcel(item?.expression, context)
        const qtyCell = worksheet.getCell(`C${row}`)
        qtyCell.value = {
          formula: excelExpression,
          result: round2(item?.qty)
        }

        worksheet.getCell(`D${row}`).value = round2(item?.price)
        worksheet.getCell(`E${row}`).value = {
          formula: `C${row}*D${row}`,
          result: getItemTotal(item)
        }

        styleRange(worksheet, row, 1, 5, {
          font: fonts.base,
          alignment: { vertical: 'middle', horizontal: 'left', wrapText: true }
        })
        worksheet.getCell(`B${row}`).alignment = { horizontal: 'center', vertical: 'middle' }
        worksheet.getCell(`C${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
        worksheet.getCell(`D${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
        worksheet.getCell(`E${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
        worksheet.getCell(`C${row}`).numFmt = qtyFmt
        worksheet.getCell(`D${row}`).numFmt = moneyFmt
        worksheet.getCell(`E${row}`).numFmt = moneyFmt

        row += 1
      })
    } else {
      setMergedValue(worksheet, `A${row}:E${row}`, `Нет данных в блоке «${label.replace(':', '')}»`, {
        font: { ...fonts.base, italic: true },
        alignment: { horizontal: 'center', vertical: 'middle' }
      })
      styleRange(worksheet, row, 1, 5, {
        font: { ...fonts.base, italic: true },
        alignment: { horizontal: 'center', vertical: 'middle' }
      })
      row += 1
    }

    const endDataRow = row - 1
    setMergedValue(worksheet, `A${row}:D${row}`, subtotalLabel, {
      font: fonts.italicBold,
      alignment: { horizontal: 'right', vertical: 'middle' },
      fill: fills.subtotal
    })
    styleRange(worksheet, row, 1, 5, {
      font: fonts.italicBold,
      alignment: { vertical: 'middle' },
      fill: fills.subtotal
    })
    const totalCell = worksheet.getCell(`E${row}`)
    totalCell.value = {
      formula: items.length ? `SUM(E${startDataRow}:E${endDataRow})` : '0',
      result: round2(items.reduce((sum, item) => sum + getItemTotal(item), 0))
    }
    totalCell.font = fonts.italicBold
    totalCell.alignment = { horizontal: 'right', vertical: 'middle' }
    totalCell.fill = fills.subtotal
    totalCell.numFmt = moneyFmt

    subtotalRefs.push(`E${row}`)
    const subtotalRef = `E${row}`
    row += 1
    return subtotalRef
  }

  if (visibleZones.length) {
    visibleZones.forEach((zone, zoneIndex) => {
      const zoneSections = (zone?.sections || []).filter(hasContent)
      const zoneKey = getZoneKey(zone, zoneIndex)
      const zoneVarRefs = zoneFormulaRefs.get(zoneKey) || new Map()
      const qtyRefsByCode = qtyRefsByZone.get(zoneKey) || new Map()

      zoneSections.forEach((section) => {
        const title = visibleZones.length > 1
          ? `${section?.title || 'Раздел'} — ${zone?.name || `Участок ${zoneIndex + 1}`}`
          : (section?.title || 'Раздел')

        setMergedValue(worksheet, `A${row}:E${row}`, title, {
          font: fonts.section,
          alignment: { horizontal: 'left', vertical: 'middle', wrapText: true }
        })
        styleRange(worksheet, row, 1, 5, {
          font: fonts.section,
          alignment: { horizontal: 'left', vertical: 'middle', wrapText: true }
        }, 'medium')
        worksheet.getRow(row).height = 24
        row += 1

        const formulaContext = {
          zoneVarRefs,
          coefficientRefs,
          qtyRefsByCode
        }

        const worksSubtotalRef = addItemsBlock('Работы:', section?.works || [], 'Итого за работы:', workSubtotalRefs, formulaContext)
        const materialsSubtotalRef = addItemsBlock('Материалы:', section?.materials || [], 'Итого за материалы:', materialSubtotalRefs, formulaContext)

        setMergedValue(worksheet, `A${row}:D${row}`, 'ИТОГО по Разделу:', {
          font: fonts.italicBold,
          alignment: { horizontal: 'right', vertical: 'middle' },
          fill: fills.total
        })
        styleRange(worksheet, row, 1, 5, {
          font: fonts.italicBold,
          alignment: { vertical: 'middle' },
          fill: fills.total
        }, 'medium')

        const sectionTotal = worksheet.getCell(`E${row}`)
        const sectionTotals = getSectionTotals(section)
        sectionTotal.value = {
          formula: `${worksSubtotalRef}+${materialsSubtotalRef}`,
          result: sectionTotals.total
        }
        sectionTotal.font = fonts.italicBold
        sectionTotal.alignment = { horizontal: 'right', vertical: 'middle' }
        sectionTotal.fill = fills.total
        sectionTotal.numFmt = moneyFmt
        row += 1
      })
    })
  } else {
    setMergedValue(worksheet, `A${row}:E${row}`, 'В смете пока нет разделов для формирования отчёта', {
      font: { ...fonts.base, italic: true },
      alignment: { horizontal: 'center', vertical: 'middle' }
    })
    styleRange(worksheet, row, 1, 5, {
      font: { ...fonts.base, italic: true },
      alignment: { horizontal: 'center', vertical: 'middle' }
    }, 'medium')
    row += 1
  }

  const materialsGrandValue = round2(
    estimateZones.reduce((sum, zone) => {
      return sum + (zone?.sections || []).reduce((sectionSum, section) => {
        return sectionSum + getSectionTotals(section).materialsTotal
      }, 0)
    }, 0)
  )

  setMergedValue(
    worksheet,
    `A${row}:D${row}`,
    'ИТОГО по Разделам материалы:',
    {
      font: fonts.total,
      alignment: { horizontal: 'left', vertical: 'middle' },
      fill: fills.total
    }
  )
  styleRange(worksheet, row, 1, 5, {
    font: fonts.total,
    alignment: { vertical: 'middle' },
    fill: fills.total
  }, 'medium')
  worksheet.getCell(`E${row}`).value = {
    formula: formulaFromRefs(materialSubtotalRefs),
    result: materialsGrandValue
  }
  worksheet.getCell(`E${row}`).font = fonts.total
  worksheet.getCell(`E${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
  worksheet.getCell(`E${row}`).fill = fills.total
  worksheet.getCell(`E${row}`).numFmt = moneyFmt
  const materialsGrandRef = `E${row}`
  row += 1

  const worksGrandValue = round2(
    estimateZones.reduce((sum, zone) => {
      return sum + (zone?.sections || []).reduce((sectionSum, section) => {
        return sectionSum + getSectionTotals(section).worksTotal
      }, 0)
    }, 0)
  )

  setMergedValue(
    worksheet,
    `A${row}:D${row}`,
    'ИТОГО по Разделам монтажные работы:',
    {
      font: fonts.total,
      alignment: { horizontal: 'left', vertical: 'middle' },
      fill: fills.total
    }
  )
  styleRange(worksheet, row, 1, 5, {
    font: fonts.total,
    alignment: { vertical: 'middle' },
    fill: fills.total
  }, 'medium')
  worksheet.getCell(`E${row}`).value = {
    formula: formulaFromRefs(workSubtotalRefs),
    result: worksGrandValue
  }
  worksheet.getCell(`E${row}`).font = fonts.total
  worksheet.getCell(`E${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
  worksheet.getCell(`E${row}`).fill = fills.total
  worksheet.getCell(`E${row}`).numFmt = moneyFmt
  const worksGrandRef = `E${row}`
  row += 1

  setMergedValue(
    worksheet,
    `A${row}:E${row}`,
    'Накладные, транспортные, организационные и утилизационные расходы:',
    {
      font: fonts.total,
      alignment: { horizontal: 'left', vertical: 'middle' },
      fill: fills.header
    }
  )
  styleRange(worksheet, row, 1, 5, {
    font: fonts.total,
    alignment: { vertical: 'middle' },
    fill: fills.header
  }, 'medium')
  row += 1

  const visibleExpenses = overheadExpenses.filter((item) => {
    return `${item?.name || ''}`.trim() || toNumber(item?.qty, 0) || toNumber(item?.price, 0)
  })
  const expensesStartRow = row

  if (visibleExpenses.length) {
    visibleExpenses.forEach((item) => {
      worksheet.getCell(`A${row}`).value = item?.name || 'Накладные расходы'
      worksheet.getCell(`B${row}`).value = item?.unit || ''
      worksheet.getCell(`C${row}`).value = toNumber(item?.qty, 0)
      worksheet.getCell(`D${row}`).value = round2(item?.price)
      worksheet.getCell(`E${row}`).value = {
        formula: `C${row}*D${row}`,
        result: round2(toNumber(item?.qty, 0) * toNumber(item?.price, 0))
      }

      styleRange(worksheet, row, 1, 5, {
        font: fonts.base,
        alignment: { vertical: 'middle', horizontal: 'left', wrapText: true }
      })
      worksheet.getCell(`B${row}`).alignment = { horizontal: 'center', vertical: 'middle' }
      worksheet.getCell(`C${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
      worksheet.getCell(`D${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
      worksheet.getCell(`E${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
      worksheet.getCell(`C${row}`).numFmt = qtyFmt
      worksheet.getCell(`D${row}`).numFmt = moneyFmt
      worksheet.getCell(`E${row}`).numFmt = moneyFmt
      row += 1
    })
  } else {
    setMergedValue(worksheet, `A${row}:E${row}`, 'Накладные расходы не добавлены', {
      font: { ...fonts.base, italic: true },
      alignment: { horizontal: 'center', vertical: 'middle' }
    })
    styleRange(worksheet, row, 1, 5, {
      font: { ...fonts.base, italic: true },
      alignment: { horizontal: 'center', vertical: 'middle' }
    })
    row += 1
  }

  const expensesGrandValue = round2(
    visibleExpenses.reduce((sum, item) => sum + toNumber(item?.qty, 0) * toNumber(item?.price, 0), 0)
  )

  setMergedValue(
    worksheet,
    `A${row}:D${row}`,
    'ИТОГО по накладным расходам:',
    {
      font: fonts.total,
      alignment: { horizontal: 'left', vertical: 'middle' },
      fill: fills.total
    }
  )
  styleRange(worksheet, row, 1, 5, {
    font: fonts.total,
    alignment: { vertical: 'middle' },
    fill: fills.total
  }, 'medium')
  worksheet.getCell(`E${row}`).value = {
    formula: visibleExpenses.length ? `SUM(E${expensesStartRow}:E${row - 1})` : '0',
    result: expensesGrandValue
  }
  worksheet.getCell(`E${row}`).font = fonts.total
  worksheet.getCell(`E${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
  worksheet.getCell(`E${row}`).fill = fills.total
  worksheet.getCell(`E${row}`).numFmt = moneyFmt
  const expensesGrandRef = `E${row}`
  row += 1

  const subtotalValue = round2(materialsGrandValue + worksGrandValue + expensesGrandValue)

  setMergedValue(worksheet, `A${row}:D${row}`, 'ИТОГО без НДС:', {
    font: fonts.total,
    alignment: { horizontal: 'left', vertical: 'middle' },
    fill: fills.total
  })
  styleRange(worksheet, row, 1, 5, {
    font: fonts.total,
    alignment: { vertical: 'middle' },
    fill: fills.total
  }, 'medium')
  worksheet.getCell(`E${row}`).value = {
    formula: `${materialsGrandRef}+${worksGrandRef}+${expensesGrandRef}`,
    result: subtotalValue
  }
  worksheet.getCell(`E${row}`).font = fonts.total
  worksheet.getCell(`E${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
  worksheet.getCell(`E${row}`).fill = fills.total
  worksheet.getCell(`E${row}`).numFmt = moneyFmt
  const subtotalRef = `E${row}`
  row += 1

  const vatValue = round2(subtotalValue * (vatRate / 100))

  setMergedValue(worksheet, `A${row}:D${row}`, `НДС (${formatQty(vatRate)}%):`, {
    font: fonts.total,
    alignment: { horizontal: 'left', vertical: 'middle' },
    fill: fills.total
  })
  styleRange(worksheet, row, 1, 5, {
    font: fonts.total,
    alignment: { vertical: 'middle' },
    fill: fills.total
  }, 'medium')
  worksheet.getCell(`E${row}`).value = {
    formula: `${subtotalRef}*${vatRate / 100}`,
    result: vatValue
  }
  worksheet.getCell(`E${row}`).font = fonts.total
  worksheet.getCell(`E${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
  worksheet.getCell(`E${row}`).fill = fills.total
  worksheet.getCell(`E${row}`).numFmt = moneyFmt
  const vatRef = `E${row}`
  row += 1

  setMergedValue(worksheet, `A${row}:D${row}`, 'Итого общая сумма по всем разделам:', {
    font: fonts.giant,
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: fills.grand
  })
  styleRange(worksheet, row, 1, 5, {
    font: fonts.giant,
    alignment: { vertical: 'middle' },
    fill: fills.grand
  }, 'medium')
  worksheet.getCell(`E${row}`).value = {
    formula: `${subtotalRef}+${vatRef}`,
    result: round2(subtotalValue + vatValue)
  }
  worksheet.getCell(`E${row}`).font = fonts.giant
  worksheet.getCell(`E${row}`).alignment = { horizontal: 'right', vertical: 'middle' }
  worksheet.getCell(`E${row}`).fill = fills.grand
  worksheet.getCell(`E${row}`).numFmt = moneyFmt

  worksheet.getRow(row).height = 28
  worksheet.eachRow((sheetRow) => {
    sheetRow.eachCell((cell) => {
      if (!cell.font) cell.font = fonts.base
      if (!cell.alignment) cell.alignment = { vertical: 'middle' }
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const baseName = sanitizeFileName(projectName || 'Смета')
  const fileName = `${baseName}.xlsx`
  triggerBrowserDownload(buffer, fileName)
  return fileName
}
