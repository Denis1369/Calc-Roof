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
  const selectedSet = buildSelectedFeaturesSet(fullSystem, selectedKeys)
  const formulasMap = new Map(
    formulasDb.map((formula) => [formula.code, formula.expression || ''])
  )

  const sections = buildSections({
    system: fullSystem,
    selectedSet,
    paramValues: mergedParams,
    worksDb,
    materialsDb,
    coefficientsDb,
    formulasMap
  })

  return {
    projectName: fullSystem.name || fullSystem.название || 'Смета',
    vatRate: resolveVatRate(fullSystem),
    estimateZones: [
      {
        id: crypto.randomUUID(),
        name: `Монтаж системы: ${fullSystem.name || fullSystem.название || 'Система'}`,
        supplierType: 'ТехноНИКОЛЬ',
        roofParams: {
          area: toNumber(mergedParams.roof_area),
          perimeter: toNumber(mergedParams.parapet_perimeter ?? mergedParams.parapet_length ?? mergedParams.roof_perimeter),
          parapetDrains: toNumber(mergedParams.outer_drains_count),
          innerDrains: toNumber(mergedParams.inner_drains_count),
          aerators: toNumber(mergedParams.aerators_count)
        },
        customParams: buildCustomParams(mergedParams),
        templateMeta: {
          systemCode: fullSystem.code || fullSystem.код || '',
          selectedKeys: [...selectedSet],
          paramValues: { ...mergedParams }
        },
        sections
      }
    ]
  }
}

function resolveVatRate(system) {
  const code = `${system?.code || system?.код || ''}`.toLowerCase()
  if (code === 'tn-klassik') return 22
  return 20
}

function buildSelectedFeaturesSet(fullSystem, selectedKeys) {
  const result = new Set((selectedKeys || []).filter(Boolean))
  if (Array.isArray(selectedKeys) && selectedKeys.length > 0) {
    return result
  }

  const features = Array.isArray(fullSystem?.features)
    ? fullSystem.features
    : Array.isArray(fullSystem?.опции)
      ? fullSystem.опции
      : []

  for (const feature of features) {
    const code = feature.code || feature.key
    const isDefault = Boolean(feature.is_default ?? feature.default)
    if (code && isDefault) {
      result.add(code)
    }
  }

  return result
}

function buildMergedParamValues(system, paramValues) {
  const result = {}
  const params = Array.isArray(system?.параметры)
    ? system.параметры
    : Array.isArray(system?.params)
      ? system.params.map((param) => ({ key: param.code, value: toParamValue(param) }))
      : []

  for (const param of params) {
    result[param.key] = param.value
  }

  return {
    ...result,
    ...paramValues
  }
}

function toParamValue(param) {
  if (param?.param_type === 'number') {
    const number = Number(param.default_value)
    return Number.isFinite(number) ? number : 0
  }

  return param?.default_value ?? ''
}

