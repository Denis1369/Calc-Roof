function getTierPrice(priceTiers, areaFrom, areaTo) {
  const tier = priceTiers.find(
    (item) =>
      Number(item.area_from) === areaFrom &&
      ((item.area_to === null && areaTo === null) ||
        Number(item.area_to) === areaTo)
  )

  return Number(tier?.price ?? 0)
}

export function toLegacyMaterialRow(material) {
  return {
    идентификатор: material.id,
    главная_категория: material.category || '',
    подкатегория: material.subcategory || '',
    артикул_товара: '',
    полное_наименование_материала: material.display_name || '',
    единица_измерения: material.unit || '',
    базовая_цена: Number(material.base_price ?? 0),
    ссылка: material.source_url || '',
    бренд: material.brand || '',
    модель: material.model || '',
    тип_материала: material.material_type || '',
    базовое_наименование: material.base_name || '',
    избранное: 0,
    variants: material.variants || [],
    raw: material
  }
}

export function toLegacyWorkRow(work) {
  const priceTiers = work.price_tiers || []

  return {
    идентификатор: work.id,
    категория_работы: work.category || '',
    наименование_работы: work.name || '',
    единица_измерения_работы: work.unit || '',
    цена_0_300: getTierPrice(priceTiers, 0, 300),
    цена_300_600: getTierPrice(priceTiers, 300, 600),
    цена_600_1000: getTierPrice(priceTiers, 600, 1000),
    цена_1000_3000: getTierPrice(priceTiers, 1000, 3000),
    цена_3000_6000: getTierPrice(priceTiers, 3000, 6000),
    цена_6000_15000: getTierPrice(priceTiers, 6000, 15000),
    цена_15000_30000: getTierPrice(priceTiers, 15000, 30000),
    цена_более_30000: getTierPrice(priceTiers, 30000, null),
    raw: work
  }
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return []
  return options.map((item) => `${item}`).filter(Boolean)
}

function inferParamGroup(code) {
  const key = `${code || ''}`.toLowerCase()

  if (
    key.includes('thickness') ||
    key.includes('profile') ||
    key.includes('membrane') ||
    key.includes('layers')
  ) {
    return 'layers'
  }

  if (
    key.includes('count') ||
    key.includes('length') ||
    key.includes('joint') ||
    key.includes('walkway') ||
    key.includes('drain')
  ) {
    return 'additional'
  }

  return 'basic'
}

function toParamValue(param) {
  if (param.param_type === 'number') {
    const number = Number(param.default_value)
    return Number.isFinite(number) ? number : 0
  }

  return param.default_value ?? ''
}

function getSyntheticFeatureParams(featureCode) {
  const code = `${featureCode || ''}`.toLowerCase()

  if (code === 'inner_drains') {
    return [
      {
        key: 'inner_drains_count',
        label: 'Количество внутренних воронок',
        type: 'number',
        unit: 'шт',
        value: 0,
        group: 'additional',
        description: 'Количество внутренних водоприемных воронок'
      }
    ]
  }

  if (code === 'outer_drains') {
    return [
      {
        key: 'outer_drains_count',
        label: 'Количество внешних воронок',
        type: 'number',
        unit: 'шт',
        value: 0,
        group: 'additional',
        description: 'Количество внешних воронок или элементов наружного водоотведения'
      }
    ]
  }

  if (code === 'aerators') {
    return [
      {
        key: 'aerators_count',
        label: 'Количество аэраторов',
        type: 'number',
        unit: 'шт',
        value: 0,
        group: 'additional',
        description: 'Количество кровельных аэраторов'
      }
    ]
  }

  if (code === 'walkways') {
    return [
      {
        key: 'walkways_length',
        label: 'Длина пешеходных дорожек',
        type: 'number',
        unit: 'м/п',
        value: 0,
        group: 'additional',
        description: 'Общая длина пешеходных дорожек'
      }
    ]
  }

  if (code === 'deformation_joints') {
    return [
      {
        key: 'deformation_joint_length',
        label: 'Длина деформационных швов',
        type: 'number',
        unit: 'м/п',
        value: 0,
        group: 'additional',
        description: 'Суммарная длина деформационных швов'
      }
    ]
  }

  if (code === 'ventilation' || code === 'vent_shafts' || code === 'ventilation_shafts') {
    return [
      {
        key: 'vent_shaft_perimeter',
        label: 'Примыкания к вентшахтам',
        type: 'number',
        unit: 'м/п',
        value: 0,
        group: 'engineering',
        description: 'Суммарная длина примыканий к вентиляционным шахтам'
      }
    ]
  }

  if (code === 'guardrails' || code === 'guardrail' || code === 'roof_fencing') {
    return [
      {
        key: 'guardrail_length',
        label: 'Кровельное ограждение',
        type: 'number',
        unit: 'м/п',
        value: 0,
        group: 'safety',
        description: 'Длина ограждающей конструкции'
      },
      {
        key: 'guardrail_post_count',
        label: 'Стойки ограждения',
        type: 'number',
        unit: 'шт',
        value: 0,
        group: 'safety',
        description: 'Количество стоек ограждения'
      }
    ]
  }

  if (code === 'pass_throughs') {
    return [
      {
        key: 'pass_through_count',
        label: 'Количество проходок',
        type: 'number',
        unit: 'шт',
        value: 0,
        group: 'additional',
        description: 'Количество проходных элементов'
      }
    ]
  }

  return []
}

export function toSystemListItem(system) {
  return {
    идентификатор: system.id,
    код: system.code,
    название: system.name,
    тип_основания: system.roof_base || '',
    тип_гидроизоляции: system.waterproofing_type || '',
    семейство_утеплителя: system.insulation_family || '',
    превью: '',
    source_url: system.source_url || '',
    notes: system.notes || '',
    raw: system
  }
}

export function toSystemTemplateView(fullSystem) {
  if (!fullSystem) {
    return null
  }

  const params = (fullSystem.params || []).map((param) => ({
    key: param.code,
    label: param.name,
    type: param.param_type || 'text',
    unit: param.unit || '',
    value: toParamValue(param),
    options: normalizeOptions(param.options),
    description: param.description || '',
    group: inferParamGroup(param.code)
  }))

  const options = (fullSystem.features || []).map((feature) => ({
    key: feature.code,
    label: feature.name,
    default: Boolean(feature.is_default),
    params: getSyntheticFeatureParams(feature.code)
  }))

  return {
    идентификатор: fullSystem.id,
    код: fullSystem.code,
    название: fullSystem.name,
    тип_основания: fullSystem.roof_base || '',
    тип_гидроизоляции: fullSystem.waterproofing_type || '',
    семейство_утеплителя: fullSystem.insulation_family || '',
    превью: '',
    параметры: params,
    опции: options,
    слои: fullSystem.layers || [],
    default_override: fullSystem.default_override || null,
    raw: fullSystem
  }
}