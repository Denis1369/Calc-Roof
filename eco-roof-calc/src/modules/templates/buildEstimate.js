import { getCatalogData } from '@/core/services/dataApi'
import {
  toLegacyMaterialRow,
  toLegacyWorkRow
} from '@/core/adapters/viewAdapters'
import {
  normalizeCellCode,
  normalizeFormulaExpression,
  recalculateSectionRowsByCode,
  buildZoneScope
} from '@/core/utils/cellFormulaEngine'
import {
  deriveTemplateCellCode,
  deriveExpressionOverride
} from '@/core/utils/templateRowMeta'
import {
  normalizeSelectedTemplateOptionKeys,
  sanitizeTemplateParamValues
} from '@/modules/templates/templateEnhancements'
import { getOptionEstimateBlocks } from '@/modules/templates/optionBlocks'

const PENDING_ESTIMATE_KEY = 'eco-roof-pending-estimate'

export function storePendingGeneratedEstimate(payload) {
  sessionStorage.setItem(PENDING_ESTIMATE_KEY, JSON.stringify(payload))
}

export function applyPendingGeneratedEstimate({ projectName, contractorProfile, vatRate, estimateZones, overheadExpenses, recalculateVolumes }) {
  const raw = sessionStorage.getItem(PENDING_ESTIMATE_KEY)
  if (!raw) return false

  try {
    const parsed = JSON.parse(raw)

    if (parsed.projectName !== undefined) {
      setMaybeRef(projectName, parsed.projectName)
    }

    if (parsed.contractorProfile !== undefined) {
      setMaybeRef(contractorProfile, parsed.contractorProfile)
    }

    if (parsed.vatRate !== undefined) {
      setMaybeRef(vatRate, parsed.vatRate)
    }

    if (Array.isArray(parsed.estimateZones)) {
      replaceMaybeRefArray(estimateZones, parsed.estimateZones)
    }

    if (Array.isArray(parsed.overheadExpenses)) {
      replaceMaybeRefArray(overheadExpenses, parsed.overheadExpenses)
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

export async function buildEstimateFromSystem(system, selectedKeys, paramValues = {}, options = {}) {
  const data = await getCatalogData()

  const worksDb = data.works.map(toLegacyWorkRow)
  const materialsDb = data.materials.map(toLegacyMaterialRow)
  const coefficientsDb = data.coefficients || []
  const formulasDb = data.formulas || []

  const fullSystem = system?.raw || system
  if (!fullSystem) {
    throw new Error('System is required')
  }

  const useDefaultOverride = options.useDefaultOverride !== false
  const defaultOverride = useDefaultOverride ? fullSystem.default_override || system?.default_override || null : null
  const hasExplicitSelectedKeys = Array.isArray(selectedKeys)
  const hasDefaultOverrideSelectedKeys = Array.isArray(defaultOverride?.selectedKeys)

  const effectiveSelectedKeys = hasExplicitSelectedKeys
    ? selectedKeys
    : (hasDefaultOverrideSelectedKeys ? defaultOverride.selectedKeys : [])
  const preliminarySelectedKeys = normalizeSelectedTemplateOptionKeys(effectiveSelectedKeys)

  const rawMergedParams = buildMergedParamValues(system, {
    ...(defaultOverride?.paramValues || {}),
    ...(paramValues || {})
  })
  const inferredSelectedKeys = (!hasExplicitSelectedKeys && !hasDefaultOverrideSelectedKeys)
    ? inferSelectedKeysFromParamValues(rawMergedParams)
    : []
  const normalizedSelectedKeys = applyOptionOrderToSelectedKeys(normalizeSelectedTemplateOptionKeys([
    ...preliminarySelectedKeys,
    ...inferredSelectedKeys
  ]), options.optionOrder)
  const mergedParams = sanitizeTemplateParamValues(system, normalizedSelectedKeys, rawMergedParams)
  const scope = createScope(mergedParams)
  const selectedSet = new Set(normalizedSelectedKeys)

  const formulasMap = new Map(
    formulasDb.map((formula) => [formula.code, formula.expression || ''])
  )

  let sections = buildSections({
    system: fullSystem,
    selectedKeys: normalizedSelectedKeys,
    selectedSet,
    paramValues: mergedParams,
    scope,
    worksDb,
    materialsDb,
    coefficientsDb,
    formulasMap
  })

  if (Array.isArray(defaultOverride?.sections) && defaultOverride.sections.length) {
    sections = filterOverrideSectionsBySelection(
      normalizeOverrideSections(defaultOverride.sections),
      selectedSet
    )
    sections = mergeSyntheticOptionSections({
      system: fullSystem,
      selectedKeys: normalizedSelectedKeys,
      sections,
      worksDb,
      materialsDb
    })
  }

  sections = applyEstimateBusinessRules(sections, {
    system: fullSystem,
    materialsDb,
    paramValues: mergedParams
  })

  recalculateSectionRowsByCode(sections, scope, coefficientsDb)

  return {
    projectName: fullSystem.name || fullSystem.название || 'Смета',
    vatRate: 20,
    overheadExpenses: buildDefaultOverheadExpenses(),
    estimateZones: [
      {
        id: crypto.randomUUID(),
        name: `Монтаж системы: ${fullSystem.name || fullSystem.название || 'Система'}`,
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
          optionOrder: Array.isArray(options.optionOrder) ? [...options.optionOrder] : [...normalizedSelectedKeys],
          paramValues: { ...mergedParams }
        },
        sections
      }
    ]
  }
}

function inferSelectedKeysFromParamValues(paramValues = {}) {
  const keys = []
  const hasPositive = (paramKey) => toNumber(paramValues?.[paramKey], 0) > 0

  if (hasPositive('inner_drains_count') || hasPositive('inner_drain_count') || hasPositive('internal_drains_count')) keys.push('inner_drains')
  if (hasPositive('outer_drains_count') || hasPositive('outer_drain_count') || hasPositive('external_drains_count')) keys.push('outer_drains')
  if (hasPositive('aerators_count') || hasPositive('aerator_count')) keys.push('aerators')
  if (hasPositive('base_profile_rib_fill_length') || hasPositive('corrugation_fill_length') || hasPositive('l_profile_length') || hasPositive('ridge_reinforcement_length')) keys.push('rib_fill')
  if (hasPositive('counter_slope_area')) keys.push('counter_slopes')
  if (hasPositive('walkways_length') || hasPositive('walkways_count')) keys.push('walkways')
  if (hasPositive('deformation_joint_length') || hasPositive('def_joint_count')) keys.push('deformation_joints')
  if (hasPositive('fachwerk_count')) keys.push('fachwerks')
  if (hasPositive('fire_break_area') || hasPositive('noncombustible_fill_area')) keys.push('fire_protection')

  return keys
}

function applyOptionOrderToSelectedKeys(selectedKeys = [], optionOrder = []) {
  const selected = normalizeSelectedTemplateOptionKeys(selectedKeys)
  const order = normalizeSelectedTemplateOptionKeys(optionOrder)

  if (!order.length || !selected.length) {
    return selected
  }

  const selectedSet = new Set(selected)
  const orderedSelected = order.filter((key) => selectedSet.has(key))
  const leftovers = selected.filter((key) => !orderedSelected.includes(key))
  return [...orderedSelected, ...leftovers]
}


function normalizeOverrideSections(sections = []) {
  return sections.map((section, sectionIndex) => ({
    id: section?.id || crypto.randomUUID(),
    title: section?.title || `Раздел ${sectionIndex + 1}` ,
    featureCode: normalizeOptionKey(section?.featureCode || inferFeatureCodeFromSection(section)),
    works: normalizeOverrideRows(section?.works, 'work'),
    materials: normalizeOverrideRows(section?.materials, 'material')
  }))
}

function inferFeatureCodeFromSection(section = {}) {
  const identity = normalize(`${section?.title || ''} ${
    [...(section?.works || []), ...(section?.materials || [])]
      .map((item) => item?.name || item?.work_name || item?.material_display_name || '')
      .join(' ')
  }`)

  if (identity.includes('демонтаж') || identity.includes('demolition')) return 'demolition'
  if (identity.includes('проходк') && identity.includes('мал')) return 'small_penetrations'
  if (identity.includes('проходк') && identity.includes('сред')) return 'medium_penetrations'
  if (identity.includes('аэратор')) return 'aerators'
  if (isInnerDrainIdentity(identity)) return 'inner_drains'
  if (isOuterDrainIdentity(identity)) return 'outer_drains'
  if (isCounterSlopeIdentity(identity)) return 'counter_slopes'
  if (identity.includes('дорожк') || identity.includes('walkway')) return 'walkways'
  if (identity.includes('огражден')) return 'guardrails'
  if (identity.includes('фахвер')) return 'fachwerks'
  if (identity.includes('дым')) return 'smoke_hatches'
  if (identity.includes('деформац')) return 'deformation_joints'

  return ''
}

function isCounterSlopeIdentity(identity = '') {
  return (
    identity.includes('контруклон') ||
    identity.includes('уклонообраз') ||
    identity.includes('разуклон') ||
    identity.includes('slope')
  )
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
    identity.includes('внеш') ||
    identity.includes('наруж') ||
    identity.includes('парапет') ||
    identity.includes('outer')
  )
}

function isInnerDrainIdentity(identity = '') {
  return isDrainIdentity(identity) && (
    identity.includes('внут') ||
    identity.includes('водоприем') ||
    identity.includes('водоприём') ||
    identity.includes('internal') ||
    !isOuterDrainIdentity(identity)
  )
}

function filterOverrideSectionsBySelection(sections = [], selectedSet = new Set()) {
  return sections.filter((section) => {
    const featureCode = normalizeOptionKey(section?.featureCode || '')
    if (!featureCode) return true
    return selectedSet.has(featureCode)
  })
}

function normalizeOverrideRows(rows = [], type = 'item') {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    id: row?.id || crypto.randomUUID(),
    code: `${row?.code || row?.cellCode || ''}`.trim(),
    cellCode: `${row?.cellCode || row?.code || ''}`.trim(),
    templateCode: `${row?.templateCode || ''}`.trim(),
    itemCode: row?.itemCode || row?.material_id || row?.work_id || '',
    unit: row?.unit || '',
    expression: normalizeOverrideExpression(row?.expression || row?.formula || '0', type),
    qty: toNumber(row?.qty, 0),
    price: toNumber(row?.price, 0),
    total: toNumber(row?.total, 0)
  }))
}

