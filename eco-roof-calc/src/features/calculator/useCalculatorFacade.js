import { ref, computed } from 'vue'
import { evaluate } from 'mathjs'

import { getCatalogData } from '../../application/catalog/getCatalogData'
import { saveEstimate as saveEstimateAction } from '../../application/estimates/saveEstimate'
import { loadEstimate as loadEstimateAction } from '../../application/estimates/loadEstimate'
import { listSavedEstimates } from '../../application/estimates/listSavedEstimates'
import { listSystems } from '../../application/systems/listSystems'
import { getSystemTemplate } from '../../application/systems/getSystemTemplate'

import { buildEstimateFromSystem } from '../../utils/templateEstimateBuilder'
import { assignExcelCellCodesToSections, nextExcelCellCodeForSections } from '../../shared/utils/excelCellCodes'
import {
  toLegacyMaterialRow,
  toLegacyWorkRow
} from '../../shared/adapters/catalogViewAdapters'
import {
  toSystemListItem,
  toSystemTemplateView
} from '../../shared/adapters/systemViewAdapter'

function uuid() {
  return crypto.randomUUID()
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
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

function round2(value) {
  return Math.round(toNumber(value) * 100) / 100
}

function createEmptyWork() {
  return {
    id: uuid(),
    code: '',
    cellCode: '',
    templateCode: '',
    itemCode: '',
    name: '',
    unit: 'м2',
    formulaName: '',
    expression: 'S',
    qty: 0,
    price: 0,
    total: 0
  }
}

function createEmptyMaterial(supplier = 'ТехноНИКОЛЬ') {
  return {
    id: uuid(),
    code: '',
    cellCode: '',
    templateCode: '',
    itemCode: '',
    name: '',
    supplier,
    unit: 'м2',
    formulaName: '',
    expression: 'S',
    qty: 0,
    price: 0,
    total: 0
  }
}

function createEmptySection(title = 'Новый раздел') {
  return {
    id: uuid(),
    title,
    works: [],
    materials: []
  }
}

function createEmptyZone(name = 'Новый участок') {
  return {
    id: uuid(),
    name,
    supplierType: 'ТехноНИКОЛЬ',
    roofParams: {
      area: 0,
      perimeter: 0,
      parapetDrains: 0,
      innerDrains: 0,
      aerators: 0
    },
    customParams: [],
    sections: [createEmptySection()]
  }
}

function createEmptyExpense() {
  return {
    id: uuid(),
    name: '',
    unit: 'шт',
    qty: 1,
    price: 0
  }
}

function toLegacyFormulaRow(formula) {
  return {
    идентификатор: formula.id,
    код: formula.code,
    название_формулы: formula.name,
    выражение: formula.expression,
    описание: formula.description || ''
  }
}

function normalizeCustomParam(param) {
  return {
    name: param?.name || 'Новая переменная',
    symbol: param?.symbol || 'X',
    value: toNumber(param?.value, 0)
  }
}

function normalizeWorkItem(item) {
  return {
    id: item?.id || uuid(),
    code: item?.code || '',
    cellCode: item?.cellCode || '',
    templateCode: item?.templateCode || '',
    itemCode: item?.itemCode || '',
    name: item?.name || '',
    unit: item?.unit || 'м2',
    formulaName: item?.formulaName || '',
    expression: item?.expression || 'S',
    qty: toNumber(item?.qty, 0),
    price: toNumber(item?.price, 0),
    total: round2((toNumber(item?.qty, 0)) * (toNumber(item?.price, 0)))
  }
}

function normalizeMaterialItem(item, supplier = 'ТехноНИКОЛЬ') {
  return {
    id: item?.id || uuid(),
    code: item?.code || '',
    cellCode: item?.cellCode || '',
    templateCode: item?.templateCode || '',
    itemCode: item?.itemCode || '',
    name: item?.name || '',
    supplier: item?.supplier || supplier,
    unit: item?.unit || 'м2',
    formulaName: item?.formulaName || '',
    expression: item?.expression || 'S',
    qty: toNumber(item?.qty, 0),
    price: toNumber(item?.price, 0),
    total: round2((toNumber(item?.qty, 0)) * (toNumber(item?.price, 0)))
  }
}

function normalizeSection(section, zoneSupplier = 'ТехноНИКОЛЬ') {
  return {
    id: section?.id || uuid(),
    title: section?.title || 'Раздел',
    works: Array.isArray(section?.works) ? section.works.map(normalizeWorkItem) : [],
    materials: Array.isArray(section?.materials)
      ? section.materials.map((item) => normalizeMaterialItem(item, zoneSupplier))
      : []
  }
}

function normalizeZone(zone) {
  const supplierType = zone?.supplierType || 'ТехноНИКОЛЬ'

  const normalized = {
    id: zone?.id || uuid(),
    name: zone?.name || 'Участок',
    supplierType,
    roofParams: {
      area: toNumber(zone?.roofParams?.area, 0),
      perimeter: toNumber(zone?.roofParams?.perimeter, 0),
      parapetDrains: toNumber(zone?.roofParams?.parapetDrains, 0),
      innerDrains: toNumber(zone?.roofParams?.innerDrains, 0),
      aerators: toNumber(zone?.roofParams?.aerators, 0)
    },
    customParams: Array.isArray(zone?.customParams)
      ? zone.customParams.map(normalizeCustomParam)
      : [],
    templateMeta: zone?.templateMeta || null,
    sections: Array.isArray(zone?.sections) && zone.sections.length
      ? zone.sections.map((section) => normalizeSection(section, supplierType))
      : [createEmptySection()]
  }

  assignExcelCellCodesToSections(normalized.sections)
  return normalized
}

function normalizeEstimatePayload(payload) {
  return {
    projectName: payload?.projectName || 'Новый проект',
    vatRate: toNumber(payload?.vatRate, 22),
    estimateZones: Array.isArray(payload?.estimateZones) && payload.estimateZones.length
      ? payload.estimateZones.map(normalizeZone)
      : [createEmptyZone()],
    overheadExpenses: Array.isArray(payload?.overheadExpenses)
      ? payload.overheadExpenses.map((item) => ({
          id: item?.id || uuid(),
          name: item?.name || '',
          unit: item?.unit || 'шт',
          qty: toNumber(item?.qty, 0),
          price: toNumber(item?.price, 0)
        }))
      : []
  }
}

function buildScope(zone) {
  const scope = {
    S: toNumber(zone?.roofParams?.area, 0),
    P: toNumber(zone?.roofParams?.perimeter, 0),
    PD: toNumber(zone?.roofParams?.parapetDrains, 0),
    OD: toNumber(zone?.roofParams?.parapetDrains, 0),
    ID: toNumber(zone?.roofParams?.innerDrains, 0),
    A: toNumber(zone?.roofParams?.aerators, 0),
    roof_area: toNumber(zone?.roofParams?.area, 0),
    parapet_perimeter: toNumber(zone?.roofParams?.perimeter, 0),
    inner_drains_count: toNumber(zone?.roofParams?.innerDrains, 0),
    outer_drains_count: toNumber(zone?.roofParams?.parapetDrains, 0),
    aerators_count: toNumber(zone?.roofParams?.aerators, 0)
  }

  for (const [key, rawValue] of Object.entries(zone?.templateMeta?.paramValues || {})) {
    const number = Number(rawValue)
    if (Number.isFinite(number)) {
      scope[key] = number
    }
  }

  for (const param of zone?.customParams || []) {
    const symbol = `${param?.symbol || ''}`.trim()
    if (!symbol) continue
    scope[symbol] = toNumber(param?.value, 0)
  }

  return scope
}

function replaceCoefficients(expression, coefficientsDb) {
  return `${expression || ''}`.replace(/\[(.*?)\]/g, (_, coefficientName) => {
    const target = normalize(coefficientName)

    const found = (coefficientsDb || []).find((item) => {
      const name = normalize(item.name || item.название)
      const key = normalize(item.normalize_key || item.код || '')
      return name === target || key === target
    })

    return `${toNumber(found?.value ?? found?.значение ?? 1, 1)}`
  })
}

function normalizeExpression(expression) {
  return `${expression || ''}`
    .replace(/\bs\b/g, 'S')
    .replace(/\bp\b/g, 'P')
    .replace(/\bid\b/gi, 'ID')
    .replace(/\bod\b/gi, 'OD')
    .replace(/\bpd\b/gi, 'PD')
    .replace(/\ba\b/g, 'A')
    .trim()
}

function evaluateExpression(expression, zone, coefficientsDb, scope = null) {
  const expr = normalizeExpression(expression || '0')
  if (!expr) return 0

  const prepared = replaceCoefficients(expr, coefficientsDb)

  try {
    const value = evaluate(prepared, scope || buildScope(zone))
    return round3(value)
  } catch {
    return 0
  }
}

function getWorkPriceByArea(workRow, area) {
  const value = toNumber(area, 0)

  if (value <= 300) return toNumber(workRow?.цена_0_300, 0)
  if (value <= 600) return toNumber(workRow?.цена_300_600, 0)
  if (value <= 1000) return toNumber(workRow?.цена_600_1000, 0)
  if (value <= 3000) return toNumber(workRow?.цена_1000_3000, 0)
  if (value <= 6000) return toNumber(workRow?.цена_3000_6000, 0)
  if (value <= 15000) return toNumber(workRow?.цена_6000_15000, 0)
  if (value <= 30000) return toNumber(workRow?.цена_15000_30000, 0)
  return toNumber(workRow?.цена_более_30000, 0)
}

function resolveArrayItem(payload, items) {
  if (typeof payload === 'number') {
    return items[payload] || null
  }

  if (payload && items.includes(payload)) {
    return payload
  }

  if (payload?.item && items.includes(payload.item)) {
    return payload.item
  }

  if (payload?.row && items.includes(payload.row)) {
    return payload.row
  }

  if (payload?.id) {
    return items.find((item) => item.id === payload.id) || null
  }

  return null
}

function resolvePayloadValue(payload, row, fallbackKeys = []) {
  if (typeof payload === 'string') return payload
  if (typeof payload?.value === 'string') return payload.value

  for (const key of fallbackKeys) {
    if (typeof payload?.[key] === 'string') return payload[key]
  }

  for (const key of fallbackKeys) {
    if (typeof row?.[key] === 'string') return row[key]
  }

  return ''
}

function isReallyEmptyZone(zone) {
  if (!zone) return true

  const area = toNumber(zone?.roofParams?.area, 0)
  const perimeter = toNumber(zone?.roofParams?.perimeter, 0)
  const drains = toNumber(zone?.roofParams?.parapetDrains, 0)
  const innerDrains = toNumber(zone?.roofParams?.innerDrains, 0)
  const aerators = toNumber(zone?.roofParams?.aerators, 0)

  const hasItems = (zone.sections || []).some(
    (section) => (section.works || []).length > 0 || (section.materials || []).length > 0
  )

  return !hasItems && area === 0 && perimeter === 0 && drains === 0 && innerDrains === 0 && aerators === 0
}

export function useCalculatorFacade() {
  const projectName = ref('Новый проект')
  const vatRate = ref(22)

  const estimateZones = ref([createEmptyZone()])
  const overheadExpenses = ref([])

  const worksDb = ref([])
  const materialsDb = ref([])
  const formulasDb = ref([])
  const savedTemplatesDb = ref([])

  const coefficientsDbInternal = ref([])
  const savedProjectsInternal = ref([])

  const isTemplateDropdownOpen = ref(false)
  const dropdownRef = ref(null)

  let clickOutsideHandler = null

  async function loadDatabases() {
    const [catalogData, systems] = await Promise.all([
      getCatalogData(),
      listSystems()
    ])

    worksDb.value = catalogData.works.map(toLegacyWorkRow)
    materialsDb.value = catalogData.materials.map(toLegacyMaterialRow)
    formulasDb.value = catalogData.formulas.map(toLegacyFormulaRow)
    coefficientsDbInternal.value = catalogData.coefficients || []
    savedTemplatesDb.value = systems.map(toSystemListItem)

    if (!clickOutsideHandler) {
      clickOutsideHandler = (event) => {
        const root = dropdownRef.value
        if (!root) return
        if (!root.contains(event.target)) {
          isTemplateDropdownOpen.value = false
        }
      }

      document.addEventListener('click', clickOutsideHandler)
    }

    recalculateVolumes()
  }

  function unloadDatabases() {
    if (clickOutsideHandler) {
      document.removeEventListener('click', clickOutsideHandler)
      clickOutsideHandler = null
    }

    isTemplateDropdownOpen.value = false
  }

  async function selectTemplate(templateId) {
    const found = savedTemplatesDb.value.find(
      (item) => Number(item.идентификатор) === Number(templateId)
    )
    if (!found) return

    const fullSystemRaw = await getSystemTemplate(found.код || found.code)
    const systemView = toSystemTemplateView(fullSystemRaw)

    const selectedOptionKeys = (systemView?.опции || [])
      .filter((item) => item.default)
      .map((item) => item.key)

    const paramValues = Object.fromEntries(
      (systemView?.параметры || []).map((item) => [item.key, item.value])
    )

    const built = await buildEstimateFromSystem(
      systemView,
      selectedOptionKeys,
      paramValues
    )

    const incomingZones = normalizeEstimatePayload(built).estimateZones

    if (
      estimateZones.value.length === 1 &&
      isReallyEmptyZone(estimateZones.value[0])
    ) {
      estimateZones.value = incomingZones
    } else {
      estimateZones.value.push(...incomingZones)
    }

    isTemplateDropdownOpen.value = false
    recalculateVolumes()
  }

  function applySupplierToZone(zone) {
    for (const section of zone.sections || []) {
      for (const material of section.materials || []) {
        material.supplier = zone.supplierType || 'ТехноНИКОЛЬ'
      }
    }
  }

  function findWorkByName(name) {
    const target = normalize(name)
    if (!target) return null

    return (
      worksDb.value.find((item) => normalize(item.наименование_работы) === target) ||
      worksDb.value.find((item) => normalize(item.наименование_работы).includes(target)) ||
      worksDb.value.find((item) => target.includes(normalize(item.наименование_работы))) ||
      null
    )
  }

  function findMaterialByName(name) {
    const target = normalize(name)
    if (!target) return null

    return (
      materialsDb.value.find((item) => normalize(item.полное_наименование_материала) === target) ||
      materialsDb.value.find((item) => normalize(item.полное_наименование_материала).includes(target)) ||
      materialsDb.value.find((item) => target.includes(normalize(item.полное_наименование_материала))) ||
      null
    )
  }

  function findFormulaByName(name) {
    const target = normalize(name)
    if (!target) return null

    return (
      formulasDb.value.find((item) => normalize(item.название_формулы) === target) ||
      formulasDb.value.find((item) => normalize(item.код) === target) ||
      null
    )
  }

  function onWorkNameChange(payload, section, zone) {
    const row = resolveArrayItem(payload, section.works)
    if (!row) return

    const name = resolvePayloadValue(payload, row, ['name', 'workName', 'наименование_работы']) || row.name
    const found = findWorkByName(name)

    row.name = name

    if (found) {
      row.itemCode = found.идентификатор
      row.name = found.наименование_работы
      row.unit = found.единица_измерения_работы || row.unit
      row.price = getWorkPriceByArea(found, zone?.roofParams?.area)
    }

    recalculateVolumes()
  }

  function onMaterialNameChange(payload, section) {
    const row = resolveArrayItem(payload, section.materials)
    if (!row) return

    const name = resolvePayloadValue(payload, row, ['name', 'materialName', 'полное_наименование_материала']) || row.name
    const found = findMaterialByName(name)

    row.name = name

    if (found) {
      row.itemCode = found.артикул_товара || found.идентификатор
      row.name = found.полное_наименование_материала
      row.unit = found.единица_измерения || row.unit
      row.price = toNumber(found.базовая_цена, row.price)
    }

    recalculateVolumes()
  }

  function applyFormula(payload) {
    let row = null

    for (const zone of estimateZones.value) {
      for (const section of zone.sections || []) {
        row =
          resolveArrayItem(payload, section.works) ||
          resolveArrayItem(payload, section.materials)

        if (row) break
      }
      if (row) break
    }

    if (!row) {
      row = payload?.item || payload?.row || null
    }

    if (!row) return

    const formulaName =
      resolvePayloadValue(payload, row, ['formulaName', 'name', 'название_формулы']) ||
      row.formulaName

    const found = findFormulaByName(formulaName)

    row.formulaName = formulaName

    if (found) {
      row.formulaName = found.название_формулы
      row.expression = found.выражение || row.expression
    }

    recalculateVolumes()
  }

  function recalculateVolumes() {
    for (const zone of estimateZones.value) {
      assignExcelCellCodesToSections(zone.sections || [])
      applySupplierToZone(zone)
      const scope = buildScope(zone)

      for (const section of zone.sections || []) {
        for (const work of section.works || []) {
          work.qty = evaluateExpression(
            work.expression,
            zone,
            coefficientsDbInternal.value,
            scope
          )

          const found = findWorkByName(work.name)
          if (found) {
            work.price = getWorkPriceByArea(found, zone?.roofParams?.area)
          }

          work.total = round2(work.qty * toNumber(work.price, 0))

          const stableCode = `${work.code || work.cellCode || ''}`.trim()
          if (stableCode) {
            scope[stableCode] = toNumber(work.qty, 0)
          }

          if (work.templateCode) {
            scope[`${work.templateCode}`.trim().toUpperCase()] = toNumber(work.qty, 0)
          }
        }

        for (const material of section.materials || []) {
          material.qty = evaluateExpression(
            material.expression,
            zone,
            coefficientsDbInternal.value,
            scope
          )

          const found = findMaterialByName(material.name)
          if (found) {
            material.price = toNumber(found.базовая_цена, material.price)
          }

          material.total = round2(material.qty * toNumber(material.price, 0))

          const stableCode = `${material.code || material.cellCode || ''}`.trim()
          if (stableCode) {
            scope[stableCode] = toNumber(material.qty, 0)
          }

          if (material.templateCode) {
            scope[`${material.templateCode}`.trim().toUpperCase()] = toNumber(material.qty, 0)
          }
        }
      }
    }
  }

  async function saveProject() {
    const payload = {
      projectName: projectName.value || 'Новый проект',
      vatRate: toNumber(vatRate.value, 22),
      estimateZones: clone(estimateZones.value),
      overheadExpenses: clone(overheadExpenses.value)
    }

    const saved = await saveEstimateAction({
      title: payload.projectName,
      estimate: payload
    })

    if (saved?.id) {
      window.alert(`Проект сохранён. ID: ${saved.id}`)
    } else {
      window.alert('Проект сохранён.')
    }

    return saved
  }

  async function loadProject() {
    savedProjectsInternal.value = await listSavedEstimates()

    if (!savedProjectsInternal.value.length) {
      window.alert('Сохранённых проектов пока нет.')
      return
    }

    const promptText = savedProjectsInternal.value
      .map((item) => `${item.id} — ${item.title || 'Без названия'}`)
      .join('\n')

    const chosenId = window.prompt(`Введите ID проекта для загрузки:\n\n${promptText}`)
    if (!chosenId) return

    const loaded = await loadEstimateAction(Number(chosenId))
    if (!loaded?.estimate) {
      window.alert('Проект не найден.')
      return
    }

    const normalized = normalizeEstimatePayload(loaded.estimate)

    projectName.value = normalized.projectName
    vatRate.value = normalized.vatRate
    estimateZones.value = normalized.estimateZones
    overheadExpenses.value = normalized.overheadExpenses

    recalculateVolumes()
  }

  function addZone() {
    estimateZones.value.push(createEmptyZone(`Участок ${estimateZones.value.length + 1}`))
  }

  function removeZone(index) {
    estimateZones.value.splice(index, 1)

    if (!estimateZones.value.length) {
      estimateZones.value.push(createEmptyZone())
    }

    recalculateVolumes()
  }

  function addSection(zone) {
    zone.sections.push(createEmptySection(`Раздел ${zone.sections.length + 1}`))
  }

  function removeSection(zone, index) {
    zone.sections.splice(index, 1)

    if (!zone.sections.length) {
      zone.sections.push(createEmptySection())
    }

    recalculateVolumes()
  }

  function addWork(section, zone = null) {
    const item = createEmptyWork()
    item.code = nextExcelCellCodeForSections(zone?.sections || [section])
    item.cellCode = item.code
    section.works.push(item)
  }

  function addMaterial(section, zone) {
    const item = createEmptyMaterial(zone?.supplierType || 'ТехноНИКОЛЬ')
    item.code = nextExcelCellCodeForSections(zone?.sections || [section])
    item.cellCode = item.code
    section.materials.push(item)
  }

  function addExpense() {
    overheadExpenses.value.push(createEmptyExpense())
  }

  function addCustomParam(zone) {
    const name = window.prompt('Название переменной:', 'Новая переменная')
    if (!name) return

    const symbol = window.prompt('Символ для формулы:', 'X')
    if (!symbol) return

    zone.customParams.push({
      name: name.trim(),
      symbol: symbol.trim(),
      value: 0
    })

    recalculateVolumes()
  }

  function getSectionTotal(section) {
    const worksTotal = (section.works || []).reduce(
      (sum, item) => sum + round2(item.qty * item.price),
      0
    )

    const materialsTotal = (section.materials || []).reduce(
      (sum, item) => sum + round2(item.qty * item.price),
      0
    )

    return round2(worksTotal + materialsTotal)
  }

  const globalRoofParams = computed(() => {
    return estimateZones.value.reduce(
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
  })

  const grandTotalWorks = computed(() => {
    return round2(
      estimateZones.value.reduce((sum, zone) => {
        return (
          sum +
          (zone.sections || []).reduce((sectionSum, section) => {
            return (
              sectionSum +
              (section.works || []).reduce(
                (workSum, item) => workSum + round2(item.qty * item.price),
                0
              )
            )
          }, 0)
        )
      }, 0)
    )
  })

  const grandTotalMaterials = computed(() => {
    return round2(
      estimateZones.value.reduce((sum, zone) => {
        return (
          sum +
          (zone.sections || []).reduce((sectionSum, section) => {
            return (
              sectionSum +
              (section.materials || []).reduce(
                (matSum, item) => matSum + round2(item.qty * item.price),
                0
              )
            )
          }, 0)
        )
      }, 0)
    )
  })

  const totalExpenses = computed(() => {
    return round2(
      overheadExpenses.value.reduce(
        (sum, item) => sum + toNumber(item.qty, 0) * toNumber(item.price, 0),
        0
      )
    )
  })

  const subTotalWithoutVat = computed(() => {
    return round2(
      grandTotalWorks.value + grandTotalMaterials.value + totalExpenses.value
    )
  })

  const vatAmount = computed(() => {
    return round2(subTotalWithoutVat.value * (toNumber(vatRate.value, 0) / 100))
  })

  const finalGrandTotalWithVat = computed(() => {
    return round2(subTotalWithoutVat.value + vatAmount.value)
  })

  function printEstimate() {
    window.print()
  }

  return {
    projectName,
    vatRate,
    estimateZones,
    overheadExpenses,

    worksDb,
    materialsDb,
    formulasDb,
    savedTemplatesDb,

    isTemplateDropdownOpen,
    dropdownRef,

    selectTemplate,
    applySupplierToZone,

    globalRoofParams,

    loadDatabases,
    unloadDatabases,

    onWorkNameChange,
    onMaterialNameChange,
    applyFormula,
    recalculateVolumes,

    saveProject,
    loadProject,

    addZone,
    removeZone,
    addSection,
    removeSection,
    addWork,
    addMaterial,
    addExpense,
    addCustomParam,

    getSectionTotal,

    grandTotalWorks,
    grandTotalMaterials,
    totalExpenses,
    subTotalWithoutVat,
    vatAmount,
    finalGrandTotalWithVat,

    printEstimate
  }
}