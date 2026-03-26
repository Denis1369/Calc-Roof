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


const OPTION_ALIASES = {
  parapets: 'parapets',
  parapet: 'parapets',
  inner_drains: 'inner_drains',
  inner_drain: 'inner_drains',
  internal_drains: 'inner_drains',
  outer_drains: 'outer_drains',
  outer_drain: 'outer_drains',
  external_drains: 'outer_drains',
  aerators: 'aerators',
  aerator: 'aerators',
  walkways: 'walkways',
  walkway: 'walkways',
  cornice: 'cornice',
  counter_slopes: 'counter_slopes',
  counterslopes: 'counter_slopes',
  deformation_joints: 'deformation_joints',
  deformation_joint: 'deformation_joints',
  fachwerks: 'fachwerks',
  fachwerk: 'fachwerks',
  smoke_hatches: 'smoke_hatches',
  smoke_hatch: 'smoke_hatches',
  fire_protection: 'fire_protection',
  ov_vk: 'ov_vk',
  pedestals: 'pedestals',
  pedestal: 'pedestals',
  air_intakes: 'air_intakes',
  air_intake: 'air_intakes',
  fans: 'fans',
  fan: 'fans',
  exhausts: 'exhausts',
  exhaust: 'exhausts',
  condensers: 'condensers',
  condenser: 'condensers',
  cable_goosenecks: 'cable_goosenecks',
  cable_gooseneck: 'cable_goosenecks',
  small_penetrations: 'small_penetrations',
  small_penetration: 'small_penetrations',
  medium_penetrations: 'medium_penetrations',
  medium_penetration: 'medium_penetrations',
  other_penetrations: 'other_penetrations',
  other_penetration: 'other_penetrations',
  vent_shafts: 'vent_shafts',
  vent_shaft: 'vent_shafts',
  ventilation_shafts: 'vent_shafts',
  guardrails: 'guardrails',
  guardrail: 'guardrails',
  roof_guardrails: 'guardrails',
  wind_zones: 'wind_zones',
  wind_zone: 'wind_zones',
  rib_fill: 'rib_fill',
  demolition: 'demolition',
  demolition_works: 'demolition',
  concrete_nodes: 'concrete_nodes'
}

const ALWAYS_VISIBLE_BASE_KEYS = new Set([
  'roof_area',
  'base_profile',
  'base_profile_thickness',
  'lower_insulation_thickness',
  'upper_insulation_thickness',
  'membrane_thickness',
  'membrane_roll_width',
  'bottom_brm_layers',
  'screed_area',
  'primer_area'
])

const AUTO_CALCULATED_PARAM_PATTERNS = [
  /tape/,
  /скотч/,
  /cleaner/,
  /очистител/,
  /подъем/,
  /механизм/,
  /утилизац/,
  /вывоз/,
  /disposal/,
  /machin/,
  /waste/
]

