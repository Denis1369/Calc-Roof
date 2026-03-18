import { evaluate } from 'mathjs'
import { getCatalogData } from '../application/catalog/getCatalogData'
import {
  toLegacyMaterialRow,
  toLegacyWorkRow
} from '../shared/adapters/catalogViewAdapters'

const PENDING_ESTIMATE_KEY = 'eco-roof-pending-estimate'

export function storePendingGeneratedEstimate(payload) {
  sessionStorage.setItem(PENDING_ESTIMATE_KEY, JSON.stringify(payload))
}

export function applyPendingGeneratedEstimate({ projectName, vatRate, estimateZones, recalculateVolumes }) {
  const raw = sessionStorage.getItem(PENDING_ESTIMATE_KEY)
  if (!raw) return false

  try {
    const parsed = JSON.parse(raw)

    if (parsed.projectName !== undefined) {
      setMaybeRef(projectName, parsed.projectName)
    }

    if (parsed.vatRate !== undefined) {
      setMaybeRef(vatRate, parsed.vatRate)
    }

    if (Array.isArray(parsed.estimateZones)) {
      replaceMaybeRefArray(estimateZones, parsed.estimateZones)
    }

    sessionStorage.removeItem(PENDING_ESTIMATE_KEY)

    if (typeof recalculateVolumes === 'function') {
      recalculateVolumes()
    }

    return true
  } catch {
    sessionStorage.removeItem(PENDING_ESTIMATE_KEY)
    return false
  }
}

export async function buildEstimateFromSystem(system, selectedKeys = [], paramValues = {}) {
  const data = await getCatalogData()

  const worksDb = data.works.map(toLegacyWorkRow)
  const materialsDb = data.materials.map(toLegacyMaterialRow)
  const coefficientsDb = data.coefficients || []
  const formulasDb = data.formulas || []

  const fullSystem = system?.raw || system
  if (!fullSystem) {
    throw new Error('System is required')
  }

  const mergedParams = buildMergedParamValues(system, paramValues)
  const scope = createScope(mergedParams)
  const selectedSet = new Set(selectedKeys)

  const formulasMap = new Map(
    formulasDb.map((formula) => [formula.code, formula.expression || ''])
  )

  const sections = buildSections({
    system: fullSystem,
    selectedSet,
    paramValues: mergedParams,
    scope,
    worksDb,
    materialsDb,
    coefficientsDb,
    formulasMap
  })

  return {
    projectName: fullSystem.name || fullSystem.название || 'Смета',
    vatRate: 20,
    estimateZones: [
      {
        id: crypto.randomUUID(),
        name: `Монтаж системы: ${fullSystem.name || fullSystem.название || 'Система'}`,
        supplierType: 'ТехноНИКОЛЬ',
        roofParams: {
          area: scope.S,
          perimeter: scope.P,
          parapetDrains: scope.OD,
          innerDrains: scope.ID,
          aerators: scope.A
        },
        customParams: buildCustomParams(scope),
        templateMeta: {
          systemCode: fullSystem.code || fullSystem.код || '',
          selectedKeys: [...selectedKeys],
          paramValues: { ...mergedParams }
        },
        sections
      }
    ]
  }
}

function buildMergedParamValues(system, paramValues) {
  const result = {}
  const params = Array.isArray(system?.параметры) ? system.параметры : []

  for (const param of params) {
    result[param.key] = param.value
  }

  return {
    ...result,
    ...paramValues
  }
}

