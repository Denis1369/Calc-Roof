function normalizeOptions(options) {
  if (!Array.isArray(options)) return []
  return options.map((item) => `${item}`).filter(Boolean)
}

function normalizeText(value) {
  return `${value || ''}`
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[_/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern))
}

function detectFeatureKind(featureCode, featureName = '') {
  const text = normalizeText(`${featureCode || ''} ${featureName || ''}`)

  if (hasAny(text, ['внутренн ворон', 'inner drain', 'inner drains', 'id'])) return 'inner_drains'
  if (hasAny(text, ['внешн ворон', 'outer drain', 'outer drains', 'наружн водосток'])) return 'outer_drains'
  if (hasAny(text, ['аэратор', 'aerator'])) return 'aerators'
  if (hasAny(text, ['парапет', 'примык'])) return 'parapets'
  if (hasAny(text, ['ветров'])) return 'wind_zones'
  if (hasAny(text, ['гофр', 'l проф', 'l образ', 'l-образ'])) return 'fill_corrugations'
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
  if (hasAny(text, ['прочие проходк', 'pass through'])) return 'other_penetrations'
  if (hasAny(text, ['вентиляционн шахт', 'вентшахт'])) return 'ventilation_shafts'
  if (hasAny(text, ['ограждени'])) return 'roof_fencing'

  return normalizeText(featureCode)
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

function numberParam({ key, label, unit, value = 0, description = '', group = 'additional' }) {
  return {
    key,
    label,
    type: 'number',
    unit,
    value,
    group,
    description
  }
}

function getSyntheticFeatureParams(featureCode, featureName = '') {
  switch (detectFeatureKind(featureCode, featureName)) {
    case 'inner_drains':
      return [
        numberParam({
          key: 'inner_drains_count',
          label: 'Количество внутренних воронок',
          unit: 'шт',
          value: 1,
          description: 'Количество внутренних водоприемных воронок'
        }),
        numberParam({
          key: 'inner_drain_reinforcement_count',
          label: 'Усиления воронок',
          unit: 'шт',
          value: 0,
          description: 'Количество усилений мест внутренних воронок'
        })
      ]

    case 'outer_drains':
      return [
        numberParam({
          key: 'outer_drains_count',
          label: 'Количество внешних воронок',
          unit: 'шт',
          value: 1,
          description: 'Количество внешних воронок или элементов наружного водоотведения'
        })
      ]

    case 'aerators':
      return [
        numberParam({
          key: 'aerators_count',
          label: 'Количество аэраторов',
          unit: 'шт',
          value: 1,
          description: 'Количество кровельных аэраторов'
        })
      ]

    case 'parapets':
      return [
        numberParam({
          key: 'parapet_perimeter',
          label: 'Периметр примыканий',
          unit: 'м/п',
          value: 0,
          description: 'Суммарная длина примыканий к парапету'
        }),
        numberParam({
          key: 'parapet_caps_length',
          label: 'Парапетные крышки',
          unit: 'м/п',
          value: 0,
          description: 'Длина парапетных крышек'
        }),
        numberParam({
          key: 'v_sr_area',
          label: 'Усиление углов/парапетов V-SR',
          unit: 'м2',
          value: 0,
          description: 'Площадь мембраны V-SR на углы и усиления'
        })
      ]

    case 'fill_corrugations':
      return [
        numberParam({
          key: 'corrugation_fill_length',
          label: 'Заполнение гофр',
          unit: 'м/п',
          value: 0,
          description: 'Длина участков заполнения гофр'
        }),
        numberParam({
          key: 'l_profile_length',
          label: 'L-профиль',
          unit: 'м/п',
          value: 0,
          description: 'Суммарная длина L-образного профиля'
        })
      ]

    case 'walkways':
      return [
        numberParam({
          key: 'walkways_length',
          label: 'Длина пешеходных дорожек',
          unit: 'м/п',
          value: 0,
          description: 'Общая длина пешеходных дорожек'
        }),
        numberParam({
          key: 'walkway_puzzle_count',
          label: 'Пешеходные дорожки Puzzle',
          unit: 'шт',
          value: 0,
          description: 'Количество элементов Walkway Puzzle'
        })
      ]

    case 'eaves':
      return [
        numberParam({
          key: 'eaves_length',
          label: 'Карнизный свес',
          unit: 'м/п',
          value: 0,
          description: 'Суммарная длина карнизного свеса'
        })
      ]

    case 'counter_slopes':
      return [
        numberParam({
          key: 'counter_slope_area',
          label: 'Контруклоны',
          unit: 'м2',
          value: 0,
          description: 'Площадь контруклонов'
        })
      ]

    case 'deformation_joints':
      return [
        numberParam({
          key: 'deformation_joint_length',
          label: 'Длина деформационных швов',
          unit: 'м/п',
          value: 0,
          description: 'Суммарная длина деформационных швов'
        }),
        numberParam({
          key: 'deformation_joint_profile_length',
          label: 'Профиль усиления деформационного шва',
          unit: 'м/п',
          value: 0,
          description: 'Длина профилей усиления деформационных швов'
        })
      ]

    case 'half_timber_posts':
      return [
        numberParam({
          key: 'half_timber_posts_count',
          label: 'Стойки фахверка',
          unit: 'шт',
          value: 0,
          description: 'Количество стоек фахверка'
        })
      ]

    case 'smoke_hatches':
      return [
        numberParam({
          key: 'smoke_hatches_count',
          label: 'Люки дымоудаления',
          unit: 'шт',
          value: 0,
          description: 'Количество люков дымоудаления'
        })
      ]

    case 'fire_breaks':
      return [
        numberParam({
          key: 'fire_break_area',
          label: 'Противопожарные рассечки',
          unit: 'м2',
          value: 0,
          description: 'Площадь противопожарных рассечек'
        })
      ]

    case 'hvac_nodes':
      return [
        numberParam({
          key: 'hvac_nodes_count',
          label: 'Узлы ОВ / ВК',
          unit: 'шт',
          value: 0,
          description: 'Количество узлов ОВ/ВК'
        })
      ]

    case 'pedestals':
      return [
        numberParam({
          key: 'pedestals_count',
          label: 'Тумбы и кровельные подставки',
          unit: 'шт',
          value: 0,
          description: 'Количество тумб и кровельных подставок'
        })
      ]

    case 'air_intakes':
      return [
        numberParam({
          key: 'air_intakes_count',
          label: 'Воздухозаборы',
          unit: 'шт',
          value: 0,
          description: 'Количество воздухозаборов'
        })
      ]

    case 'industrial_fans':
      return [
        numberParam({
          key: 'industrial_fans_count',
          label: 'Промышленные вентиляторы',
          unit: 'шт',
          value: 0,
          description: 'Количество промышленных вентиляторов'
        })
      ]

    case 'exhausts':
      return [
        numberParam({
          key: 'exhausts_count',
          label: 'Вытяжки и дефлекторы',
          unit: 'шт',
          value: 0,
          description: 'Количество вытяжек и дефлекторов'
        })
      ]

    case 'ac_blocks':
      return [
        numberParam({
          key: 'ac_blocks_count',
          label: 'Стойки блоков кондиционеров',
          unit: 'шт',
          value: 0,
          description: 'Количество стоек под блоки кондиционеров'
        })
      ]

    case 'goosenecks':
      return [
        numberParam({
          key: 'goosenecks_count',
          label: 'Гусаки для ввода кабеля',
          unit: 'шт',
          value: 0,
          description: 'Количество примыканий к гусакам'
        })
      ]

    case 'small_penetrations':
      return [
        numberParam({
          key: 'small_penetrations_count',
          label: 'Проходки малого сечения',
          unit: 'шт',
          value: 0,
          description: 'Количество проходок малого сечения'
        })
      ]

    case 'medium_penetrations':
      return [
        numberParam({
          key: 'medium_penetrations_count',
          label: 'Проходки среднего сечения',
          unit: 'шт',
          value: 0,
          description: 'Количество проходок среднего сечения'
        })
      ]

    case 'other_penetrations':
      return [
        numberParam({
          key: 'pass_through_count',
          label: 'Прочие проходки',
          unit: 'шт',
          value: 0,
          description: 'Количество прочих проходок через кровлю'
        })
      ]

    case 'ventilation_shafts':
      return [
        numberParam({
          key: 'ventilation_shafts_count',
          label: 'Вентиляционные шахты',
          unit: 'шт',
          value: 0,
          description: 'Количество вентиляционных шахт'
        })
      ]

    case 'roof_fencing':
      return [
        numberParam({
          key: 'roof_fencing_length',
          label: 'Кровельное ограждение',
          unit: 'м/п',
          value: 0,
          description: 'Длина кровельного ограждения'
        }),
        numberParam({
          key: 'roof_fencing_posts_count',
          label: 'Стойки ограждения',
          unit: 'шт',
          value: 0,
          description: 'Количество стоек ограждения'
        })
      ]

    default:
      return []
  }
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
    params: getSyntheticFeatureParams(feature.code, feature.name)
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
    raw: fullSystem
  }
}
