function normalize(value) {
  return `${value || ''}`
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function parseOptions(value) {
  if (Array.isArray(value)) return [...value]
  if (typeof value !== 'string' || !value.trim()) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
}

function buildNumberParam(key, label, unit = '', description = '', group = 'additional', value = 0, extra = {}) {
  return {
    key,
    label,
    type: 'number',
    unit,
    value,
    group,
    description,
    ...extra
  }
}

function buildSelectParam(key, label, options = [], unit = '', description = '', group = 'layers', value = '', extra = {}) {
  return {
    key,
    label,
    type: 'select',
    unit,
    options,
    value: value || options[0] || '',
    group,
    description,
    ...extra
  }
}

function buildOption(key, label, sort = 999, params = [], isDefault = false) {
  return {
    key,
    label,
    sort,
    default: Boolean(isDefault),
    params: params.map((param) => ({
      ...clone(param),
      ownerKeys: Array.isArray(param.ownerKeys) && param.ownerKeys.length ? [...param.ownerKeys] : [key]
    }))
  }
}

function mergeOwnerKeys(current, incoming) {
  const merged = new Set([
    ...(Array.isArray(current) ? current : []),
    ...(Array.isArray(incoming) ? incoming : [])
  ])
  return merged.size ? [...merged] : undefined
}

function mergeParams(baseParams = [], extraParams = []) {
  const map = new Map()

  for (const item of [...baseParams, ...extraParams]) {
    if (!item?.key) continue

    const nextItem = {
      ...clone(item),
      options: parseOptions(item.options),
      ownerKeys: Array.isArray(item.ownerKeys) && item.ownerKeys.length ? [...item.ownerKeys] : undefined
    }

    if (!map.has(item.key)) {
      map.set(item.key, nextItem)
      continue
    }

    const current = map.get(item.key)
    map.set(item.key, {
      ...current,
      ...nextItem,
      description: nextItem.description || current.description || '',
      group: nextItem.group || current.group || 'basic',
      type: nextItem.type || current.type || 'number',
      unit: nextItem.unit || current.unit || '',
      value: nextItem.value ?? current.value ?? 0,
      options: nextItem.options.length ? nextItem.options : current.options,
      ownerKeys: mergeOwnerKeys(current.ownerKeys, nextItem.ownerKeys)
    })
  }

  return [...map.values()]
}

function mergeOptions(baseOptions = [], extraOptions = []) {
  const map = new Map()

  for (const item of [...baseOptions, ...extraOptions]) {
    if (!item?.key) continue

    const nextItem = {
      ...clone(item),
      params: Array.isArray(item.params) ? item.params.map((param) => ({
        ...clone(param),
        ownerKeys: Array.isArray(param.ownerKeys) && param.ownerKeys.length ? [...param.ownerKeys] : [item.key]
      })) : []
    }

    if (!map.has(item.key)) {
      map.set(item.key, nextItem)
      continue
    }

    const current = map.get(item.key)
    map.set(item.key, {
      ...current,
      ...nextItem,
      default: nextItem.default ?? current.default ?? false,
      sort: nextItem.sort ?? current.sort ?? 999,
      params: mergeParams(current.params || [], nextItem.params || [])
    })
  }

  return [...map.values()].sort((a, b) => (toNumber(a.sort, 999) - toNumber(b.sort, 999)))
}

function inferContext(system = {}) {
  const roofBase = normalize(
    system?.roofBase ||
    system?.roof_base ||
    system?.тип_основания ||
    system?.base ||
    ''
  )

  const waterproofing = normalize(
    system?.waterproofing ||
    system?.waterproofing_type ||
    system?.тип_гидроизоляции ||
    system?.hydro ||
    ''
  )

  const name = normalize(system?.name || system?.название || '')

  return {
    roofBase,
    waterproofing,
    name,
    isProflist: roofBase.includes('prof') || roofBase.includes('лист'),
    isConcrete: roofBase.includes('бет') || roofBase.includes('concrete') || roofBase.includes('жб') || roofBase.includes('ж/б'),
    isPvc: waterproofing.includes('pvc') || waterproofing.includes('пвх') || name.includes('пвх'),
    isBrm: waterproofing.includes('brm') || waterproofing.includes('бит') || name.includes('брм')
  }
}

function applyBaseParamVisibilityRules(params = []) {
  return params.map((param) => {
    const key = normalize(param?.key)

    if (
      key === 'parapet_perimeter' ||
      key === 'parapet_length' ||
      key === 'roof_perimeter'
    ) {
      return {
        ...param,
        ownerKeys: mergeOwnerKeys(param.ownerKeys, ['parapets'])
      }
    }

    return { ...param }
  })
}

function buildCommonEnhancements() {
  return {
    params: [],
    options: [
      buildOption('parapets', 'Примыкания к парапету', 40, [
        buildNumberParam('parapet_perimeter_sandwich', 'Примыкания к парапету по сэндвич-панели', 'м/п', 'Отдельная длина примыканий по сэндвич-панели', 'details'),
        buildNumberParam('parapet_perimeter_concrete', 'Примыкания к парапету по ж/б', 'м/п', 'Отдельная длина примыканий по ж/б панели или плите', 'details')
      ], true),
      buildOption('outer_drains', 'Внешние воронки', 20, [
        buildNumberParam('outer_drain_length', 'Длина наружной водосточной системы', 'м/п', 'Длина желоба, прямых звеньев или вертикальной водосточной трубы', 'drainage'),
        buildNumberParam('anti_icing_cable_length', 'Кабель противообледенения', 'м/п', 'Длина прогревочного кабеля', 'drainage')
      ]),
      buildOption('cornice', 'Карнизный свес', 60, [
        buildNumberParam('cornice_length', 'Примыкания к карнизному свесу', 'м/п', 'Нужны для карнизного свеса, капельника и наружной водосточной системы', 'details')
      ]),
      buildOption('counter_slopes', 'Контруклоны', 65, [
        buildNumberParam('counter_slope_area', 'Площадь контруклонов', 'м2', 'Суммарная площадь клиновидных элементов или контруклонов', 'details')
      ]),
      buildOption('deformation_joints', 'Деформационные швы', 70, [
        buildNumberParam('deformation_joint_length', 'Деформационные швы', 'м/п', 'Суммарная длина деформационных швов', 'details')
      ]),
      buildOption('fachwerks', 'Стойки фахверка', 80, [
        buildNumberParam('fachwerk_count', 'Стойки фахверка', 'шт', 'Количество стоек фахверка с примыканиями', 'engineering')
      ]),
      buildOption('smoke_hatches', 'Люки дымоудаления', 90, [
        buildNumberParam('smoke_hatches_count', 'Люки дымоудаления', 'шт', 'Количество люков дымоудаления или зенитных фонарей', 'engineering')
      ]),
      buildOption('fire_protection', 'Противопожарные рассечки', 100, [
        buildNumberParam('noncombustible_fill_area', 'Негорючий защитный материал', 'м2', 'Площадь противопожарных рассечек или защитного материала NG', 'engineering')
      ]),
      buildOption('ov_vk', 'Узлы ОВ / ВК', 110, [
        buildNumberParam('ov_count', 'Узлы ОВ', 'шт', 'Количество узлов системы ОВ', 'engineering'),
        buildNumberParam('vk_count', 'Узлы ВК', 'шт', 'Количество узлов системы ВК', 'engineering'),
        buildNumberParam('vk_length', 'Длина примыканий ВК', 'м/п', 'Если узлы ВК считаются по длине, а не только поштучно', 'engineering')
      ]),
      buildOption('pedestals', 'Тумбы и кровельные подставки', 120, [
        buildNumberParam('pedestal_count', 'Тумбы / кровельные подставки', 'шт', 'Количество тумб или кровельных подставок', 'engineering')
      ]),
      buildOption('air_intakes', 'Воздухозаборы', 130, [
        buildNumberParam('air_intake_count', 'Воздухозаборы', 'шт', 'Количество примыканий к воздухозаборам', 'engineering')
      ]),
      buildOption('fans', 'Промышленные вентиляторы', 140, [
        buildNumberParam('fan_count', 'Промышленные вентиляторы', 'шт', 'Количество примыканий к вентиляторам', 'engineering')
      ]),
      buildOption('exhausts', 'Вытяжки и дефлекторы', 150, [
        buildNumberParam('exhaust_count', 'Вытяжки / дефлекторы', 'шт', 'Количество вытяжек, В, ВД, ПД, дефлекторов и похожих проходок', 'engineering')
      ]),
      buildOption('condensers', 'Блоки кондиционеров', 160, [
        buildNumberParam('condenser_support_count', 'Стойки блоков кондиционеров', 'шт', 'Количество примыканий к стойкам блоков кондиционеров', 'engineering')
      ]),
      buildOption('cable_goosenecks', 'Гусаки для ввода кабеля', 165, [
        buildNumberParam('cable_gooseneck_count', 'Гусаки для ввода кабеля', 'шт', 'Количество примыканий к гусакам', 'engineering')
      ]),
      buildOption('small_penetrations', 'Проходки малого сечения', 170, [
        buildNumberParam('pass_through_small_count', 'Проходки малого сечения', 'шт', 'До 150 мм: гусаки, трубы и выводы', 'engineering')
      ]),
      buildOption('medium_penetrations', 'Проходки среднего сечения', 180, [
        buildNumberParam('pass_through_medium_count', 'Проходки среднего сечения', 'шт', 'От 150 до 300 мм: дефлекторы, круглые трубы', 'engineering')
      ]),
      buildOption('other_penetrations', 'Прочие проходки', 185, [
        buildNumberParam('pass_through_count', 'Прочие проходки', 'шт', 'Общее количество проходок через кровлю', 'engineering')
      ]),
      buildOption('vent_shafts', 'Вентиляционные шахты', 190, [
        buildNumberParam('vent_shaft_perimeter', 'Примыкания к вентшахтам', 'м/п', 'Суммарная длина примыканий к вентиляционным шахтам', 'engineering')
      ]),
      buildOption('guardrails', 'Кровельное ограждение', 200, [
        buildNumberParam('guardrail_length', 'Кровельное ограждение', 'м/п', 'Длина ограждающей конструкции', 'safety'),
        buildNumberParam('guardrail_post_count', 'Стойки ограждения', 'шт', 'Количество стоек ограждения', 'safety')
      ])
    ]
  }
}

function buildPvcProflistEnhancements() {
  return {
    params: [
      buildSelectParam('membrane_roll_width', 'Ширина ПВХ-мембраны', ['2 м', '1 м'], '', 'Можно зафиксировать тип раскладки по аналогии со сметами', 'layers', '2 м')
    ],
    options: [
      buildOption('wind_zones', 'Ветровые зоны', 45, [
        buildNumberParam('wind_zone_area', 'Площадь ветровых зон', 'м2', 'Если мембрана в ветровых зонах считается отдельной строкой', 'details')
      ]),
      buildOption('rib_fill', 'Заполнение гофр / L-профиль', 46, [
        buildNumberParam('base_profile_rib_fill_length', 'Заполнение гофр / L-профиль', 'м/п', 'Длина участков с заполнением гофр и L-профилем', 'details')
      ]),
      buildOption('walkways', 'Пешеходные дорожки', 50, [
        buildNumberParam('walkways_length', 'Пешеходные дорожки', 'м/п', 'Суммарная длина дорожек', 'safety'),
        buildNumberParam('walkways_count', 'Walkway Puzzle, шт', 'шт', 'Если дорожки считаются поштучно', 'safety')
      ])
    ]
  }
}

function buildPvcConcreteEnhancements() {
  return {
    params: [],
    options: [
      buildOption('concrete_nodes', 'Узлы по ж/б основанию', 44, [
        buildNumberParam('concrete_area', 'Площадь по ж/б основанию', 'м2', 'Если часть кровли или узлов считается по бетонному основанию', 'basic')
      ]),
      buildOption('pedestals', 'Тумбы и кровельные подставки', 120, [
        buildNumberParam('pedestal_count', 'Тумбы / кровельные подставки', 'шт', 'Количество тумб или кровельных подставок', 'engineering'),
        buildNumberParam('pedestal_perimeter', 'Примыкания к тумбам', 'м/п', 'Если тумбы считаются по длине', 'engineering')
      ]),
      buildOption('vent_shafts', 'Вентиляционные шахты', 190, [
        buildNumberParam('vent_shaft_perimeter', 'Примыкания к вентшахтам', 'м/п', 'Суммарная длина примыканий к вентиляционным шахтам', 'engineering')
      ])
    ]
  }
}

function buildBrmEnhancements() {
  return {
    params: [
      buildNumberParam('screed_area', 'Площадь стяжки', 'м2', 'Если площадь стяжки отличается от площади кровли', 'layers'),
      buildNumberParam('primer_area', 'Площадь праймирования', 'м2', 'Для наплавляемых систем по плоскости и парапетам', 'layers')
    ],
    options: [
      buildOption('aerators', 'Аэраторы', 30, [
        buildNumberParam('aerators_count', 'Количество аэраторов', 'шт', 'Кровельные аэраторы', 'drainage')
      ]),
      buildOption('deformation_joints', 'Деформационные швы', 70, [
        buildNumberParam('deformation_joint_length', 'Деформационные швы', 'м/п', 'Суммарная длина деформационных швов', 'details')
      ])
    ]
  }
}

export function getSystemTitle(system = {}) {
  return system?.название || system?.name || 'Система'
}

export function getEnhancedTemplateMeta(system = {}) {
  const context = inferContext(system)
  const common = buildCommonEnhancements()
  const specific = []

  if (context.isPvc && context.isProflist) {
    specific.push(buildPvcProflistEnhancements())
  }

  if (context.isPvc && context.isConcrete) {
    specific.push(buildPvcConcreteEnhancements())
  }

  if (context.isBrm) {
    specific.push(buildBrmEnhancements())
  }

  const baseParamsRaw = Array.isArray(system?.параметры) ? system.параметры : Array.isArray(system?.params) ? system.params : []
  const baseOptions = Array.isArray(system?.опции) ? system.опции : Array.isArray(system?.options) ? system.options : []

  const extraParams = [...(common.params || [])]
  const extraOptions = [...(common.options || [])]

  for (const item of specific) {
    extraParams.push(...(item.params || []))
    extraOptions.push(...(item.options || []))
  }

  return {
    context,
    params: mergeParams(applyBaseParamVisibilityRules(baseParamsRaw), extraParams),
    options: mergeOptions(baseOptions, extraOptions)
  }
}

export function getEffectiveTemplateParams(system = {}, selectedKeys = []) {
  const meta = getEnhancedTemplateMeta(system)
  const selected = new Set(Array.isArray(selectedKeys) ? selectedKeys : [])

  const visibleBaseParams = (meta.params || []).filter((param) => {
    if (!Array.isArray(param.ownerKeys) || !param.ownerKeys.length) {
      return true
    }

    return param.ownerKeys.some((key) => selected.has(key))
  })

  const selectedOptionParams = []
  for (const option of meta.options || []) {
    if (selected.has(option.key) && Array.isArray(option.params)) {
      selectedOptionParams.push(...option.params)
    }
  }

  return mergeParams(visibleBaseParams, selectedOptionParams)
}

export function sanitizeTemplateParamValues(system = {}, selectedKeys = [], values = {}) {
  const visibleKeys = new Set(
    getEffectiveTemplateParams(system, selectedKeys)
      .map((param) => param?.key)
      .filter(Boolean)
  )

  return Object.fromEntries(
    Object.entries(values || {}).filter(([key]) => visibleKeys.has(key))
  )
}

export function sanitizeParamValues(system = {}, selectedKeys = [], values = {}) {
  return sanitizeTemplateParamValues(system, selectedKeys, values)
}

export function enhanceTemplateSystem(system = {}) {
  const meta = getEnhancedTemplateMeta(system)
  return {
    ...system,
    context: meta.context,
    параметры: meta.params,
    params: meta.params,
    опции: meta.options,
    options: meta.options
  }
}



export default {
  getSystemTitle,
  getEnhancedTemplateMeta,
  getEffectiveTemplateParams,
  sanitizeTemplateParamValues,
  sanitizeParamValues,
  enhanceTemplateSystem
}
