import { getCatalogData } from '../application/catalog/getCatalogData'
import {
  toLegacyMaterialRow,
  toLegacyWorkRow
} from '../shared/adapters/catalogViewAdapters'
import {
  normalizeFormulaExpression,
  recalculateSectionRowsByCode,
  buildZoneScope
} from '../shared/utils/cellFormulaEngine'
import {
  deriveTemplateCellCode,
  deriveExpressionOverride
} from '../shared/utils/templateRowMeta'
import { normalizeSelectedTemplateOptionKeys } from '../shared/templateSystemEnhancements'
import { getOptionEstimateBlocks } from '../shared/estimateOptionBlocks'

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
  const normalizedSelectedKeys = normalizeSelectedTemplateOptionKeys(selectedKeys)
  const selectedSet = new Set(normalizedSelectedKeys)

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

  recalculateSectionRowsByCode(sections, scope, coefficientsDb)

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
          selectedKeys: [...normalizedSelectedKeys],
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

  const sections = activeLayers.map((layer) => {
    const works = (layer.work_links || [])
      .map((link, workIndex) =>
        createWorkItem({
          link,
          layer,
          system,
          worksDb,
          scope,
          formulasMap,
          workIndex
        })
      )
      .filter(Boolean)

    const materials = (layer.material_options || [])
      .map((option, materialIndex) =>
        createMaterialItem({
          option,
          layer,
          system,
          paramValues,
          scope,
          materialsDb,
          coefficientsDb,
          formulasMap,
          materialIndex
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

  const syntheticSections = buildSyntheticOptionSections({
    system,
    selectedSet,
    worksDb,
    materialsDb
  })

  return [...sections, ...syntheticSections]
}


function createWorkItem({ link, layer, system, worksDb, scope, formulasMap, workIndex = 0 }) {
  const found = findWorkRow(worksDb, {
    id: link.work_id,
    name: link.work_name
  })

  const name = found?.наименование_работы || link.work_name || 'Работа'
  const baseExpression = normalizeFormulaExpression(
    link.default_expression ||
      link.formula_expression ||
      formulasMap.get(link.formula_code) ||
      inferFallbackExpressionForWork(link)
  )

  const expression = normalizeFormulaExpression(
    deriveExpressionOverride({
      roofBase: system?.roof_base || system?.roofBase || '',
      waterproofing: system?.waterproofing || system?.waterproofing_type || '',
      type: 'work',
      layerCode: layer?.code || '',
      name,
      fallbackExpression: baseExpression
    }) || baseExpression
  )

  return {
    id: crypto.randomUUID(),
    code: deriveTemplateCellCode({
      roofBase: system?.roof_base || system?.roofBase || '',
      waterproofing: system?.waterproofing || system?.waterproofing_type || '',
      layerCode: layer?.code || '',
      type: 'work',
      name,
      index: workIndex
    }),
    itemCode: found?.идентификатор || link.work_id || '',
    name,
    unit: found?.единица_измерения_работы || link.work_unit || '',
    expression,
    qty: 0,
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
  formulasMap,
  materialIndex = 0
}) {
  const found = findMaterialRow(materialsDb, {
    id: option.material_id,
    name: option.material_display_name || option.material_base_name
  })

  const baseExpression = normalizeFormulaExpression(
    resolveMaterialExpression({
      option,
      layer,
      system,
      paramValues,
      formulasMap
    })
  )

  const isProfileSheet = normalize(option.material_base_name || option.material_display_name).includes('профилированный лист')
  const profileName = `${paramValues.base_profile || ''}`.trim()
  const profileThickness = toNumber(paramValues.base_profile_thickness || 0.8)
  const displayName = isProfileSheet
    ? `Профлист ${profileName || option.material_display_name || option.material_base_name || ''}`.trim()
    : (found?.полное_наименование_материала || option.material_display_name || option.material_base_name || 'Материал')

  const expression = normalizeFormulaExpression(
    deriveExpressionOverride({
      roofBase: system?.roof_base || system?.roofBase || '',
      waterproofing: system?.waterproofing || system?.waterproofing_type || '',
      type: 'material',
      layerCode: layer?.code || '',
      role: option?.role || '',
      name: displayName,
      fallbackExpression: baseExpression
    }) || baseExpression
  )

  return {
    id: crypto.randomUUID(),
    code: deriveTemplateCellCode({
      roofBase: system?.roof_base || system?.roofBase || '',
      waterproofing: system?.waterproofing || system?.waterproofing_type || '',
      layerCode: layer?.code || '',
      type: 'material',
      role: option?.role || '',
      name: displayName,
      index: materialIndex
    }),
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


function buildSyntheticOptionSections({ system, selectedSet, worksDb, materialsDb }) {
  const existingFeatureCodes = new Set(
    ((Array.isArray(system.layers) ? system.layers : Array.isArray(system.слои) ? system.слои : [])
      .map((layer) => `${layer.feature_code || ''}`.trim())
      .filter(Boolean))
  )

  return getOptionEstimateBlocks([...selectedSet])
    .filter((block) => !existingFeatureCodes.has(block.sectionCode))
    .map((block) => ({
      id: crypto.randomUUID(),
      title: block.title,
      works: (block.works || []).map((item, index) => createSyntheticWorkItem(block, item, worksDb, index)).filter(Boolean),
      materials: (block.materials || []).map((item, index) => createSyntheticMaterialItem(block, item, materialsDb, index)).filter(Boolean)
    }))
    .filter((section) => section.works.length || section.materials.length)
}

function createSyntheticWorkItem(block, item, worksDb, index = 0) {
  const found = findWorkRow(worksDb, { name: item.name })
  return {
    id: crypto.randomUUID(),
    code: `C${(block.codeBases?.work || 500) + index}`,
    itemCode: found?.идентификатор || '',
    name: found?.наименование_работы || item.name,
    unit: found?.единица_измерения_работы || item.unit || '',
    expression: normalizeFormulaExpression(item.expression || '0'),
    qty: 0,
    price: found ? pickWorkPriceByArea(found, 0) : 0,
    total: 0
  }
}

function createSyntheticMaterialItem(block, item, materialsDb, index = 0) {
  const found = findMaterialRow(materialsDb, { name: item.name })
  const displayName = found?.полное_наименование_материала || item.name
  return {
    id: crypto.randomUUID(),
    code: `C${(block.codeBases?.material || 550) + index}`,
    itemCode: found?.артикул_товара || found?.идентификатор || '',
    material_id: found?.идентификатор || null,
    base_name: found?.базовое_наименование || item.name,
    name: displayName,
    supplier: 'ТехноНИКОЛЬ',
    unit: found?.единица_измерения || item.unit || '',
    expression: normalizeFormulaExpression(item.expression || '0'),
    qty: 0,
    price: Number(found?.базовая_цена || 0),
    total: 0,
    profile_name: '',
    profileThickness: null,
    thickness: null,
    thickness_unit: ''
  }
}

function resolveMaterialExpression({ option, layer, system, paramValues, formulasMap }) {
  const role = `${option.role || 'default'}`.toLowerCase()
  const layerKind = `${layer.layer_kind || ''}`.toLowerCase()
  const featureCode = normalize(layer.feature_code || '')
  const waterproofingType = normalize(
    `${system.waterproofing_type || system.waterproofing || system.тип_гидроизоляции || system.waterproofing_kind || ''}`
  )
  const materialText = normalize(
    `${option.material_display_name || ''} ${option.material_base_name || ''} ${option.material_type || ''}`
  )

  if (role === 'item_count') {
    if (featureCode === 'inner_drains') {
      return formulasMap.get('INNER_DRAINS') || 'ID'
    }
    if (featureCode === 'outer_drains') {
      return formulasMap.get('OUTER_DRAINS') || 'OD'
    }
    if (featureCode === 'aerators') {
      return formulasMap.get('AERATORS') || 'A'
    }
  }

  if (role === 'walkway_item') {
    return formulasMap.get('WALKWAY_PUZZLE_COUNT') || 'WL / [walkway_puzzle_length_m]'
  }

  if (role === 'tape') {
    return formulasMap.get('PAROBARRIER_TAPE') || 'S * [parobarrier_tape_rolls_per_m2]'
  }

  if (role === 'primer_bucket') {
    return formulasMap.get('PRIMER_BUCKETS') || 'S * [primer_bucket_per_m2]'
  }

  if (role === 'gas') {
    return formulasMap.get('BURNER_GAS') || 'S * [burner_gas_l_per_m2]'
  }

  if (role === 'cleaner') {
    return formulasMap.get('PVC_CLEANER') || 'S * [pvc_cleaner_pack_per_m2]'
  }

  if (role === 'adhesive') {
    return formulasMap.get('XPS_ADHESIVE') || 'S * [xps_adhesive_foam_per_m2]'
  }

  if (featureCode === 'parapets') {
    if (role === 'main_membrane') {
      return formulasMap.get('PARAPET_MAIN_MEMBRANE') || 'P * [pvc_parapet_main_membrane_m2_per_m]'
    }
    if (role === 'aux_membrane') {
      return formulasMap.get('PARAPET_AUX_MEMBRANE') || 'P * [pvc_parapet_aux_membrane_m2_per_m]'
    }
    if (role === 'planck') {
      return formulasMap.get('PERIMETER') || 'P'
    }
    if (role === 'planck_fastener') {
      return formulasMap.get('PARAPET_FASTENERS') || 'P * [pvc_parapet_fasteners_per_m]'
    }
    if (role === 'sealant') {
      return formulasMap.get('PARAPET_SEALANT') || 'P * [pvc_parapet_sealant_tube_per_m]'
    }
  }

  if (role === 'fastener') {
    if (layerKind === 'waterproofing') {
      return formulasMap.get('MEMBRANE_FASTENERS') || 'S * [membrane_fasteners_per_m2]'
    }

    return formulasMap.get('INSULATION_FASTENERS') || 'S * [insulation_fasteners_per_m2]'
  }

  if (layerKind === 'primer' || materialText.includes('праймер')) {
    return formulasMap.get('PRIMER_BUCKETS') || 'S * [primer_bucket_per_m2]'
  }

  if (layerKind === 'separator') {
    return formulasMap.get('GLASS_FLEECE_AREA') || 'S * [glass_fleece_k]'
  }

  if (layerKind === 'waterproofing') {
    if (waterproofingType.includes('pvc')) {
      return formulasMap.get('PVC_AREA') || 'S * [pvc_membrane_overlap_k]'
    }

    if (waterproofingType.includes('brm') || waterproofingType.includes('битум') || waterproofingType.includes('roll')) {
      return formulasMap.get('BRM_AREA') || 'S * [brm_overlap_k]'
    }

    return formulasMap.get('AREA') || 'S'
  }

  if (layerKind === 'vapor_barrier') {
    if (materialText.includes('скотч')) {
      return formulasMap.get('PAROBARRIER_TAPE') || 'S * [parobarrier_tape_rolls_per_m2]'
    }
    if (materialText.includes('праймер')) {
      return formulasMap.get('PRIMER_BUCKETS') || 'S * [primer_bucket_per_m2]'
    }
    if (materialText.includes('газ')) {
      return formulasMap.get('BURNER_GAS') || 'S * [burner_gas_l_per_m2]'
    }
    return formulasMap.get('PAROBARRIER_AREA') || 'S * [parobarrier_overlap_k]'
  }

  if (materialText.includes('очиститель')) {
    return formulasMap.get('PVC_CLEANER') || 'S * [pvc_cleaner_pack_per_m2]'
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
  return 0
}

function findCoefficient(coefficientsDb, key) {
  const target = normalize(key)
  return coefficientsDb.find((item) => {
    const byName = normalize(item.name || item.название)
    const byKey = normalize(item.normalize_key || '')
    return byName === target || byKey === target
  })
}

const EXTRA_SCOPE_PARAMS = [
  ['SB', 'Площадь по ж/б основанию', ['concrete_area']],
  ['PS', 'Примыкания к парапету по сэндвич-панели', ['parapet_perimeter_sandwich']],
  ['PB', 'Примыкания к парапету по ж/б', ['parapet_perimeter_concrete']],
  ['CS', 'Примыкания к карнизному свесу', ['cornice_length']],
  ['K', 'Площадь контруклонов', ['counter_slope_area']],
  ['ODL', 'Длина наружной водосточной системы', ['outer_drain_length']],
  ['IC', 'Кабель противообледенения', ['anti_icing_cable_length']],
  ['WL', 'Пешеходные дорожки', ['walkways_length']],
  ['WPC', 'Walkway Puzzle', ['walkways_count']],
  ['D', 'Деформационные швы', ['deformation_joint_length']],
  ['FW', 'Стойки фахверка', ['fachwerk_count']],
  ['SH', 'Люки дымоудаления', ['smoke_hatches_count']],
  ['NG', 'Негорючий защитный материал', ['noncombustible_fill_area']],
  ['OV', 'Узлы ОВ', ['ov_count']],
  ['VK', 'Узлы ВК', ['vk_count']],
  ['VKL', 'Длина примыканий ВК', ['vk_length']],
  ['PDL', 'Примыкания к тумбам', ['pedestal_perimeter']],
  ['PDC', 'Тумбы / кровельные подставки', ['pedestal_count']],
  ['AI', 'Воздухозаборы', ['air_intake_count']],
  ['VF', 'Промышленные вентиляторы', ['fan_count']],
  ['EX', 'Вытяжки / дефлекторы', ['exhaust_count']],
  ['AC', 'Стойки блоков кондиционеров', ['condenser_support_count']],
  ['CG', 'Гусаки для ввода кабеля', ['cable_gooseneck_count']],
  ['PT', 'Проходки', ['pass_through_count']],
  ['PTS', 'Проходки малого сечения', ['pass_through_small_count']],
  ['PTM', 'Проходки среднего сечения', ['pass_through_medium_count']],
  ['VS', 'Примыкания к вентшахтам', ['vent_shaft_perimeter']],
  ['GR', 'Кровельное ограждение', ['guardrail_length']],
  ['GRC', 'Стойки ограждения', ['guardrail_post_count']],
  ['SC', 'Площадь стяжки', ['screed_area']],
  ['PA', 'Площадь праймирования', ['primer_area']],
  ['WZA', 'Площадь ветровых зон', ['wind_zone_area']],
  ['RB', 'Заполнение гофр / L-профиль', ['base_profile_rib_fill_length']]
]

function resolveExtraParamValue(paramValues, keys = []) {
  for (const key of keys) {
    const value = toNumber(paramValues?.[key], NaN)
    if (Number.isFinite(value)) {
      return value
    }
  }
  return 0
}

function createScope(paramValues) {
  const customParams = EXTRA_SCOPE_PARAMS.map(([symbol, _name, keys]) => ({
    symbol,
    value: resolveExtraParamValue(paramValues, keys)
  })).filter((item) => item.value > 0)

  return {
    ...buildZoneScope({
      roofParams: {
        area: toNumber(paramValues.roof_area),
        perimeter: toNumber(paramValues.parapet_perimeter ?? paramValues.parapet_length ?? paramValues.roof_perimeter),
        parapetDrains: toNumber(paramValues.outer_drains_count),
        innerDrains: toNumber(paramValues.inner_drains_count),
        aerators: toNumber(paramValues.aerators_count)
      },
      customParams
    })
  }
}

function buildCustomParams(scope) {
  const params = []
  if (scope.OD > 0) params.push({ name: 'Внешние воронки', symbol: 'OD', value: scope.OD })
  if (scope.ID > 0) params.push({ name: 'Внутренние воронки', symbol: 'ID', value: scope.ID })
  if (scope.A > 0) params.push({ name: 'Аэраторы', symbol: 'A', value: scope.A })

  for (const [symbol, name] of EXTRA_SCOPE_PARAMS.map(([symbol, name]) => [symbol, name])) {
    const value = toNumber(scope?.[symbol], 0)
    if (value > 0 && !params.find((item) => item.symbol === symbol)) {
      params.push({ name, symbol, value })
    }
  }

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
  return normalizeFormulaExpression(expression)
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
