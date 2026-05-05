import { ref, computed } from 'vue'
import { evaluate } from 'mathjs'

import { getCatalogData } from '@/core/services/dataApi'
import { saveWork as saveWorkAction } from '@/core/services/dataApi'
import { saveEstimate as saveEstimateAction } from '@/core/services/dataApi'
import { loadEstimate as loadEstimateAction } from '@/core/services/dataApi'
import { listSavedEstimates } from '@/core/services/dataApi'
import { listSystems } from '@/core/services/dataApi'
import { getSystemTemplate } from '@/core/services/dataApi'

import { buildEstimateFromSystem } from '@/modules/templates/buildEstimate'
import { assignExcelCellCodesToSections, nextExcelCellCodeForSections } from '@/core/utils/excelCellCodes'
import {
  toLegacyMaterialRow,
  toLegacyWorkRow
} from '@/core/adapters/viewAdapters'
import {
  toSystemListItem,
  toSystemTemplateView
} from '@/core/adapters/viewAdapters'
import { createSmartPirReportSession } from '@/core/report/smartPirReport'
import { exportSmartPirReportXlsx } from '@/core/report/smartPirReportXlsx'
import { DEFAULT_CONTRACTOR_PROFILE_ID } from '@/core/report/contractorProfiles'
import { saveBinaryFile } from '@/core/utils/binaryFileExport'

const PROJECT_FILE_MIME = 'application/json'
const PROJECT_FILE_EXTENSION = 'roofcalc'
const DEFAULT_OVERHEAD_EXPENSES = [
  { name: 'Вывоз мусора', unit: 'рейс', qty: 1, price: 12800 },
  { name: 'Кран', unit: 'смена', qty: 1, price: 44000 },
  { name: 'Манипулятор', unit: 'смена', qty: 1, price: 28000 },
  { name: 'Организационные и транспортные расходы', unit: 'ед', qty: 1, price: 564000 },
  { name: 'Утилизация и вывоз мусора', unit: 'ед', qty: 1, price: 15000 }
]