function canonicalizeOptionKey(value) {
  const key = normalize(value)
    .replace(/\s+/g, '_')
    .replace(/[\/()-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  return OPTION_ALIASES[key] || key
}

function normalizeSelectedKeys(selectedKeys = []) {
  return [...new Set((Array.isArray(selectedKeys) ? selectedKeys : []).map(canonicalizeOptionKey).filter(Boolean))]
}

function normalizeOwnerKeys(ownerKeys = []) {
  return [...new Set((Array.isArray(ownerKeys) ? ownerKeys : []).map(canonicalizeOptionKey).filter(Boolean))]
}

function getParamIdentity(param = {}) {
  return `${normalize(param?.key)} ${normalize(param?.label)} ${normalize(param?.description)}`
}

function hasPattern(value, patterns = []) {
  return patterns.some((pattern) => pattern.test(value))
}

function inferOwnerKeys(param = {}) {
  const identity = getParamIdentity(param)
  const found = []

  if (/демонтаж|demolition/.test(identity)) found.push('demolition')
  if (/примыкан|parapet/.test(identity)) found.push('parapets')
  if (/внутренн.*ворон|inner.*drain/.test(identity)) found.push('inner_drains')
  if (/внешн.*ворон|outer.*drain/.test(identity)) found.push('outer_drains')
  if (/аэратор|aerator/.test(identity)) found.push('aerators')
  if (/дорожк|walkway/.test(identity)) found.push('walkways')
  if (/карниз|cornice/.test(identity)) found.push('cornice')
  if (/контруклон|counter.*slope/.test(identity)) found.push('counter_slopes')
  if (/деформац|deformation/.test(identity)) found.push('deformation_joints')
  if (/фахверк|fachwerk/.test(identity)) found.push('fachwerks')
  if (/дымоудален|smoke.*hatch/.test(identity)) found.push('smoke_hatches')
  if (/противопожар|негорюч|fire.*protection|ng/.test(identity)) found.push('fire_protection')
  if (/\bов\b|\bвк\b|ov|vk/.test(identity)) found.push('ov_vk')
  if (/тумб|подставк|pedestal/.test(identity)) found.push('pedestals')
  if (/воздухозабор|air.*intake/.test(identity)) found.push('air_intakes')
  if (/вентилятор|fan/.test(identity)) found.push('fans')
  if (/вытяж|дефлектор|exhaust|deflector/.test(identity)) found.push('exhausts')
  if (/кондиционер|condenser/.test(identity)) found.push('condensers')
  if (/гусак|gooseneck/.test(identity)) found.push('cable_goosenecks')
  if (/малого сечен|small.*penetration/.test(identity)) found.push('small_penetrations')
  if (/среднего сечен|medium.*penetration/.test(identity)) found.push('medium_penetrations')
  if (/проч.*проход|pass.*through|penetration/.test(identity)) found.push('other_penetrations')
  if (/вентшахт|vent.*shaft|ventilation.*shaft/.test(identity)) found.push('vent_shafts')
  if (/огражден|guardrail|roof.*fenc/.test(identity)) found.push('guardrails')
  if (/ветров.*зон|wind.*zone/.test(identity)) found.push('wind_zones')
  if (/гофр|l_профил|l-профил|l profile|rib.*fill/.test(identity)) found.push('rib_fill')
  if (/ж\/б|жб|бетон|concrete/.test(identity) && /площад|узл/.test(identity)) found.push('concrete_nodes')

  return normalizeOwnerKeys(found)
}

function shouldHideAutomatically(param = {}) {
  const identity = getParamIdentity(param)
  return hasPattern(identity, AUTO_CALCULATED_PARAM_PATTERNS)
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
    const existingOwners = normalizeOwnerKeys(param?.ownerKeys)
    const inferredOwners = inferOwnerKeys(param)
    const ownerKeys = normalizeOwnerKeys([...existingOwners, ...inferredOwners])
    const hidden = shouldHideAutomatically(param) || (!ownerKeys.length && !ALWAYS_VISIBLE_BASE_KEYS.has(key))

    return {
      ...param,
      ownerKeys: ownerKeys.length ? ownerKeys : undefined,
      hidden
    }
  })
}

function buildCommonEnhancements() {
  return {
    params: [],
    options: [
      buildOption('demolition', 'Демонтаж', 5, [
        buildNumberParam('demolition_waterproofing_area', 'Демонтаж гидроизоляции', 'м2', 'Площадь демонтажа гидроизоляционного слоя', 'additional'),
        buildNumberParam('demolition_insulation_area', 'Демонтаж теплоизоляции', 'м2', 'Площадь демонтажа теплоизоляционного слоя', 'additional'),
        buildNumberParam('demolition_base_area', 'Демонтаж профлиста', 'м2', 'Площадь демонтажа профилированного настила', 'additional')
      ]),
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
  const selected = new Set(normalizeSelectedKeys(selectedKeys))

  const visibleBaseParams = (meta.params || []).filter((param) => {
    if (param?.hidden) {
      return false
    }

    const ownerKeys = normalizeOwnerKeys(param?.ownerKeys)
    if (!ownerKeys.length) {
      return true
    }

    return ownerKeys.some((key) => selected.has(key))
  })

  const selectedOptionParams = []
  for (const option of meta.options || []) {
    if (selected.has(canonicalizeOptionKey(option.key)) && Array.isArray(option.params)) {
      selectedOptionParams.push(...option.params.map((param) => ({
        ...param,
        ownerKeys: normalizeOwnerKeys(param.ownerKeys || [option.key])
      })))
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


export function normalizeTemplateOptionKeys(selectedKeys = []) {
  return normalizeSelectedKeys(selectedKeys)
}

export function normalizeSelectedTemplateOptionKeys(selectedKeys = []) {
  return normalizeSelectedKeys(selectedKeys)
}