function buildSections({
  system,
  selectedSet,
  paramValues,
  scope,
  worksDb,
  materialsDb,
  coefficientsDb,
  formulasMap
}) {
  const layers = Array.isArray(system.layers)
    ? system.layers
    : Array.isArray(system.слои)
      ? system.слои
      : []

  const activeLayers = layers.filter((layer) => {
    if (!layer.feature_code) {
      return true
    }

    return selectedSet.has(layer.feature_code)
  })

  return activeLayers.map((layer) => {
    const works = (layer.work_links || [])
      .map((link) =>
        createWorkItem({
          link,
          worksDb,
          scope,
          formulasMap
        })
      )
      .filter(Boolean)

    const materials = (layer.material_options || [])
      .map((option) =>
        createMaterialItem({
          option,
          layer,
          system,
          paramValues,
          scope,
          materialsDb,
          coefficientsDb,
          formulasMap
        })
      )
      .filter(Boolean)

    return {
      id: crypto.randomUUID(),
      title: layer.name || 'Раздел',
      works,
      materials
    }
  })
}

function createWorkItem({ link, worksDb, scope, formulasMap }) {
  const found = findWorkRow(worksDb, {
    id: link.work_id,
    name: link.work_name
  })

  const expression = normalizeExpression(
    link.default_expression ||
      link.formula_expression ||
      formulasMap.get(link.formula_code) ||
      inferFallbackExpressionForWork(link)
  )

  return {
    id: crypto.randomUUID(),
    code: found?.идентификатор || link.work_id || '',
    name: found?.наименование_работы || link.work_name || 'Работа',
    unit: found?.единица_измерения_работы || link.work_unit || '',
    expression,
    qty: evaluateQty(expression, scope, []),
    price: found ? pickWorkPriceByArea(found, scope.S) : 0,
    total: 0
  }
}

function createMaterialItem({
  option,
  layer,
  system,
  paramValues,
  scope,
  materialsDb,
  coefficientsDb,
  formulasMap
}) {
  const found = findMaterialRow(materialsDb, {
    id: option.material_id,
    name: option.material_display_name || option.material_base_name
  })

  const expression = normalizeExpression(
    resolveMaterialExpression({
      option,
      layer,
      system,
      paramValues,
      formulasMap
    })
  )

  const qty = evaluateQty(expression, scope, coefficientsDb)
  const isProfileSheet = normalize(option.material_base_name || option.material_display_name).includes('профилированный лист')
  const profileName = `${paramValues.base_profile || ''}`.trim()
  const profileThickness = toNumber(paramValues.base_profile_thickness || 0.8)
  const displayName = isProfileSheet
    ? `Профлист ${profileName || option.material_display_name || option.material_base_name || ''}`.trim()
    : (found?.полное_наименование_материала || option.material_display_name || option.material_base_name || 'Материал')

  return {
    id: crypto.randomUUID(),
    code: found?.артикул_товара || found?.идентификатор || option.material_id || '',
    material_id: found?.идентификатор || option.material_id || null,
    base_name: found?.базовое_наименование || option.material_base_name || displayName,
    name: displayName,
    supplier: 'ТехноНИКОЛЬ',
    unit: found?.единица_измерения || option.material_unit || '',
    expression,
    qty,
    price: Number(found?.базовая_цена || option.material_base_price || 0),
    total: 0,
    profile_name: isProfileSheet ? profileName : '',
    profileThickness: isProfileSheet ? profileThickness : null,
    thickness: isProfileSheet ? profileThickness : null,
    thickness_unit: isProfileSheet ? 'мм' : ''
  }
}