function buildSections({
  system,
  selectedSet,
  paramValues,
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

  const activeLayers = layers.filter((layer) => !layer.feature_code || selectedSet.has(layer.feature_code))
  const baseScope = createScope(paramValues)
  const sections = []

  for (const layer of activeLayers) {
    const section = {
      id: crypto.randomUUID(),
      title: layer.name || 'Раздел',
      works: [],
      materials: []
    }

    for (const link of layer.work_links || []) {
      const item = createWorkItem({ link, worksDb, formulasMap })
      item.qty = evaluateQty(item.expression, baseScope, coefficientsDb)
      item.total = round2(item.qty * toNumber(item.price))
      if (item.cellCode) baseScope[item.cellCode] = item.qty
      section.works.push(item)
    }

    for (const option of layer.material_options || []) {
      const item = createMaterialItem({ option, layer, system, paramValues, materialsDb, coefficientsDb, formulasMap, scope: baseScope })
      item.qty = evaluateQty(item.expression, baseScope, coefficientsDb)
      item.total = round2(item.qty * toNumber(item.price))
      if (item.cellCode) baseScope[item.cellCode] = item.qty
      section.materials.push(item)
    }

    sections.push(section)
  }

  return sections
}

function createWorkItem({ link, worksDb, formulasMap }) {
  const found = findWorkRow(worksDb, { id: link.work_id, name: link.work_name })
  const expression = normalizeExpression(
    link.default_expression ||
      link.formula_expression ||
      formulasMap.get(link.formula_code) ||
      inferFallbackExpressionForWork(link)
  )
  const cellCode = `${link.stable_code || ''}`.trim()

  return {
    id: crypto.randomUUID(),
    code: cellCode || found?.идентификатор || link.work_id || '',
    cellCode,
    itemCode: found?.идентификатор || link.work_id || '',
    name: found?.наименование_работы || link.work_name || 'Работа',
    unit: found?.единица_измерения_работы || link.work_unit || '',
    expression,
    qty: 0,
    price: found ? pickWorkPriceByArea(found, 0) : 0,
    total: 0
  }
}

function createMaterialItem({ option, layer, system, paramValues, materialsDb, formulasMap }) {
  const found = findMaterialRow(materialsDb, {
    id: option.material_id,
    name: option.material_display_name || option.material_base_name
  })

  const expression = normalizeExpression(
    option.default_expression ||
      resolveMaterialExpression({ option, layer, system, paramValues, formulasMap })
  )

  const isProfileSheet = normalize(`${option.material_base_name || ''} ${option.material_display_name || ''}`).includes('профилированный лист')
  const profileName = `${paramValues.base_profile || ''}`.trim()
  const profileThickness = toNumber(paramValues.base_profile_thickness || 0.8)
  const displayName = isProfileSheet
    ? `Профлист ${profileName || option.material_display_name || option.material_base_name || ''}`.trim()
    : found?.полное_наименование_материала || option.material_display_name || option.material_base_name || 'Материал'
  const cellCode = `${option.stable_code || ''}`.trim()

  return {
    id: crypto.randomUUID(),
    code: cellCode || found?.артикул_товара || found?.идентификатор || option.material_id || '',
    cellCode,
    itemCode: found?.артикул_товара || found?.идентификатор || option.material_id || '',
    material_id: found?.идентификатор || option.material_id || null,
    base_name: found?.базовое_наименование || option.material_base_name || displayName,
    name: displayName,
    supplier: 'ТехноНИКОЛЬ',
    unit: found?.единица_измерения || option.material_unit || '',
    expression,
    qty: 0,
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
      return formulasMap.get('MEMBRANE_FASTENERS') || 'roof_area * [membrane_fasteners_per_m2]'
    }

    return formulasMap.get('INSULATION_FASTENERS') || 'roof_area * [insulation_fasteners_per_m2]'
  }

  if (layerKind === 'primer') {
    return formulasMap.get('PRIMER') || 'roof_area * [primer_n01_kg_per_m2]'
  }

  if (layerKind === 'separator') {
    return formulasMap.get('GLASS_FLEECE_AREA') || 'roof_area * [glass_fleece_k]'
  }

  if (layerKind === 'waterproofing') {
    if (waterproofingType.includes('pvc')) {
      return formulasMap.get('PVC_AREA') || 'roof_area * [pvc_membrane_overlap_k]'
    }

    return formulasMap.get('AREA') || 'roof_area'
  }

  if (layerKind === 'vapor_barrier') {
    return formulasMap.get('AREA') || 'roof_area'
  }

  if (materialText.includes('профилированный лист')) {
    return formulasMap.get('AREA') || 'roof_area'
  }

  if (layerKind === 'insulation' || layerKind === 'slope') {
    const thickness = resolveLayerThickness(layer, paramValues)

    if (materialText.includes('мин') || materialText.includes('wool') || materialText.includes('техноруф')) {
      return applyThickness(
        formulasMap.get('MINERAL_WOOL_VOLUME') || 'roof_area * T / 1000 * [mineral_wool_cutting_k]',
        thickness
      )
    }

    if (materialText.includes('xps') || materialText.includes('carbon')) {
      return applyThickness(
        formulasMap.get('XPS_VOLUME') || 'roof_area * T / 1000 * [xps_cutting_k]',
        thickness
      )
    }

    if (materialText.includes('pir') || materialText.includes('logicpir')) {
      return formulasMap.get('PIR_AREA_THICKNESS') || 'roof_area * [pir_cutting_k]'
    }

    return formulasMap.get('AREA') || 'roof_area'
  }

  return formulasMap.get('AREA') || 'roof_area'
}

function resolveLayerThickness(layer, paramValues) {
  const code = `${layer.code || ''}`.toLowerCase()
  const name = `${layer.name || ''}`.toLowerCase()

  if (code.includes('lower') || name.includes('ниж')) {
    return toNumber(paramValues.lower_insulation_thickness ?? paramValues.insulation_bottom_thickness ?? paramValues.insulation_thickness)
  }

  if (code.includes('upper') || name.includes('верх')) {
    return toNumber(paramValues.upper_insulation_thickness ?? paramValues.insulation_top_thickness ?? paramValues.insulation_thickness)
  }

  if (code.includes('slope') || name.includes('уклон')) {
    return toNumber(paramValues.slope_thickness ?? paramValues.upper_insulation_thickness ?? paramValues.lower_insulation_thickness)
  }

  return toNumber(paramValues.insulation_thickness ?? paramValues.upper_insulation_thickness ?? paramValues.lower_insulation_thickness)
}