function uuid() {
  return crypto.randomUUID()
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function sanitizeProjectFileName(value) {
  const prepared = `${value || 'Новый проект'}`
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()

  return prepared || 'Новый проект'
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

function equalsNormalized(left, right) {
  return normalize(left) === normalize(right)
}

function round3(value) {
  return Math.round(toNumber(value) * 1000) / 1000
}

function round2(value) {
  return Math.round(toNumber(value) * 100) / 100
}

const EXTRA_SCOPE_PARAMS = [
  ['SB', ['concrete_area']],
  ['PS', ['parapet_perimeter_sandwich']],
  ['PB', ['parapet_perimeter_concrete']],
  ['CS', ['cornice_length']],
  ['K', ['counter_slope_area']],
  ['ODL', ['outer_drain_length']],
  ['IC', ['anti_icing_cable_length']],
  ['WL', ['walkways_length']],
  ['WPC', ['walkways_count']],
  ['D', ['deformation_joint_length']],
  ['FW', ['fachwerk_count']],
  ['SH', ['smoke_hatches_count', 'smoke_hatch_count']],
  ['NG', ['noncombustible_fill_area', 'fire_break_area']],
  ['OV', ['ov_count']],
  ['VK', ['vk_count']],
  ['VKL', ['vk_length']],
  ['PDL', ['pedestal_perimeter']],
  ['PDC', ['pedestal_count']],
  ['AI', ['air_intake_count']],
  ['VF', ['fan_count']],
  ['EX', ['exhaust_count']],
  ['AC', ['condenser_support_count', 'ac_stand_count']],
  ['CG', ['cable_gooseneck_count']],
  ['PT', ['pass_through_count', 'pass_general_count']],
  ['PTS', ['pass_through_small_count', 'pass_small_count']],
  ['PTM', ['pass_through_medium_count', 'pass_medium_count']],
  ['VS', ['vent_shaft_perimeter']],
  ['GR', ['guardrail_length']],
  ['GRC', ['guardrail_post_count']],
  ['SC', ['screed_area']],
  ['PA', ['primer_area']],
  ['WZA', ['wind_zone_area']],
  ['RB', ['base_profile_rib_fill_length', 'corrugation_fill_length']],
  ['LP', ['l_profile_length']],
  ['RU', ['ridge_reinforcement_length']],
  ['DFP', ['def_joint_profile_length']],
  ['CF', ['corrugation_fill_length', 'base_profile_rib_fill_length']],
  ['DR', ['inner_drain_reinforcement_count', 'inner_drains_count']]
]

function resolveParamValue(paramValues, keys = [], fallback = 0) {
  for (const key of keys) {
    const value = toNumber(paramValues?.[key], NaN)
    if (Number.isFinite(value)) return value
  }

  return fallback
}

function isDrainIdentity(identity = '') {
  return (
    identity.includes('ворон') ||
    identity.includes('водоприем') ||
    identity.includes('водоприём') ||
    identity.includes('водоотвед') ||
    identity.includes('водосточ') ||
    identity.includes('drain')
  )
}

function isOuterDrainIdentity(identity = '') {
  return isDrainIdentity(identity) && (
    identity.includes('наруж') ||
    identity.includes('внеш') ||
    identity.includes('парапет') ||
    identity.includes('outer')
  )
}

function isCounterSlopeIdentity(identity = '') {
  return (
    identity.includes('контруклон') ||
    identity.includes('уклонообраз') ||
    identity.includes('разуклон') ||
    identity.includes('slope')
  )
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

function createEmptyMaterial() {
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

function createDefaultOverheadExpenses() {
  return DEFAULT_OVERHEAD_EXPENSES.map((item) => ({
    id: uuid(),
    ...item
  }))
}

function resetMaterialLookup(row) {
  row.itemCode = ''
  row.material_id = null
  row.base_name = ''
  row.variant_id = null
  row.variant_label = ''
  row.selectedVariantId = null
  row.selectedProfileVariantId = null
  row.profile_name = ''
  row.profileThickness = null
  row.thickness = null
  row.thickness_unit = ''
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
    manualQty: Boolean(item?.manualQty),
    expression: normalizeCleanWorkExpression(item?.expression || 'S'),
    qty: toNumber(item?.qty, 0),
    price: toNumber(item?.price, 0),
    total: round2((toNumber(item?.qty, 0)) * (toNumber(item?.price, 0)))
  }
}

function normalizeCleanWorkExpression(expression) {
  const normalized = normalizeExpression(expression || 'S')
  const compact = normalized.replace(/\s+/g, '').toUpperCase()

  if (compact === 'S+(P*0.15)' || compact === 'S+P*0.15' || compact === 'S+(P*0.2)' || compact === 'S+P*0.2') {
    return 'S'
  }

  return normalized
}

function normalizeMaterialItem(item) {
  return {
    id: item?.id || uuid(),
    code: item?.code || '',
    cellCode: item?.cellCode || '',
    templateCode: item?.templateCode || '',
    itemCode: item?.itemCode || '',
    material_id: item?.material_id ?? null,
    base_name: item?.base_name || '',
    variant_id: item?.variant_id ?? null,
    variant_label: item?.variant_label || '',
    selectedVariantId: item?.selectedVariantId ?? null,
    selectedProfileVariantId: item?.selectedProfileVariantId ?? null,
    profile_name: item?.profile_name || '',
    profileThickness: item?.profileThickness ?? null,
    thickness: item?.thickness ?? null,
    thickness_unit: item?.thickness_unit || '',
    name: item?.name || '',
    unit: item?.unit || 'м2',
    formulaName: item?.formulaName || '',
    expression: item?.expression || 'S',
    qty: toNumber(item?.qty, 0),
    price: toNumber(item?.price, 0),
    total: round2((toNumber(item?.qty, 0)) * (toNumber(item?.price, 0)))
  }
}

function normalizeSection(section) {
  return {
    id: section?.id || uuid(),
    title: section?.title || 'Раздел',
    works: Array.isArray(section?.works) ? section.works.map(normalizeWorkItem) : [],
    materials: Array.isArray(section?.materials) ? section.materials.map(normalizeMaterialItem) : []
  }
}

function normalizeZone(zone) {
  const normalized = {
    id: zone?.id || uuid(),
    name: zone?.name || 'Участок',
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
      ? zone.sections.map(normalizeSection)
      : [createEmptySection()]
  }

  assignExcelCellCodesToSections(normalized.sections)
  return normalized
}

function normalizeEstimatePayload(payload) {
  return {
    projectName: payload?.projectName || 'Новый проект',
    contractorProfile: payload?.contractorProfile || DEFAULT_CONTRACTOR_PROFILE_ID,
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
      : createDefaultOverheadExpenses()
  }
}

function buildScope(zone) {
  const paramValues = zone?.templateMeta?.paramValues || {}
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

  for (const [key, rawValue] of Object.entries(paramValues)) {
    const number = Number(rawValue)
    if (Number.isFinite(number)) {
      scope[key] = number
    }
  }

  for (const [symbol, keys] of EXTRA_SCOPE_PARAMS) {
    scope[symbol] = resolveParamValue(paramValues, keys, toNumber(scope[symbol], 0))
  }

  scope.DR = resolveParamValue(paramValues, ['inner_drain_reinforcement_count'], scope.ID)

  for (const param of zone?.customParams || []) {
    const symbol = `${param?.symbol || ''}`.trim()
    if (!symbol) continue
    scope[symbol] = toNumber(param?.value, 0)
  }

  scope.S = toNumber(zone?.roofParams?.area, 0)
  scope.P = toNumber(zone?.roofParams?.perimeter, 0)
  scope.PD = toNumber(zone?.roofParams?.parapetDrains, 0)
  scope.OD = toNumber(zone?.roofParams?.parapetDrains, 0)
  scope.ID = toNumber(zone?.roofParams?.innerDrains, 0)
  scope.A = toNumber(zone?.roofParams?.aerators, 0)
  scope.roof_area = scope.S
  scope.parapet_perimeter = scope.P
  scope.inner_drains_count = scope.ID
  scope.outer_drains_count = scope.OD
  scope.aerators_count = scope.A

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
  const context = injectMissingCellRefs(prepared, scope || buildScope(zone))

  try {
    const value = evaluate(prepared, context)
    return round3(value)
  } catch {
    return 0
  }
}

function injectMissingCellRefs(expression, scope = {}) {
  const context = { ...(scope || {}) }
  const refs = `${expression || ''}`.match(/\b[A-Z]+[1-9]\d*\b/g) || []

  for (const ref of refs) {
    if (!Object.prototype.hasOwnProperty.call(context, ref)) {
      context[ref] = 0
    }
  }

  return context
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

function inferWorkExpression(workRow, section = null) {
  const name = normalize(workRow?.наименование_работы || '')
  const unit = normalize(workRow?.единица_измерения_работы || '')
  const sectionTitle = normalize(section?.title || '')
  const identity = `${name} ${sectionTitle}`

  if (identity.includes('аэратор')) return 'A'
  if (isOuterDrainIdentity(identity)) return 'OD'
  if (isDrainIdentity(identity)) return 'ID'
  if (isCounterSlopeIdentity(identity)) return 'K'
  if (identity.includes('l-образ') || identity.includes('l образ')) return 'LP'
  if (identity.includes('профил') && (identity.includes('усилен') || identity.includes('ендов') || identity.includes('коньк'))) return 'RU'
  if (identity.includes('гофр')) return 'CF'
  if (identity.includes('пешеход') || identity.includes('дорож')) return 'WL'
  if (identity.includes('деформац')) return 'D'
  if (identity.includes('огражден')) return 'GR'
  if (identity.includes('фахвер')) return 'FW'
  if (identity.includes('дым')) return 'SH'
  if (identity.includes('вентшах')) return 'VS'
  if (identity.includes('проходк')) return 'PT'

  if (
    unit.includes('м/п') ||
    unit.includes('п.м') ||
    unit === 'м' ||
    identity.includes('парапет') ||
    identity.includes('примыкан') ||
    identity.includes('планк')
  ) {
    return 'P'
  }

  if (unit.includes('шт')) return '1'
  return 'S'
}

function isCountBasedWork(work, section = null) {
  const identity = normalize(`${work?.name || work?.наименование_работы || ''} ${section?.title || ''}`)
  return identity.includes('аэратор') || isDrainIdentity(identity)
}

function repairWorkExpressionIfNeeded(work, section = null) {
  const expression = normalize(work?.expression)
  if (!work || work.manualQty || !isCountBasedWork(work, section)) {
    return
  }

  if (['', '0', '1', 's', 'area', 'шт', 'ед', 'м2', 'м²'].includes(expression)) {
    work.expression = inferWorkExpression({
      наименование_работы: work.name,
      единица_измерения_работы: work.unit
    }, section)
  }
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

export function useCalculator() {
  const projectName = ref('Новый проект')
  const contractorProfile = ref(DEFAULT_CONTRACTOR_PROFILE_ID)
  const vatRate = ref(22)

  const estimateZones = ref([createEmptyZone()])
  const overheadExpenses = ref(createDefaultOverheadExpenses())

  const worksDb = ref([])
  const materialsDb = ref([])
  const formulasDb = ref([])
  const savedTemplatesDb = ref([])

  const coefficientsDbInternal = ref([])
  const savedProjectsInternal = ref([])

  const isTemplateDropdownOpen = ref(false)
  const dropdownRef = ref(null)

  let clickOutsideHandler = null

  function showActionError(message, error) {
    console.error(error)
    window.alert(message)
  }

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
    try {
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
    } catch (error) {
      showActionError('Не удалось добавить готовую систему в смету.', error)
    }
  }

  function findWorkByName(name) {
    const target = normalize(name)
    if (!target) return null

    return (
      worksDb.value.find((item) => equalsNormalized(item.наименование_работы, target)) ||
      null
    )
  }

  function findWorkFromPayload(payload, fallbackName = '') {
    const selected = payload?.selected || null
    const selectedId = selected?.id || selected?.идентификатор || null
    if (selectedId) {
      const foundById = worksDb.value.find((item) => Number(item.идентификатор) === Number(selectedId))
      if (foundById) return foundById
    }

    return findWorkByName(selected?.name || selected?.наименование_работы || fallbackName)
  }

  async function createCustomWorkInCatalog(row, section, zone) {
    const name = `${row?.name || ''}`.trim()
    if (!name) return null

    const existing = findWorkByName(name)
    if (existing) return existing

    const price = toNumber(row?.price, 0)
    const payload = {
      category: section?.title || 'Пользовательские работы',
      name,
      unit: row?.unit || 'м2',
      notes: 'Добавлено автоматически из инженерной сметы.',
      price_tiers: [
        { area_from: 0, area_to: 300, price },
        { area_from: 300, area_to: 600, price },
        { area_from: 600, area_to: 1000, price },
        { area_from: 1000, area_to: 3000, price },
        { area_from: 3000, area_to: 6000, price },
        { area_from: 6000, area_to: 15000, price },
        { area_from: 15000, area_to: 30000, price },
        { area_from: 30000, area_to: null, price }
      ]
    }

    try {
      const created = await saveWorkAction(payload)
      const legacy = toLegacyWorkRow(created)
      const existsById = worksDb.value.some(
        (item) => Number(item.идентификатор) === Number(legacy.идентификатор)
      )

      if (!existsById) {
        worksDb.value.push(legacy)
      }

      return legacy
    } catch (error) {
      console.warn('Не удалось автоматически добавить работу в справочник.', error)
      await loadDatabases()
      return findWorkByName(name)
    }
  }

  function findMaterialByName(name) {
    const target = normalize(name)
    if (!target) return null

    return (
      materialsDb.value.find((item) => equalsNormalized(item.полное_наименование_материала, target)) ||
      null
    )
  }

  function findMaterialByPatterns(patterns = []) {
    const normalizedPatterns = patterns.map(normalize).filter(Boolean)
    if (!normalizedPatterns.length) return null

    return materialsDb.value.find((item) => {
      const title = normalize(`${item.полное_наименование_материала || ''} ${item.базовое_наименование || ''}`)
      return normalizedPatterns.every((pattern) => title.includes(pattern))
    }) || null
  }

  function createMaterialFromCatalog(material, { name = '', expression = '0', unit = '' } = {}) {
    return {
      ...createEmptyMaterial(),
      itemCode: material?.артикул_товара || material?.идентификатор || '',
      material_id: material?.идентификатор || null,
      base_name: material?.базовое_наименование || name,
      name: material?.полное_наименование_материала || name,
      unit: material?.единица_измерения || unit || 'шт',
      expression,
      price: toNumber(material?.базовая_цена, 0)
    }
  }

  function addMaterialByPatterns(section, zone, patterns, fallback) {
    const material = findMaterialByPatterns(patterns)
    const name = material?.полное_наименование_материала || fallback.name
    const exists = (section.materials || []).some((item) => equalsNormalized(item.name, name))

    if (exists) return

    const item = createMaterialFromCatalog(material, {
      name,
      expression: fallback.expression,
      unit: fallback.unit
    })
    item.code = nextExcelCellCodeForSections(zone?.sections || [section])
    item.cellCode = item.code
    section.materials.push(item)
  }

  function isProflistZone(zone) {
    const metaText = normalize(`${zone?.templateMeta?.systemCode || ''} ${zone?.templateMeta?.paramValues?.base_profile || ''}`)
    const sectionText = normalize((zone?.sections || []).map((section) => section.title).join(' '))
    const materialText = normalize((zone?.sections || []).flatMap((section) => section.materials || []).map((item) => item.name).join(' '))
    return metaText.includes('proflist') || metaText.includes('проф') || sectionText.includes('профлист') || materialText.includes('профлист')
  }

  function addCompanionMaterialsForWork(work, section, zone) {
    const identity = normalize(`${work?.name || ''} ${section?.title || ''}`)

    if (identity.includes('аэратор')) {
      addMaterialByPatterns(section, zone, ['кровельный', 'аэратор'], {
        name: 'Кровельный аэратор',
        expression: 'A',
        unit: 'шт'
      })
      return
    }

    if (isDrainIdentity(identity)) {
      const isOuter = isOuterDrainIdentity(identity)
      addMaterialByPatterns(
        section,
        zone,
        isOuter ? ['парапетная', 'воронка'] : ['воронка', 'водосточная'],
        {
          name: isOuter ? 'Парапетная воронка 100*100 мм с листоуловителем' : 'Воронка водосточная ТехноНИКОЛЬ 110*720 с обогревом',
          expression: isOuter ? 'OD' : 'ID',
          unit: 'шт'
        }
      )

      if (!isOuter && isProflistZone(zone)) {
        addMaterialByPatterns(section, zone, ['оцинкованный', 'лист'], {
          name: 'Оцинкованный лист, толщ. 0,7 мм, 600*600 мм',
          expression: 'ID',
          unit: 'шт'
        })
        addMaterialByPatterns(section, zone, ['ng'], {
          name: 'NG',
          expression: 'ID * 0.25',
          unit: 'м2'
        })
      }
      return
    }

    if (identity.includes('l-образ') || identity.includes('l образ')) {
      addMaterialByPatterns(section, zone, ['l-образный', 'профиль'], {
        name: 'L-образный профиль',
        expression: work.expression || 'LP',
        unit: 'м/п'
      })
      return
    }

    if (identity.includes('профил') && (identity.includes('усилен') || identity.includes('ендов') || identity.includes('коньк'))) {
      addMaterialByPatterns(section, zone, ['профиль', 'усиления'], {
        name: 'Профиль усиления (коньковые усиления, усиления ендов)',
        expression: work.expression || 'RU',
        unit: 'м/п'
      })
      return
    }

    if (identity.includes('гофр') && (identity.includes('нг') || identity.includes('негорюч'))) {
      addMaterialByPatterns(section, zone, ['ng'], {
        name: 'NG',
        expression: work.expression ? `(${work.expression}) * 0.25` : 'CF * 0.25',
        unit: 'м2'
      })
    }
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

  async function onWorkNameChange(payload, section, zone) {
    const row = resolveArrayItem(payload, section.works)
    if (!row) return

    const name = resolvePayloadValue(payload, row, ['name', 'workName', 'наименование_работы']) || row.name
    const previousItemCode = `${row.itemCode || ''}`
    const found = findWorkFromPayload(payload, name)
    const shouldUpdateExpression = Boolean(payload?.selected) || `${found?.идентификатор || ''}` !== previousItemCode

    row.name = name

    if (found) {
      row.itemCode = found.идентификатор
      row.name = found.наименование_работы
      row.unit = found.единица_измерения_работы || row.unit
      row.price = getWorkPriceByArea(found, zone?.roofParams?.area)
      if (shouldUpdateExpression) {
        row.manualQty = false
        row.expression = inferWorkExpression(found, section)
      }
      addCompanionMaterialsForWork(row, section, zone)
    } else {
      const created = await createCustomWorkInCatalog(row, section, zone)
      row.itemCode = created?.идентификатор || ''
      if (created) {
        row.unit = created.единица_измерения_работы || row.unit
        row.price = row.price || getWorkPriceByArea(created, zone?.roofParams?.area)
      }

      if (isCountBasedWork(row, section)) {
        row.manualQty = false
        row.expression = inferWorkExpression({
          наименование_работы: row.name,
          единица_измерения_работы: row.unit
        }, section)
        addCompanionMaterialsForWork(row, section, zone)
      }
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
    } else {
      resetMaterialLookup(row)
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
      const scope = buildScope(zone)

      for (const section of zone.sections || []) {
        for (const work of section.works || []) {
          repairWorkExpressionIfNeeded(work, section)

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
    try {
      const payload = {
        projectName: projectName.value || 'Новый проект',
        contractorProfile: contractorProfile.value || DEFAULT_CONTRACTOR_PROFILE_ID,
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
    } catch (error) {
      showActionError('Не удалось сохранить проект.', error)
      return null
    }
  }

  async function getSavedProjects() {
    savedProjectsInternal.value = await listSavedEstimates()
    return clone(savedProjectsInternal.value)
  }

  async function loadProjectById(projectId) {
    const loaded = await loadEstimateAction(Number(projectId))
    if (!loaded?.estimate) {
      throw new Error('Проект не найден.')
    }

    return restoreProjectPayload(loaded.estimate)
  }

  async function loadProject() {
    try {
      const projects = await getSavedProjects()

      if (!projects.length) {
        window.alert('Сохранённых проектов пока нет.')
        return
      }

      const promptText = projects
        .map((item, index) => `${index + 1}. ID ${item.id} — ${item.title || 'Без названия'}`)
        .join('\n')

      const chosenValue = window.prompt(
        `Выберите сохранённый проект.\nВведите номер строки слева или ID проекта:\n\n${promptText}`
      )
      if (!chosenValue) return

      const chosenNumber = Number(`${chosenValue}`.trim())
      const byIndex = Number.isInteger(chosenNumber)
        ? projects[chosenNumber - 1]
        : null
      const byId = projects.find((item) => Number(item.id) === chosenNumber)
      const chosenProject = byIndex || byId

      if (!chosenProject?.id) {
        window.alert('Не нашёл такой проект. Введите номер из списка или ID.')
        return
      }

      const normalized = await loadProjectById(chosenProject.id)
      window.alert(`Загружен проект: ${normalized.projectName}`)
    } catch (error) {
      showActionError('Не удалось загрузить проект.', error)
    }
  }

  function getCurrentEditableProjectPayload() {
    recalculateVolumes()

    return {
      projectName: projectName.value || 'Новый проект',
      contractorProfile: contractorProfile.value || DEFAULT_CONTRACTOR_PROFILE_ID,
      vatRate: toNumber(vatRate.value, 22),
      estimateZones: clone(estimateZones.value),
      overheadExpenses: clone(overheadExpenses.value)
    }
  }

  function restoreProjectPayload(payload) {
    const normalized = normalizeEstimatePayload(payload)

    projectName.value = normalized.projectName
    contractorProfile.value = normalized.contractorProfile
    vatRate.value = normalized.vatRate
    estimateZones.value = normalized.estimateZones
    overheadExpenses.value = normalized.overheadExpenses

    recalculateVolumes()
    return normalized
  }

  async function exportProjectFile() {
    try {
      const payload = {
        app: 'RoofCalc',
        fileType: 'editable-estimate',
        version: 1,
        exportedAt: new Date().toISOString(),
        estimate: getCurrentEditableProjectPayload()
      }

      const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2))
      const fileName = `${sanitizeProjectFileName(payload.estimate.projectName)}.${PROJECT_FILE_EXTENSION}`
      const savedPath = await saveBinaryFile({
        bytes,
        fileName,
        mimeType: PROJECT_FILE_MIME
      })

      return savedPath
    } catch (error) {
      showActionError('Не удалось сохранить расчёт файлом.', error)
      return null
    }
  }

  async function importProjectFile(file) {
    try {
      if (!file) return null

      const raw = await file.text()
      const parsed = JSON.parse(raw)
      const normalized = restoreProjectPayload(parsed?.estimate || parsed)
      return normalized.projectName
    } catch (error) {
      showActionError('Не удалось открыть файл расчёта. Проверьте, что выбран файл .roofcalc.', error)
      return null
    }
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

  function addMaterial(section, zone = null) {
    const item = createEmptyMaterial()
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

  function getCurrentReportPayload() {
    recalculateVolumes()

    return {
      projectName: projectName.value,
      contractorProfile: contractorProfile.value || DEFAULT_CONTRACTOR_PROFILE_ID,
      vatRate: vatRate.value,
      estimateZones: clone(estimateZones.value),
      overheadExpenses: clone(overheadExpenses.value),
      coefficients: clone(coefficientsDbInternal.value)
    }
  }

  function createReport() {
    return createSmartPirReportSession(getCurrentReportPayload())
  }

  async function exportReportXlsx() {
    return exportSmartPirReportXlsx(getCurrentReportPayload())
  }

  function printEstimate() {
    window.print()
  }

  return {
    projectName,
    contractorProfile,
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

    globalRoofParams,

    loadDatabases,
    unloadDatabases,

    onWorkNameChange,
    onMaterialNameChange,
    applyFormula,
    recalculateVolumes,

    saveProject,
    loadProject,
    getSavedProjects,
    loadProjectById,
    getCurrentEditableProjectPayload,
    restoreProjectPayload,
    exportProjectFile,
    importProjectFile,

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

    createReport,
    exportReportXlsx,
    printEstimate
  }
}