function resolveMaterialExpression({ option, layer, system, paramValues, formulasMap }) {
  const role = `${option.role || 'default'}`.toLowerCase()
  const layerKind = `${layer.layer_kind || ''}`.toLowerCase()
  const waterproofingType = `${system.waterproofing_type || system.тип_гидроизоляции || ''}`.toLowerCase()
  const materialText = normalize(
    `${option.material_display_name || ''} ${option.material_base_name || ''} ${option.material_type || ''}`
  )

  if (role === 'fastener') {
    if (layerKind === 'waterproofing') {
      return formulasMap.get('MEMBRANE_FASTENERS') || 'S * [membrane_fasteners_per_m2]'
    }

    return formulasMap.get('INSULATION_FASTENERS') || 'S * [insulation_fasteners_per_m2]'
  }

  if (layerKind === 'primer') {
    return formulasMap.get('PRIMER') || 'S * [primer_n01_kg_per_m2]'
  }

  if (layerKind === 'separator') {
    return formulasMap.get('GLASS_FLEECE_AREA') || 'S * [glass_fleece_k]'
  }

  if (layerKind === 'waterproofing') {
    if (waterproofingType.includes('pvc')) {
      return formulasMap.get('PVC_AREA') || 'S * [pvc_membrane_overlap_k]'
    }

    return formulasMap.get('AREA') || 'S'
  }

  if (layerKind === 'vapor_barrier') {
    return formulasMap.get('AREA') || 'S'
  }

  if (materialText.includes('профилированный лист')) {
    return formulasMap.get('AREA') || 'S'
  }

  if (layerKind === 'insulation' || layerKind === 'slope') {
    const thickness = resolveLayerThickness(layer, paramValues)

    if (materialText.includes('мин') || materialText.includes('wool') || materialText.includes('техноруф')) {
      return applyThickness(
        formulasMap.get('MINERAL_WOOL_VOLUME') || 'S * T / 1000 * [mineral_wool_cutting_k]',
        thickness
      )
    }

    if (materialText.includes('xps') || materialText.includes('carbon')) {
      return applyThickness(
        formulasMap.get('XPS_VOLUME') || 'S * T / 1000 * [xps_cutting_k]',
        thickness
      )
    }

    if (materialText.includes('pir') || materialText.includes('logicpir')) {
      return formulasMap.get('PIR_AREA_THICKNESS') || 'S * [pir_cutting_k]'
    }

    return formulasMap.get('AREA') || 'S'
  }

  return formulasMap.get('AREA') || 'S'
}

function resolveLayerThickness(layer, paramValues) {
  const code = `${layer.code || ''}`.toLowerCase()
  const name = `${layer.name || ''}`.toLowerCase()

  if (code.includes('lower') || name.includes('ниж')) {
    return toNumber(
      paramValues.lower_insulation_thickness ??
        paramValues.insulation_bottom_thickness ??
        paramValues.insulation_thickness
    )
  }

  if (code.includes('upper') || name.includes('верх')) {
    return toNumber(
      paramValues.upper_insulation_thickness ??
        paramValues.insulation_top_thickness ??
        paramValues.insulation_thickness
    )
  }

  if (code.includes('slope') || name.includes('уклон')) {
    return toNumber(
      paramValues.slope_thickness ??
        paramValues.upper_insulation_thickness ??
        paramValues.lower_insulation_thickness
    )
  }

  return toNumber(
    paramValues.insulation_thickness ??
      paramValues.upper_insulation_thickness ??
      paramValues.lower_insulation_thickness
  )
}

function applyThickness(expression, thickness) {
  return `${expression || 'S'}`.replace(/T/g, `${toNumber(thickness)}`).trim()
}

function findWorkRow(worksDb, { id, name }) {
  if (id) {
    const byId = worksDb.find((item) => Number(item.идентификатор) === Number(id))
    if (byId) return byId
  }

  if (name) {
    const target = normalize(name)
    const exact = worksDb.find((item) => normalize(item.наименование_работы) === target)
    if (exact) return exact
    const like = worksDb.find(
      (item) => normalize(item.наименование_работы).includes(target) || target.includes(normalize(item.наименование_работы))
    )
    if (like) return like
  }

  return null
}

function findMaterialRow(materialsDb, { id, name }) {
  if (id) {
    const byId = materialsDb.find((item) => Number(item.идентификатор) === Number(id))
    if (byId) return byId
  }

  if (name) {
    const target = normalize(name)
    const exact = materialsDb.find((item) => normalize(item.полное_наименование_материала) === target)
    if (exact) return exact
    const like = materialsDb.find(
      (item) => normalize(item.полное_наименование_материала).includes(target) || target.includes(normalize(item.полное_наименование_материала))
    )
    if (like) return like
  }

  return null
}