function applyThickness(expression, thickness) {
  return `${expression || 'roof_area'}`.replace(/\bT\b/g, `${toNumber(thickness)}`).trim()
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
    const like = worksDb.find((item) => normalize(item.наименование_работы).includes(target) || target.includes(normalize(item.наименование_работы)))
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
    const like = materialsDb.find((item) => normalize(item.полное_наименование_материала).includes(target) || target.includes(normalize(item.полное_наименование_материала)))
    if (like) return like
  }

  return null
}

function evaluateQty(expression, scope, coefficientsDb) {
  const expr = normalizeExpression(expression || '0')
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
  return coefficientsDb.find((item) => normalize(item.name || item.название) === target || normalize(item.normalize_key || '') === target)
}

function createScope(paramValues) {
  const scope = {
    roof_area: toNumber(paramValues.roof_area),
    parapet_perimeter: toNumber(paramValues.parapet_perimeter ?? paramValues.parapet_length ?? paramValues.roof_perimeter),
    inner_drains_count: toNumber(paramValues.inner_drains_count),
    outer_drains_count: toNumber(paramValues.outer_drains_count),
    aerators_count: toNumber(paramValues.aerators_count),
    walkways_length: toNumber(paramValues.walkways_length),
    deformation_joint_length: toNumber(paramValues.deformation_joint_length),
    pass_through_count: toNumber(paramValues.pass_through_count),
    S: toNumber(paramValues.roof_area),
    P: toNumber(paramValues.parapet_perimeter ?? paramValues.parapet_length ?? paramValues.roof_perimeter),
    ID: toNumber(paramValues.inner_drains_count),
    OD: toNumber(paramValues.outer_drains_count),
    A: toNumber(paramValues.aerators_count),
    WL: toNumber(paramValues.walkways_length),
    D: toNumber(paramValues.deformation_joint_length),
    PT: toNumber(paramValues.pass_through_count)
  }

  for (const [key, rawValue] of Object.entries(paramValues || {})) {
    const number = Number(rawValue)
    if (Number.isFinite(number)) {
      scope[key] = number
    }
  }

  return scope
}

function buildCustomParams(paramValues) {
  const params = []
  if (toNumber(paramValues.outer_drains_count) > 0) params.push({ name: 'Внешние воронки', symbol: 'OD', value: toNumber(paramValues.outer_drains_count) })
  if (toNumber(paramValues.walkways_length) > 0) params.push({ name: 'Пешеходные дорожки', symbol: 'WL', value: toNumber(paramValues.walkways_length) })
  if (toNumber(paramValues.deformation_joint_length) > 0) params.push({ name: 'Деформационный шов', symbol: 'D', value: toNumber(paramValues.deformation_joint_length) })
  if (toNumber(paramValues.pass_through_count) > 0) params.push({ name: 'Проходки', symbol: 'PT', value: toNumber(paramValues.pass_through_count) })
  return params
}

function inferFallbackExpressionForWork(link) {
  const formulaCode = `${link.formula_code || ''}`.toUpperCase()
  if (formulaCode === 'AREA') return 'roof_area'
  if (formulaCode === 'PERIMETER') return 'parapet_perimeter'
  if (formulaCode === 'COUNT') return '1'
  const text = normalize(link.work_name)
  if (text.includes('ворон')) return 'inner_drains_count'
  if (text.includes('аэратор')) return 'aerators_count'
  if (text.includes('дорож')) return 'walkways_length'
  return 'roof_area'
}

function normalizeExpression(expression) {
  return `${expression || '0'}`
    .replace(/\bs\b/g, 'S')
    .replace(/\bp\b/g, 'P')
    .replace(/\bid\b/gi, 'ID')
    .replace(/\bod\b/gi, 'OD')
    .replace(/\ba\b/g, 'A')
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
function round2(value) { return Math.round(value * 100) / 100 }
function toNumber(value) { const n = Number(value); return Number.isFinite(n) ? n : 0 }
function normalize(value) { return `${value || ''}`.toLowerCase().replace(/\s+/g, ' ').trim() }