function normalizeOverrideExpression(expression, type = 'item') {
  const normalized = normalizeFormulaExpression(expression || '0')

  if (type !== 'work') {
    return normalized
  }

  const compact = normalized.replace(/\s+/g, '').toUpperCase()
  if (compact === 'S+(P*0.15)' || compact === 'S+P*0.15' || compact === 'S+(P*0.2)' || compact === 'S+P*0.2') {
    return 'S'
  }

  return normalized
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
  selectedKeys = [],
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
    const featureCode = normalizeOptionKey(layer.feature_code || inferFeatureCodeFromLayer(layer))

    if (!featureCode) {
      return true
    }

    return selectedSet.has(featureCode)
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
      featureCode: normalizeOptionKey(layer.feature_code || inferFeatureCodeFromLayer(layer)),
      works,
      materials
    }
  })

  return mergeSyntheticOptionSections({
    system,
    selectedKeys,
    sections,
    worksDb,
    materialsDb
  })
}

function inferFeatureCodeFromLayer(layer = {}) {
  const identity = normalize(`${layer?.name || layer?.title || ''} ${
    (layer?.work_links || [])
      .map((item) => item?.work_name || item?.name || '')
      .join(' ')
  } ${
    (layer?.material_options || [])
      .map((item) => item?.material_display_name || item?.material_base_name || item?.name || '')
      .join(' ')
  }`)

  if (identity.includes('демонтаж') || identity.includes('demolition')) return 'demolition'
  if (identity.includes('проходк') && identity.includes('мал')) return 'small_penetrations'
  if (identity.includes('проходк') && identity.includes('сред')) return 'medium_penetrations'
  if (identity.includes('аэратор')) return 'aerators'
  if (isOuterDrainIdentity(identity)) return 'outer_drains'
  if (isInnerDrainIdentity(identity)) return 'inner_drains'
  if (isCounterSlopeIdentity(identity)) return 'counter_slopes'
  if (identity.includes('дорожк') || identity.includes('walkway')) return 'walkways'
  if (identity.includes('огражден')) return 'guardrails'
  if (identity.includes('фахвер')) return 'fachwerks'
  if (identity.includes('дым')) return 'smoke_hatches'
  if (identity.includes('деформац')) return 'deformation_joints'

  return ''
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
    code: normalizeCellCode(link.stable_code || link.stableCode || '') || deriveTemplateCellCode({
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
    code: normalizeCellCode(option.stable_code || option.stableCode || '') || deriveTemplateCellCode({
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


function mergeSyntheticOptionSections({ system, selectedKeys = [], sections = [], worksDb, materialsDb }) {
  const labelMap = getOptionLabelMap(system)
  const sectionMap = new Map()

  for (const section of sections) {
    const featureCode = normalizeOptionKey(section.featureCode || '')
    if (featureCode && !sectionMap.has(featureCode)) {
      sectionMap.set(featureCode, section)
    }
  }

  const blocksByKey = new Map(
    getOptionEstimateBlocks(selectedKeys).map((block) => [normalizeOptionKey(block.sectionCode || ''), block])
  )

  for (const rawKey of selectedKeys) {
    const optionKey = normalizeOptionKey(rawKey)
    if (!optionKey) continue

    const block = blocksByKey.get(optionKey)
    if (!block) continue

    const title = labelMap.get(optionKey) || block.title || optionKey
    const targetSection = sectionMap.get(optionKey)

    const syntheticWorks = (block.works || [])
      .map((item, index) => createSyntheticWorkItem(block, item, worksDb, index))
      .filter(Boolean)
    const syntheticMaterials = (block.materials || [])
      .map((item, index) => createSyntheticMaterialItem(block, item, materialsDb, index))
      .filter(Boolean)

    if (targetSection) {
      targetSection.title = title
      targetSection.works = mergeSectionItems(targetSection.works || [], syntheticWorks, 'work')
      targetSection.materials = mergeSectionItems(targetSection.materials || [], syntheticMaterials, 'material')
      repairOptionSectionExpressions(targetSection, optionKey)
      continue
    }

    const newSection = {
      id: crypto.randomUUID(),
      title,
      featureCode: optionKey,
      works: syntheticWorks,
      materials: syntheticMaterials
    }

    if (newSection.works.length || newSection.materials.length) {
      sections.push(newSection)
      sectionMap.set(optionKey, newSection)
    }
  }

  mergeProflistRequiredSections({
    system,
    selectedKeys,
    sections,
    sectionMap,
    worksDb,
    materialsDb
  })

  return sections.map((section) => ({
    id: section.id || crypto.randomUUID(),
    title: section.title || 'Раздел',
    works: section.works || [],
    materials: section.materials || []
  }))
}

function buildDefaultOverheadExpenses() {
  return [
    { id: crypto.randomUUID(), name: 'Вывоз мусора', unit: 'рейс', qty: 1, price: 12800 },
    { id: crypto.randomUUID(), name: 'Кран', unit: 'смена', qty: 1, price: 44000 },
    { id: crypto.randomUUID(), name: 'Манипулятор', unit: 'смена', qty: 1, price: 28000 },
    { id: crypto.randomUUID(), name: 'Организационные и транспортные расходы', unit: 'ед', qty: 1, price: 564000 },
    { id: crypto.randomUUID(), name: 'Утилизация и вывоз мусора', unit: 'ед', qty: 1, price: 15000 }
  ]
}

function applyEstimateBusinessRules(sections = [], { system = {}, materialsDb = [], paramValues = {} } = {}) {
  const withoutWrongVaporConsumables = removeVaporTapeWhenParobarrierIsUsed(sections)
  return applyInsulationFastenerRules(withoutWrongVaporConsumables, { system, materialsDb, paramValues })
}

function removeVaporTapeWhenParobarrierIsUsed(sections = []) {
  return sections.map((section) => {
    const identity = normalize(`${section?.title || ''} ${(section?.materials || [])
      .map((item) => `${item?.name || ''} ${item?.base_name || ''}`)
      .join(' ')}`)

    if (!isParobarrierIdentity(identity)) {
      return section
    }

    return {
      ...section,
      materials: (section.materials || []).filter((material) => !isVaporTapeMaterial(material))
    }
  })
}

function applyInsulationFastenerRules(sections = [], { system = {}, materialsDb = [], paramValues = {} } = {}) {
  const proflist = isProflistSystem(system)
  const result = sections.map((section) => ({ ...section, materials: [...(section.materials || [])] }))

  for (const section of result) {
    if (!isInsulationSection(section)) {
      continue
    }

    if (isLowerInsulationSection(section)) {
      section.materials = section.materials.filter((material) => !isInsulationFastenerMaterial(material))
      continue
    }

    const selection = resolveInsulationFastenerSelection({
      system,
      paramValues,
      section
    })

    if (proflist) {
      section.materials = section.materials.filter((material) => !isFastenerType(material, 'sleeve'))
    }

    ensureInsulationFastenerMaterial(section, {
      type: 'telescope',
      materialsDb,
      selection,
      expression: 'S * [Крепеж утеплителя]',
      unit: 'шт'
    })
    ensureInsulationFastenerMaterial(section, {
      type: 'screw',
      materialsDb,
      selection,
      expression: 'S * [Крепеж утеплителя]',
      unit: 'шт'
    })

    if (!proflist) {
      ensureInsulationFastenerMaterial(section, {
        type: 'sleeve',
        materialsDb,
        selection,
        expression: 'S * [Крепеж утеплителя]',
        unit: 'шт'
      })
    }

    for (const material of section.materials || []) {
      const type = getInsulationFastenerType(material)
      if (!type || (proflist && type === 'sleeve')) continue
      decorateInsulationFastenerMaterial(material, {
        type,
        selection,
        materialsDb,
        expression: 'S * [Крепеж утеплителя]'
      })
    }
  }

  return result
}

function ensureInsulationFastenerMaterial(section, { type, materialsDb, selection, expression, unit }) {
  if ((section.materials || []).some((material) => isFastenerType(material, type))) {
    return
  }

  const material = createFastenerMaterialItem({
    type,
    code: nextSectionCellCode(section),
    materialsDb,
    selection,
    expression,
    unit
  })

  if (material) {
    section.materials.push(material)
  }
}

function createFastenerMaterialItem({ type, code, materialsDb, selection, expression, unit }) {
  const candidatesByType = {
    telescope: [
      'Телескопический крепеж TERMOCLIP 1',
      'Телескопический крепеж FACHMANN, 20 мм'
    ],
    screw: [
      'Саморез сверлоконечный TERMOCLIP Ø 4.8 мм',
      'Саморез сверлоконечный TERMOCLIP 4,8х',
      'Винт-саморез остроконечный FACHMANN NCRP-4,8x80мм'
    ],
    sleeve: [
      'Анкерный элемент TERMOCLIP 8x45',
      'Круглый тарельчатый держатель TERMOCLIP 1С',
      'Полиамидная гильза'
    ]
  }

  const candidates = candidatesByType[type] || []
  let found = null

  for (const name of candidates) {
    found = findMaterialRow(materialsDb, { name })
    if (found) break
  }

  const fallbackName = candidates[0] || 'Крепеж утеплителя'
  const displayName = found?.полное_наименование_материала || fallbackName

  const item = {
    id: crypto.randomUUID(),
    code,
    itemCode: found?.артикул_товара || found?.идентификатор || '',
    material_id: found?.идентификатор || null,
    base_name: found?.базовое_наименование || displayName,
    name: displayName,
    unit: found?.единица_измерения || unit || 'шт',
    expression: normalizeFormulaExpression(expression || 'S * [Крепеж утеплителя]'),
    qty: 0,
    price: Number(found?.базовая_цена || 0),
    total: 0,
    profile_name: '',
    profileThickness: null,
    thickness: null,
    thickness_unit: ''
  }

  decorateInsulationFastenerMaterial(item, {
    type,
    selection,
    materialsDb,
    expression
  })

  return item
}

const FASTENER_LENGTH_TABLE_PROFLIST = [
  [40, 20, 60], [50, 20, 80], [60, 20, 80], [70, 50, 60], [80, 60, 60],
  [90, 60, 80], [100, 80, 60], [110, 80, 80], [120, 100, 60], [130, 100, 80],
  [140, 120, 60], [150, 130, 60], [160, 140, 60], [170, 150, 60], [180, 150, 80],
  [190, 170, 60], [200, 180, 60], [210, 180, 80], [220, 200, 60], [230, 200, 80],
  [240, 220, 60], [250, 220, 80], [260, 240, 60], [270, 240, 80], [280, 260, 60],
  [290, 260, 80], [300, 260, 80], [310, 260, 100], [320, 300, 60], [330, 300, 80],
  [340, 300, 80], [350, 300, 100], [360, 300, 100], [370, 350, 60], [380, 350, 80],
  [390, 350, 80], [400, 350, 100], [410, 350, 100], [420, 350, 120], [430, 350, 120],
  [440, 350, 160], [450, 350, 160], [460, 350, 160], [470, 350, 160], [480, 350, 200],
  [490, 350, 200], [500, 350, 200], [510, 350, 200]
]

const FASTENER_LENGTH_TABLE_CONCRETE = [
  [40, 20, 80], [50, 20, 100], [60, 20, 100], [70, 50, 80], [80, 60, 80],
  [90, 60, 100], [100, 80, 80], [110, 80, 100], [120, 100, 80], [130, 100, 100],
  [140, 120, 80], [150, 130, 80], [160, 140, 80], [170, 150, 80], [180, 150, 100],
  [190, 170, 80], [200, 180, 80], [210, 180, 100], [220, 200, 80], [230, 200, 100],
  [240, 220, 80], [250, 220, 100], [260, 240, 80], [270, 240, 100], [280, 260, 80],
  [290, 260, 100], [300, 260, 100], [310, 260, 120], [320, 300, 80], [330, 300, 100],
  [340, 300, 100], [350, 300, 120], [360, 300, 120], [370, 350, 80], [380, 350, 100],
  [390, 350, 100], [400, 350, 120], [410, 350, 120], [420, 350, 160], [430, 350, 160],
  [440, 350, 160], [450, 350, 160], [460, 350, 200], [470, 350, 200], [480, 350, 200],
  [490, 350, 200]
]

function resolveInsulationFastenerSelection({ system = {}, paramValues = {}, section = {} } = {}) {
  const proflist = isProflistSystem(system)
  const thickness = resolveMainInsulationThickness(paramValues, section)
  const table = proflist ? FASTENER_LENGTH_TABLE_PROFLIST : FASTENER_LENGTH_TABLE_CONCRETE
  const row = table.find(([limit]) => thickness <= limit) || table[table.length - 1]

  return {
    base: proflist ? 'proflist' : 'concrete',
    thickness,
    tableThickness: row[0],
    telescopeLength: row[1],
    screwLength: row[2],
    sleeveLength: proflist ? '' : '8×45 мм'
  }
}

function resolveMainInsulationThickness(paramValues = {}, section = {}) {
  const direct = toNumber(
    paramValues.insulation_thickness ??
      paramValues.insulation_total_thickness ??
      paramValues.main_insulation_thickness,
    0
  )
  const lower = toNumber(paramValues.lower_insulation_thickness ?? paramValues.insulation_bottom_thickness, 0)
  const upper = toNumber(paramValues.upper_insulation_thickness ?? paramValues.insulation_top_thickness, 0)

  if (lower > 0 && upper > 0) {
    return lower + upper
  }

  if (direct > 0) {
    return direct
  }

  if (upper > 0) {
    return upper
  }

  if (lower > 0 && !isLowerInsulationSection(section)) {
    return lower
  }

  return 40
}

function decorateInsulationFastenerMaterial(material, { type, selection, materialsDb = [], expression = 'S * [Крепеж утеплителя]' } = {}) {
  const catalogRow = findFastenerCatalogRow(materialsDb, type, material)
  const length = type === 'telescope'
    ? selection?.telescopeLength
    : type === 'screw'
      ? selection?.screwLength
      : 45
  const variant = findFastenerVariant(catalogRow, type, selection)
  const label = type === 'sleeve' ? (selection?.sleeveLength || '8×45 мм') : `${length} мм`

  material.material_id = catalogRow?.идентификатор || material.material_id || null
  material.base_name = catalogRow?.базовое_наименование || material.base_name || material.name
  material.name = formatFastenerName(type, selection, catalogRow || material)
  material.unit = catalogRow?.единица_измерения || material.unit || 'шт'
  material.expression = normalizeFormulaExpression(expression || 'S * [Крепеж утеплителя]')
  material.variant_label = label
  material.profile_name = ''
  material.profileThickness = null
  material.thickness = Number(length) || null
  material.thickness_unit = type === 'sleeve' ? '' : 'мм'

  if (variant) {
    material.variant_id = variant.id
    material.selectedVariantId = variant.id
    material.itemCode = variant.sku || material.itemCode || catalogRow?.артикул_товара || catalogRow?.идентификатор || ''
    material.price = Number(variant.price || material.price || catalogRow?.базовая_цена || 0)
  } else {
    material.itemCode = catalogRow?.артикул_товара || catalogRow?.идентификатор || material.itemCode || ''
    material.price = Number(catalogRow?.базовая_цена || material.price || 0)
  }
}

function findFastenerCatalogRow(materialsDb = [], type = '', material = {}) {
  const candidatesByType = {
    telescope: ['Телескопический крепеж TERMOCLIP 1', 'Телескопический крепеж FACHMANN'],
    screw: ['Саморез сверлоконечный TERMOCLIP Ø 4.8 мм', 'Саморез сверлоконечный TERMOCLIP 4,8х', 'Винт-саморез остроконечный FACHMANN'],
    sleeve: ['Анкерный элемент TERMOCLIP 8x45', 'Круглый тарельчатый держатель TERMOCLIP 1С', 'Полиамидная гильза']
  }

  if (material?.material_id) {
    const byId = materialsDb.find((item) => Number(item.идентификатор) === Number(material.material_id))
    if (byId) return byId
  }

  const candidates = candidatesByType[type] || []
  for (const name of candidates) {
    const found = findMaterialRow(materialsDb, { name })
    if (found) return found
  }

  const identity = normalize(`${material?.name || ''} ${material?.base_name || ''}`)
  return materialsDb.find((item) => {
    const title = normalize(`${item?.полное_наименование_материала || ''} ${item?.базовое_наименование || ''}`)
    return title && identity && (identity.includes(title) || title.includes(identity))
  }) || null
}

function findFastenerVariant(catalogRow, type, selection = {}) {
  const variants = Array.isArray(catalogRow?.variants) ? catalogRow.variants : []
  if (!variants.length) return null

  if (type === 'telescope') {
    return variants.find((variant) => Number(variant.thickness_mm || 0) === Number(selection?.telescopeLength || 0)) || null
  }

  if (type === 'screw') {
    const target = Number(selection?.screwLength || 0)
    return variants.find((variant) => {
      const text = normalize(`${variant.variant_label || ''} ${variant.sku || ''} ${variant.profile_name || ''}`)
      return Number(variant.thickness_mm || 0) === target || text.includes(`${target}`)
    }) || null
  }

  if (type === 'sleeve') {
    return variants.find((variant) => normalize(`${variant.variant_label || ''} ${variant.sku || ''}`).includes('45')) || null
  }

  return null
}

function formatFastenerName(type, selection = {}, catalogRow = {}) {
  if (type === 'telescope') {
    return `Телескопический крепеж TERMOCLIP 1, ${selection?.telescopeLength || 20} мм`
  }

  if (type === 'screw') {
    return `Саморез сверлоконечный TERMOCLIP Ø 4,8×${selection?.screwLength || 60} мм`
  }

  if (type === 'sleeve') {
    return `Анкерный элемент TERMOCLIP ${selection?.sleeveLength || '8×45 мм'}`
  }

  return catalogRow?.полное_наименование_материала || catalogRow?.name || 'Крепеж утеплителя'
}

function getInsulationFastenerType(material = {}) {
  if (isFastenerType(material, 'telescope')) return 'telescope'
  if (isFastenerType(material, 'screw')) return 'screw'
  if (isFastenerType(material, 'sleeve')) return 'sleeve'
  return ''
}

function nextSectionCellCode(section) {
  const used = new Set()
  let max = 0

  for (const row of [...(section?.works || []), ...(section?.materials || [])]) {
    const code = normalizeCellCode(row?.code || '')
    if (!code) continue
    used.add(code)

    const match = code.match(/^C(\d+)$/i)
    if (match) {
      max = Math.max(max, toNumber(match[1]))
    }
  }

  let candidateNumber = Math.max(900, max + 1)
  while (used.has(`C${candidateNumber}`)) {
    candidateNumber += 1
  }

  return `C${candidateNumber}`
}

function isParobarrierIdentity(identity = '') {
  return identity.includes('паробарьер') || identity.includes('ca500') || identity.includes('са500')
}

function isVaporTapeMaterial(material = {}) {
  const identity = normalize(`${material?.name || ''} ${material?.base_name || ''}`)
  return identity.includes('скотч') || identity.includes('tape')
}

function isInsulationSection(section = {}) {
  const identity = normalize(`${section?.title || ''} ${(section?.materials || [])
    .map((item) => `${item?.name || ''} ${item?.base_name || ''}`)
    .join(' ')}`)

  if (
    identity.includes('пароизоляц') ||
    identity.includes('гидроизоляц') ||
    identity.includes('уклонообраз') ||
    identity.includes('контруклон') ||
    identity.includes('разуклон')
  ) {
    return false
  }

  return (
    identity.includes('теплоизоляц') ||
    identity.includes('утепл') ||
    identity.includes('logicpir') ||
    identity.includes('xps') ||
    identity.includes('минват') ||
    identity.includes('техноруф')
  )
}

function isLowerInsulationSection(section = {}) {
  const identity = normalize(`${section?.title || ''}`)
  return identity.includes('ниж') || identity.includes('lower')
}

function isInsulationFastenerMaterial(material = {}) {
  const identity = normalize(`${material?.name || ''} ${material?.base_name || ''}`)
  return (
    identity.includes('телескоп') ||
    identity.includes('саморез') ||
    identity.includes('винт') ||
    identity.includes('анкер') ||
    identity.includes('гильз') ||
    identity.includes('тарельчат') ||
    identity.includes('держател')
  )
}

function isFastenerType(material = {}, type = '') {
  const identity = normalize(`${material?.name || ''} ${material?.base_name || ''}`)

  if (type === 'telescope') {
    return identity.includes('телескоп')
  }

  if (type === 'screw') {
    return identity.includes('саморез') || identity.includes('винт')
  }

  if (type === 'sleeve') {
    return identity.includes('гильз') || identity.includes('анкер') || identity.includes('тарельчат') || identity.includes('держател')
  }

  return false
}

function mergeProflistRequiredSections({ system, selectedKeys = [], sections = [], sectionMap, worksDb, materialsDb }) {
  if (!isProflistSystem(system)) return

  mergeSyntheticBlockIntoSections({
    block: {
      title: 'Усиления и заполнение по профлисту',
      sectionCode: 'rib_fill',
      codeBases: { work: 520, material: 540 },
      works: [
        { name: 'Устройство L-образного профиля и профилей усиления', expression: 'LP', unit: 'м/п' },
        { name: 'Устройство профилей усиления (коньковые усиления, усиления ендов)', expression: 'RU', unit: 'м/п' },
        { name: 'Заполнение гофр профлиста утеплителем НГ на длину 250 мм', expression: 'CF', unit: 'м/п' }
      ],
      materials: [
        { name: 'L-образный профиль', expression: 'LP', unit: 'м/п' },
        { name: 'Профиль усиления (коньковые усиления, усиления ендов)', expression: 'RU', unit: 'м/п' },
        { name: 'NG', expression: 'CF * 0.25', unit: 'м2' }
      ]
    },
    sections,
    sectionMap,
    worksDb,
    materialsDb
  })

  const selected = new Set(normalizeSelectedTemplateOptionKeys(selectedKeys))
  if (!selected.has('inner_drains')) return

  mergeSyntheticBlockIntoSections({
    block: {
      title: 'Внутренние воронки',
      sectionCode: 'inner_drains',
      codeBases: { work: 530, material: 550 },
      works: [
        { name: 'Устройство усиления мест воронок внутреннего водоотведения из оц. стали толщиной 0,5 мм размером 0,6*0,6 м', expression: 'ID', unit: 'шт' },
        { name: 'Устройство заполнения гофр профлиста НГ утеплителем на длину 250 мм', expression: 'ID', unit: 'шт' }
      ],
      materials: [
        { name: 'Оцинкованный лист, толщ. 0,7 мм, 600*600 мм', expression: 'ID', unit: 'шт' },
        { name: 'NG', expression: 'ID * 0.25', unit: 'м2' }
      ]
    },
    sections,
    sectionMap,
    worksDb,
    materialsDb
  })
}

function mergeSyntheticBlockIntoSections({ block, sections, sectionMap, worksDb, materialsDb }) {
  const optionKey = normalizeOptionKey(block.sectionCode || '')
  if (!optionKey) return

  const syntheticWorks = (block.works || [])
    .map((item, index) => createSyntheticWorkItem(block, item, worksDb, index))
    .filter(Boolean)
  const syntheticMaterials = (block.materials || [])
    .map((item, index) => createSyntheticMaterialItem(block, item, materialsDb, index))
    .filter(Boolean)
  const targetSection = sectionMap.get(optionKey)

  if (targetSection) {
    targetSection.title = targetSection.title || block.title || optionKey
    targetSection.works = mergeSectionItems(targetSection.works || [], syntheticWorks, 'work')
    targetSection.materials = mergeSectionItems(targetSection.materials || [], syntheticMaterials, 'material')
    repairOptionSectionExpressions(targetSection, optionKey)
    return
  }

  if (!syntheticWorks.length && !syntheticMaterials.length) return

  const newSection = {
    id: crypto.randomUUID(),
    title: block.title || optionKey,
    featureCode: optionKey,
    works: syntheticWorks,
    materials: syntheticMaterials
  }

  sections.push(newSection)
  sectionMap.set(optionKey, newSection)
}

function repairOptionSectionExpressions(section, optionKey) {
  const shouldRepair = (expression) => {
    const compact = normalizeFormulaExpression(expression || '').replace(/\s+/g, '').toUpperCase()
    return ['', '0', '1', 'S', 'AREA', 'ШТ', 'ЕД', 'М2', 'М²'].includes(compact)
  }

  const byOption = {
    inner_drains: 'ID',
    outer_drains: 'OD',
    aerators: 'A',
    counter_slopes: 'K'
  }

  const baseExpression = byOption[optionKey]
  if (!baseExpression) return

  for (const work of section?.works || []) {
    if (rowMatchesOption(work, optionKey) && shouldRepair(work?.expression)) {
      work.expression = baseExpression
    }
  }

  if (optionKey !== 'counter_slopes') {
    for (const material of section?.materials || []) {
      if (rowMatchesOption(material, optionKey) && shouldRepair(material?.expression)) {
        material.expression = baseExpression
      }
    }
    return
  }

  for (const material of section?.materials || []) {
    const title = normalize(`${material?.name || ''} ${material?.base_name || ''}`)
    if (title.includes('pir') || title.includes('logicpir')) {
      material.expression = 'K * [Запас PIR]'
    } else if (title.includes('xps') || title.includes('carbon')) {
      material.expression = 'K * [Запас XPS]'
    } else if (shouldRepair(material?.expression)) {
      material.expression = 'K'
    }
  }
}

function rowMatchesOption(row, optionKey) {
  if (optionKey === 'counter_slopes') return true

  const identity = normalize(`${row?.name || ''} ${row?.base_name || ''}`)
  if (optionKey === 'aerators') return identity.includes('аэратор')
  if (optionKey === 'outer_drains') return isOuterDrainIdentity(identity)
  if (optionKey === 'inner_drains') return isInnerDrainIdentity(identity)
  return true
}

function isProflistSystem(system = {}) {
  const roofBase = normalize(`${system?.roof_base || system?.roofBase || system?.тип_основания || ''}`)
  return roofBase.includes('proflist') || roofBase.includes('профлист') || roofBase.includes('проф')
}

function mergeSectionItems(existingItems = [], syntheticItems = [], type = 'item') {
  const seen = new Set(existingItems.map((item) => getItemMergeKey(item, type)))
  const result = [...existingItems]

  for (const item of syntheticItems) {
    const key = getItemMergeKey(item, type)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }

  return result
}

function getItemMergeKey(item = {}, type = 'item') {
  const codePart = `${item.itemCode || ''}`.trim()
  const namePart = normalize(`${item.name || ''}`)
  const unitPart = normalize(`${item.unit || ''}`)
  return `${type}:${codePart}:${namePart}:${unitPart}`
}

function getOptionLabelMap(system) {
  const result = new Map()
  const rawOptions = Array.isArray(system?.features)
    ? system.features
    : Array.isArray(system?.опции)
      ? system.опции
      : Array.isArray(system?.options)
        ? system.options
        : []

  for (const option of rawOptions) {
    const key = normalizeOptionKey(option?.code || option?.key || '')
    const label = `${option?.name || option?.label || ''}`.trim()
    if (key && label) {
      result.set(key, label)
    }
  }

  return result
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
    return formulasMap.get('WALKWAY_PUZZLE_COUNT') || 'WL / [Длина Puzzle]'
  }

  if (role === 'tape') {
    return formulasMap.get('PAROBARRIER_TAPE') || 'S * [Скотч пароизоляции]'
  }

  if (role === 'primer_bucket') {
    return formulasMap.get('PRIMER_BUCKETS') || 'S * [Расход праймера]'
  }

  if (role === 'gas') {
    return formulasMap.get('BURNER_GAS') || 'S * [Газ для горелки]'
  }

  if (role === 'cleaner') {
    return formulasMap.get('PVC_CLEANER') || 'S * [Очиститель ПВХ]'
  }

  if (role === 'adhesive') {
    return formulasMap.get('XPS_ADHESIVE') || 'S * [Клей-пена XPS]'
  }

  if (featureCode === 'parapets') {
    if (role === 'main_membrane') {
      return formulasMap.get('PARAPET_MAIN_MEMBRANE') || 'P * [Мембрана на парапет]'
    }
    if (role === 'aux_membrane') {
      return formulasMap.get('PARAPET_AUX_MEMBRANE') || 'P * [Доборная мембрана парапета]'
    }
    if (role === 'planck') {
      return formulasMap.get('PERIMETER') || 'P'
    }
    if (role === 'planck_fastener') {
      return formulasMap.get('PARAPET_FASTENERS') || 'P * [Крепеж планок]'
    }
    if (role === 'sealant') {
      return formulasMap.get('PARAPET_SEALANT') || 'P * [Герметик планок]'
    }
  }

  if (role === 'fastener') {
    if (layerKind === 'waterproofing') {
      return formulasMap.get('MEMBRANE_FASTENERS') || 'S * [Крепеж мембраны]'
    }

    return formulasMap.get('INSULATION_FASTENERS') || 'S * [Крепеж утеплителя]'
  }

  if (layerKind === 'primer' || materialText.includes('праймер')) {
    return formulasMap.get('PRIMER_BUCKETS') || 'S * [Расход праймера]'
  }

  if (layerKind === 'separator') {
    return formulasMap.get('GLASS_FLEECE_AREA') || 'S * [Стеклохолст]'
  }

  if (layerKind === 'waterproofing') {
    if (waterproofingType.includes('pvc')) {
      return formulasMap.get('PVC_AREA') || 'S * [ПВХ рулон 2,1 м]'
    }

    if (waterproofingType.includes('brm') || waterproofingType.includes('битум') || waterproofingType.includes('roll')) {
      return formulasMap.get('BRM_AREA') || 'S * [БРМ нахлест 85/150]'
    }

    return formulasMap.get('AREA') || 'S'
  }

  if (layerKind === 'vapor_barrier') {
    if (materialText.includes('скотч')) {
      return formulasMap.get('PAROBARRIER_TAPE') || 'S * [Скотч пароизоляции]'
    }
    if (materialText.includes('праймер')) {
      return formulasMap.get('PRIMER_BUCKETS') || 'S * [Расход праймера]'
    }
    if (materialText.includes('газ')) {
      return formulasMap.get('BURNER_GAS') || 'S * [Газ для горелки]'
    }
    return formulasMap.get('PAROBARRIER_AREA') || 'S * [Запас пароизоляции]'
  }

  if (materialText.includes('очиститель')) {
    return formulasMap.get('PVC_CLEANER') || 'S * [Очиститель ПВХ]'
  }

  if (materialText.includes('профилированный лист')) {
    return formulasMap.get('AREA') || 'S'
  }

  if (featureCode === 'counter_slopes' || layerKind === 'slope' || isCounterSlopeIdentity(materialText)) {
    if (materialText.includes('мин') || materialText.includes('wool') || materialText.includes('техноруф')) {
      return formulasMap.get('COUNTER_SLOPE_MINERAL_WOOL_AREA') || 'K * [Запас минваты]'
    }

    if (materialText.includes('xps') || materialText.includes('carbon')) {
      return formulasMap.get('COUNTER_SLOPE_XPS_AREA') || 'K * [Запас XPS]'
    }

    if (materialText.includes('pir') || materialText.includes('logicpir')) {
      return formulasMap.get('COUNTER_SLOPE_PIR_AREA') || 'K * [Запас PIR]'
    }

    return formulasMap.get('COUNTER_SLOPE_AREA') || 'K'
  }

  if (layerKind === 'insulation' || layerKind === 'slope') {
    const thickness = resolveLayerThickness(layer, paramValues)

    if (materialText.includes('мин') || materialText.includes('wool') || materialText.includes('техноруф')) {
      return applyThickness(
        formulasMap.get('MINERAL_WOOL_VOLUME') || 'S * T / 1000 * [Запас минваты]',
        thickness
      )
    }

    if (materialText.includes('xps') || materialText.includes('carbon')) {
      return applyThickness(
        formulasMap.get('XPS_VOLUME') || 'S * T / 1000 * [Запас XPS]',
        thickness
      )
    }

    if (materialText.includes('pir') || materialText.includes('logicpir')) {
      return formulasMap.get('PIR_AREA_THICKNESS') || 'S * [Запас PIR]'
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
  return `${expression || 'S'}`.replace(/\bT\b/g, `${toNumber(thickness)}`).trim()
}

function findWorkRow(worksDb, { id, name }) {
  if (id) {
    const byId = worksDb.find((item) => Number(item.идентификатор) === Number(id))
    if (byId) return byId
  }

  if (name) {
    const target = normalize(name)
    if (!target) return null
    const exact = worksDb.find((item) => equalsNormalized(item.наименование_работы, target))
    if (exact) return exact
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
    if (!target) return null
    const exact = materialsDb.find((item) => equalsNormalized(item.полное_наименование_материала, target))
    if (exact) return exact
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
  ['SH', 'Люки дымоудаления', ['smoke_hatches_count', 'smoke_hatch_count']],
  ['NG', 'Негорючий защитный материал', ['noncombustible_fill_area', 'fire_break_area']],
  ['OV', 'Узлы ОВ', ['ov_count']],
  ['VK', 'Узлы ВК', ['vk_count']],
  ['VKL', 'Длина примыканий ВК', ['vk_length']],
  ['PDL', 'Примыкания к тумбам', ['pedestal_perimeter']],
  ['PDC', 'Тумбы / кровельные подставки', ['pedestal_count']],
  ['AI', 'Воздухозаборы', ['air_intake_count']],
  ['VF', 'Промышленные вентиляторы', ['fan_count']],
  ['EX', 'Вытяжки / дефлекторы', ['exhaust_count']],
  ['AC', 'Стойки блоков кондиционеров', ['condenser_support_count', 'ac_stand_count']],
  ['CG', 'Гусаки для ввода кабеля', ['cable_gooseneck_count']],
  ['PT', 'Проходки', ['pass_through_count', 'pass_general_count']],
  ['PTS', 'Проходки малого сечения', ['pass_through_small_count', 'pass_small_count']],
  ['PTM', 'Проходки среднего сечения', ['pass_through_medium_count', 'pass_medium_count']],
  ['VS', 'Примыкания к вентшахтам', ['vent_shaft_perimeter']],
  ['GR', 'Кровельное ограждение', ['guardrail_length']],
  ['GRC', 'Стойки ограждения', ['guardrail_post_count']],
  ['SC', 'Площадь стяжки', ['screed_area']],
  ['PA', 'Площадь праймирования', ['primer_area']],
  ['WZA', 'Площадь ветровых зон', ['wind_zone_area']],
  ['RB', 'Заполнение гофр / L-профиль', ['base_profile_rib_fill_length', 'corrugation_fill_length']],
  ['LP', 'L-профиль', ['l_profile_length']],
  ['RU', 'Коньковые усиления / ендовы', ['ridge_reinforcement_length']],
  ['DFP', 'Профиль усиления деф. шва', ['def_joint_profile_length']],
  ['CF', 'Заполнение гофр', ['corrugation_fill_length', 'base_profile_rib_fill_length']],
  ['DR', 'Усиления внутренних воронок', ['inner_drain_reinforcement_count', 'inner_drains_count']]
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

function resolvePrimaryParamValue(paramValues, keys = []) {
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

  const scope = {
    ...buildZoneScope({
      roofParams: {
        area: resolvePrimaryParamValue(paramValues, ['roof_area']),
        perimeter: resolvePrimaryParamValue(paramValues, ['parapet_perimeter', 'parapet_length', 'roof_perimeter']),
        parapetDrains: resolvePrimaryParamValue(paramValues, ['outer_drains_count', 'outer_drain_count']),
        innerDrains: resolvePrimaryParamValue(paramValues, ['inner_drains_count', 'inner_drain_count', 'internal_drains_count']),
        aerators: resolvePrimaryParamValue(paramValues, ['aerators_count', 'aerator_count'])
      },
      customParams
    })
  }

  for (const [key, rawValue] of Object.entries(paramValues || {})) {
    const value = Number(rawValue)
    if (Number.isFinite(value)) {
      scope[key] = value
    }
  }

  return scope
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
  if (text.includes('аэратор')) return 'A'
  if (isOuterDrainIdentity(text)) return 'OD'
  if (isInnerDrainIdentity(text)) return 'ID'
  if (isCounterSlopeIdentity(text)) return 'K'
  if (text.includes('дорож')) return 'WL'
  return 'S'
}

function normalizeExpression(expression) {
  return normalizeFormulaExpression(expression)
}

function normalizeOptionKey(value) {
  return normalizeSelectedTemplateOptionKeys([value])[0] || `${value || ''}`
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[\/()-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
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
function equalsNormalized(left, right) {
  const a = normalize(left)
  const b = normalize(right)
  return Boolean(a && b && a === b)
}