function evaluateQty(expression, scope, coefficientsDb) {
  const expr = `${expression || '0'}`.trim()
  if (!expr) return 0

  const prepared = expr.replace(/\[(.*?)\]/g, (_, coefficientName) => {
    const coefficient = findCoefficient(coefficientsDb, coefficientName)
    return coefficient ? `${Number(coefficient.value ?? coefficient.значение ?? 1)}` : '1'
  })

  try {
    const value = evaluate(prepared, scope)
    const number = Number(value)
    if (!Number.isFinite(number)) return 0
    return roundQty(number)
  } catch {
    return 0
  }
}

function findCoefficient(coefficientsDb, key) {
  const target = normalize(key)
  return coefficientsDb.find((item) => {
    const byName = normalize(item.name || item.название)
    const byKey = normalize(item.normalize_key || '')
    return byName === target || byKey === target
  })
}

function createScope(paramValues) {
  const S = toNumber(paramValues.roof_area)
  const P = toNumber(paramValues.parapet_perimeter ?? paramValues.parapet_length ?? paramValues.roof_perimeter)
  const ID = toNumber(paramValues.inner_drains_count)
  const A = toNumber(paramValues.aerators_count)
  const OD = toNumber(paramValues.outer_drains_count)
  const WL = toNumber(paramValues.walkways_length)
  const D = toNumber(paramValues.deformation_joint_length)
  const PT = toNumber(paramValues.pass_through_count)
  return { S, P, ID, A, OD, WL, D, PT }
}

function buildCustomParams(scope) {
  const params = []
  if (scope.OD > 0) params.push({ name: 'Внешние воронки', symbol: 'OD', value: scope.OD })
  if (scope.WL > 0) params.push({ name: 'Пешеходные дорожки', symbol: 'WL', value: scope.WL })
  if (scope.D > 0) params.push({ name: 'Деформационный шов', symbol: 'D', value: scope.D })
  if (scope.PT > 0) params.push({ name: 'Проходки', symbol: 'PT', value: scope.PT })
  return params
}

function inferFallbackExpressionForWork(link) {
  const formulaCode = `${link.formula_code || ''}`.toUpperCase()
  if (formulaCode === 'AREA') return 'S'
  if (formulaCode === 'PERIMETER') return 'P'
  if (formulaCode === 'COUNT') return '1'
  const text = normalize(link.work_name)
  if (text.includes('ворон')) return 'ID'
  if (text.includes('аэратор')) return 'A'
  if (text.includes('дорож')) return 'WL'
  return 'S'
}

function normalizeExpression(expression) {
  return `${expression || '0'}`
    .replace(/s/g, 'S')
    .replace(/p/g, 'P')
    .replace(/id/gi, 'ID')
    .replace(/a/g, 'A')
    .trim()
}

function pickWorkPriceByArea(row, area) {
  const value = toNumber(area)
  if (value <= 300) return toNumber(row.цена_0_300)
  if (value <= 600) return toNumber(row.цена_300_600)
  if (value <= 1000) return toNumber(row.цена_600_1000)
  if (value <= 3000) return toNumber(row.цена_1000_3000)
  if (value <= 6000) return toNumber(row.цена_3000_6000)
  if (value <= 15000) return toNumber(row.цена_6000_15000)
  if (value <= 30000) return toNumber(row.цена_15000_30000)
  return toNumber(row.цена_более_30000)
}

function setMaybeRef(target, value) {
  if (target && typeof target === 'object' && Object.prototype.hasOwnProperty.call(target, 'value')) {
    target.value = value
  }
}

function replaceMaybeRefArray(target, items) {
  if (target && Array.isArray(target.value)) {
    target.value.splice(0, target.value.length, ...items)
    return
  }
  if (Array.isArray(target)) {
    target.splice(0, target.length, ...items)
  }
}

function roundQty(value) { return Math.round(value * 1000) / 1000 }
function toNumber(value) { const n = Number(value); return Number.isFinite(n) ? n : 0 }
function normalize(value) { return `${value || ''}`.toLowerCase().replace(/\s+/g, ' ').trim() }
