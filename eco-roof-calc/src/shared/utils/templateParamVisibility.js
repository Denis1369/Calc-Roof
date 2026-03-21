function normalizeText(value) {
  return `${value || ''}`
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/["'`]/g, ' ')
    .replace(/[_/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern))
}

function detectFeatureKind(feature) {
  const text = normalizeText(`${feature?.key || ''} ${feature?.label || ''}`)

  if (hasAny(text, ['внутренн ворон', 'inner drain', 'inner drains', 'id'])) return 'inner_drains'
  if (hasAny(text, ['внешн ворон', 'outer drain', 'outer drains', 'наружн водосток'])) return 'outer_drains'
  if (hasAny(text, ['аэратор', 'aerator'])) return 'aerators'
  if (hasAny(text, ['парапет', 'примык'])) return 'parapets'
  if (hasAny(text, ['ветров'])) return 'wind_zones'
  if (hasAny(text, ['гофр', 'l проф', 'l-образ', 'l образ'])) return 'fill_corrugations'
  if (hasAny(text, ['дорожк', 'walkway'])) return 'walkways'
  if (hasAny(text, ['карниз'])) return 'eaves'
  if (hasAny(text, ['контруклон'])) return 'counter_slopes'
  if (hasAny(text, ['деформацион'])) return 'deformation_joints'
  if (hasAny(text, ['фахверк'])) return 'half_timber_posts'
  if (hasAny(text, ['дымоудал'])) return 'smoke_hatches'
  if (hasAny(text, ['противопожар'])) return 'fire_breaks'
  if (hasAny(text, ['ов вк', 'ов/вк', 'hvac'])) return 'hvac_nodes'
  if (hasAny(text, ['тумб', 'подставк'])) return 'pedestals'
  if (hasAny(text, ['воздухозабор'])) return 'air_intakes'
  if (hasAny(text, ['промышленн вентил'])) return 'industrial_fans'
  if (hasAny(text, ['вытяжк', 'дефлектор'])) return 'exhausts'
  if (hasAny(text, ['кондиционер'])) return 'ac_blocks'
  if (hasAny(text, ['гусак'])) return 'goosenecks'
  if (hasAny(text, ['малого сечения'])) return 'small_penetrations'
  if (hasAny(text, ['среднего сечения'])) return 'medium_penetrations'
  if (hasAny(text, ['прочие проходк'])) return 'other_penetrations'
  if (hasAny(text, ['вентиляционн шахт', 'вентшахт'])) return 'ventilation_shafts'
  if (hasAny(text, ['ограждени'])) return 'roof_fencing'

  return ''
}

function matchesFeatureText(text, featureKind) {
  switch (featureKind) {
    case 'inner_drains':
      return hasAny(text, ['внутренн ворон', 'усилен ворон', 'водоприемн ворон', 'inner drain'])
    case 'outer_drains':
      return hasAny(text, ['внешн ворон', 'наружн водосток', 'карнизн свес', 'капельник', 'outer drain'])
    case 'aerators':
      return hasAny(text, ['аэратор', 'aerator'])
    case 'parapets':
      return hasAny(text, ['парапет', 'примыкан', 'v sr', 'vsr', 'парапетн крыш'])
    case 'wind_zones':
      return hasAny(text, ['ветров'])
    case 'fill_corrugations':
      return hasAny(text, ['гофр', 'l проф', 'l-образ', 'l образ', 'ендов', 'конек'])
    case 'walkways':
      return hasAny(text, ['дорожк', 'walkway'])
    case 'eaves':
      return hasAny(text, ['карниз'])
    case 'counter_slopes':
      return hasAny(text, ['контруклон'])
    case 'deformation_joints':
      return hasAny(text, ['деформацион'])
    case 'half_timber_posts':
      return hasAny(text, ['фахверк'])
    case 'smoke_hatches':
      return hasAny(text, ['дымоудал'])
    case 'fire_breaks':
      return hasAny(text, ['противопожар'])
    case 'hvac_nodes':
      return hasAny(text, ['ов вк', 'ов/вк'])
    case 'pedestals':
      return hasAny(text, ['тумб', 'подставк'])
    case 'air_intakes':
      return hasAny(text, ['воздухозабор'])
    case 'industrial_fans':
      return hasAny(text, ['промышленн вентил'])
    case 'exhausts':
      return hasAny(text, ['вытяжк', 'дефлектор'])
    case 'ac_blocks':
      return hasAny(text, ['кондиционер'])
    case 'goosenecks':
      return hasAny(text, ['гусак'])
    case 'small_penetrations':
      return hasAny(text, ['малого сечения'])
    case 'medium_penetrations':
      return hasAny(text, ['среднего сечения'])
    case 'other_penetrations':
      return hasAny(text, ['прочие проходк'])
    case 'ventilation_shafts':
      return hasAny(text, ['вентиляционн шахт', 'вентшахт'])
    case 'roof_fencing':
      return hasAny(text, ['ограждени'])
    default:
      return false
  }
}

function isCoreParam(param) {
  const code = normalizeText(param?.key)
  const text = normalizeText(`${param?.key || ''} ${param?.label || ''} ${param?.description || ''}`)

  const coreCodes = new Set([
    'roof_area',
    'base_profile',
    'base_profile_thickness',
    'lower_insulation_thickness',
    'upper_insulation_thickness',
    'membrane_thickness',
    'membrane_width',
    'supplier_type'
  ])

  if (coreCodes.has(code)) return true

  return hasAny(text, [
    'площадь кровли',
    'профиль профлиста',
    'толщина профлиста',
    'толщина нижнего слоя',
    'толщина верхнего слоя',
    'толщина пвх мембраны',
    'толщина мембраны',
    'ширина пвх мембраны'
  ])
}

export function enrichTemplateParam(param, systemOptions = []) {
  const text = normalizeText(`${param?.key || ''} ${param?.label || ''} ${param?.description || ''}`)
  const optionKeys = []

  for (const option of systemOptions) {
    const featureKind = detectFeatureKind(option)
    if (!featureKind) continue
    if (matchesFeatureText(text, featureKind)) {
      optionKeys.push(option.key)
    }
  }

  const uniqueOptionKeys = [...new Set(optionKeys)]
  const isCore = isCoreParam(param)

  return {
    ...param,
    optionKeys: uniqueOptionKeys,
    isCore,
    group:
      uniqueOptionKeys.length > 0 && (!param?.group || param.group === 'basic')
        ? 'additional'
        : param?.group
  }
}

function getParamIdentity(param) {
  const code = normalizeText(param?.key)
  if (code) return `key:${code}`
  return `label:${normalizeText(param?.label)}`
}

export function getVisibleTemplateParams(system, selectedKeys = []) {
  const options = Array.isArray(system?.опции) ? system.опции : []
  const selected = new Set(Array.isArray(selectedKeys) ? selectedKeys : [])
  const baseParams = Array.isArray(system?.параметры) ? system.параметры : []
  const visible = []
  const seen = new Set()

  const pushParam = (param) => {
    const enriched = enrichTemplateParam(param, options)
    const identity = getParamIdentity(enriched)
    if (seen.has(identity)) return

    const isVisible =
      enriched.isCore ||
      enriched.optionKeys.length === 0
        ? enriched.isCore
        : enriched.optionKeys.some((key) => selected.has(key))

    if (!isVisible) return

    seen.add(identity)
    visible.push(enriched)
  }

  for (const param of baseParams) pushParam(param)

  for (const option of options) {
    if (!selected.has(option.key)) continue
    for (const param of option.params || []) {
      pushParam({ ...param, optionKeys: [option.key] })
    }
  }

  return visible
}

export function sanitizeTemplateParamValues(system, selectedKeys = [], values = {}) {
  const visible = getVisibleTemplateParams(system, selectedKeys)
  const sanitized = {}

  for (const param of visible) {
    if (Object.prototype.hasOwnProperty.call(values, param.key)) {
      sanitized[param.key] = values[param.key]
    } else if (param.type === 'number') {
      sanitized[param.key] = Number(param.value) || 0
    } else if (param.value !== undefined) {
      sanitized[param.key] = param.value
    }
  }

  return sanitized
}
