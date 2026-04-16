function normalize(value) {
  return `${value || ''}`
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[\/()-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// Базовые заводские настройки опций
const BASE_OPTION_BLOCKS = {
  rib_fill: {
    title: 'Заполнение гофр / L-профиль',
    sectionCode: 'rib_fill',
    codeBases: { work: 520, material: 540 },
    works: [
      { name: 'L-образный профиль', expression: 'RB', unit: 'м/п' },
      { name: 'Заполнение гофр профлиста утеплителем НГ на длину 250 мм', expression: 'RB', unit: 'м/п' }
    ],
    materials: [
      { name: 'Профиль усиления (коньковые усиления, усиления ендов)', expression: 'RB', unit: 'м/п' }
    ]
  },
  vent_shafts: {
    title: 'Инженерные узлы и проходки',
    sectionCode: 'vent_shafts',
    codeBases: { work: 560, material: 580 },
    works: [
      { name: 'Монтаж гидроизоляционного покрытия на парапеты (и вент. шахты) до 450 мм из ПВХ мембраны с окончанием под прижимную и краевую рейку.', expression: 'VS', unit: 'м/п' }
    ],
    materials: [
      { name: 'LOGICROOF V-RP', expression: 'VS * 0.75', unit: 'м2' },
      { name: 'LOGICROOF V-SR', expression: 'VS * 0.2', unit: 'м2' },
      { name: 'Прижимная кровельная планка алюминиевая 30*2000мм', expression: 'VS', unit: 'м/п' },
      { name: 'Крепеж кровельный ТехноНИКОЛЬ (саморез 5,5*35)', expression: 'VS * 5', unit: 'шт' },
      { name: 'ПУ герметик', expression: 'max(1, ceil(VS / 20))', unit: 'шт' }
    ]
  },
  guardrails: {
    title: 'Ограждения и безопасность',
    sectionCode: 'guardrails',
    codeBases: { work: 600, material: 620 },
    works: [
      { name: 'Монтаж кровельного ограждения', expression: 'GR', unit: 'м/п' },
      { name: 'Монтаж примыканий к стойкам ограждение', expression: 'max(GRC, ceil(GR / 3))', unit: 'шт' }
    ],
    materials: [
      { name: 'Кровельное ограждение ТехноНИКОЛЬ ККО/СК/600-2', expression: 'max(GRC, ceil(GR / 3))', unit: 'шт' }
    ]
  },
  deformation_joints: {
    title: 'Деформационные швы',
    sectionCode: 'deformation_joints',
    codeBases: { work: 640, material: 660 },
    works: [
      { name: 'Устройство фасонного элемента', expression: 'D', unit: 'м/п' }
    ],
    materials: [
      { name: 'Профиль усиления (коньковые усиления, усиления ендов)', expression: 'D', unit: 'м/п' }
    ]
  },
  fachwerks: {
    title: 'Инженерные узлы и проходки',
    sectionCode: 'fachwerks',
    codeBases: { work: 680, material: 700 },
    works: [
      { name: 'Устройство примыканий к стойкам фахверка с утеплением', expression: 'FW', unit: 'шт' }
    ],
    materials: [
      { name: 'LOGICROOF V-RP', expression: 'FW * 1.1', unit: 'м2' },
      { name: 'LOGICROOF V-SR', expression: 'FW * 0.25', unit: 'м2' }
    ]
  },
  smoke_hatches: {
    title: 'Инженерные узлы и проходки',
    sectionCode: 'smoke_hatches',
    codeBases: { work: 720, material: 740 },
    works: [
      { name: 'Монтаж люков дымоудаления', expression: 'SH', unit: 'шт' },
      { name: 'Устройство примыкания к зенитным фонарям и люкам дымоудаления из ПВХ-мембраны', expression: 'SH', unit: 'шт' }
    ],
    materials: [
      { name: 'LOGICROOF V-RP', expression: 'SH * 1.2', unit: 'м2' },
      { name: 'LOGICROOF V-SR', expression: 'SH * 0.3', unit: 'м2' }
    ]
  },
  fire_protection: {
    title: 'Инженерные узлы и проходки',
    sectionCode: 'fire_protection',
    codeBases: { work: 760, material: 780 },
    works: [
      { name: 'Устройство противопожарных рассечек 3*3 м вокруг зенитных фонарей, люков дымоудаления и дефлекторов из материала Logicroof NG', expression: 'NG', unit: 'м2' }
    ],
    materials: [
      { name: 'NG', expression: 'NG', unit: 'м2' }
    ]
  },
  small_penetrations: {
    title: 'Инженерные узлы и проходки',
    sectionCode: 'small_penetrations',
    codeBases: { work: 800, material: 820 },
    works: [
      { name: 'Устройство примыканий к проходкам малого сечения диамтером до 150 мм (к гусакам для ввода кабеля, трубам и выводам)', expression: 'PTS', unit: 'шт' }
    ],
    materials: [
      { name: 'LOGICROOF V-RP', expression: 'PTS * 0.6', unit: 'м2' },
      { name: 'LOGICROOF V-SR', expression: 'PTS * 0.15', unit: 'м2' }
    ]
  },
  medium_penetrations: {
    title: 'Инженерные узлы и проходки',
    sectionCode: 'medium_penetrations',
    codeBases: { work: 840, material: 860 },
    works: [
      { name: 'Устройство примыкания к проходкам среднего сечения диамтером от 150 мм до 300 мм (к дефлекторам круглого сечения, трубам)', expression: 'PTM', unit: 'шт' }
    ],
    materials: [
      { name: 'LOGICROOF V-RP', expression: 'PTM * 1.0', unit: 'м2' },
      { name: 'LOGICROOF V-SR', expression: 'PTM * 0.2', unit: 'м2' }
    ]
  },
  other_penetrations: {
    title: 'Инженерные узлы и проходки',
    sectionCode: 'other_penetrations',
    codeBases: { work: 880, material: 900 },
    works: [
      { name: 'Устройство примыканий к проходкам', expression: 'PT', unit: 'шт' }
    ],
    materials: [
      { name: 'LOGICROOF V-RP', expression: 'PT * 1.0', unit: 'м2' },
      { name: 'LOGICROOF V-SR', expression: 'PT * 0.2', unit: 'м2' }
    ]
  },
  cable_goosenecks: {
    title: 'Инженерные узлы и проходки',
    sectionCode: 'cable_goosenecks',
    codeBases: { work: 920, material: 940 },
    works: [
      { name: 'Устройство примыканий к проходкам малого сечения диамтером до 150 мм (к гусакам для ввода кабеля, трубам и выводам)', expression: 'CG', unit: 'шт' }
    ],
    materials: [
      { name: 'LOGICROOF V-RP', expression: 'CG * 0.6', unit: 'м2' },
      { name: 'LOGICROOF V-SR', expression: 'CG * 0.15', unit: 'м2' }
    ]
  },
  air_intakes: {
    title: 'Инженерные узлы и проходки',
    sectionCode: 'air_intakes',
    codeBases: { work: 960, material: 980 },
    works: [
      { name: 'Устройство примыканий к проходкам', expression: 'AI', unit: 'шт' }
    ],
    materials: [
      { name: 'LOGICROOF V-RP', expression: 'AI * 1.0', unit: 'м2' }
    ]
  },
  fans: {
    title: 'Инженерные узлы и проходки',
    sectionCode: 'fans',
    codeBases: { work: 1000, material: 1020 },
    works: [
      { name: 'Устройство примыканий к проходкам', expression: 'VF', unit: 'шт' }
    ],
    materials: [
      { name: 'LOGICROOF V-RP', expression: 'VF * 1.0', unit: 'м2' }
    ]
  },
  exhausts: {
    title: 'Инженерные узлы и проходки',
    sectionCode: 'exhausts',
    codeBases: { work: 1040, material: 1060 },
    works: [
      { name: 'Устройство примыканий к проходкам', expression: 'EX', unit: 'шт' }
    ],
    materials: [
      { name: 'LOGICROOF V-RP', expression: 'EX * 1.0', unit: 'м2' }
    ]
  },
  condensers: {
    title: 'Инженерные узлы и проходки',
    sectionCode: 'condensers',
    codeBases: { work: 1080, material: 1100 },
    works: [
      { name: 'Устройство примыканий к проходкам', expression: 'AC', unit: 'шт' }
    ],
    materials: [
      { name: 'LOGICROOF V-RP', expression: 'AC * 0.9', unit: 'м2' }
    ]
  },
  pedestals: {
    title: 'Инженерные узлы и проходки',
    sectionCode: 'pedestals',
    codeBases: { work: 1120, material: 1140 },
    works: [
      { name: 'Устройство примыканий к проходкам', expression: 'max(PDC, ceil(PDL))', unit: 'шт' }
    ],
    materials: [
      { name: 'LOGICROOF V-RP', expression: 'max(PDC, ceil(PDL)) * 0.8', unit: 'м2' }
    ]
  },
  ov_vk: {
    title: 'Инженерные узлы и проходки',
    sectionCode: 'ov_vk',
    codeBases: { work: 1160, material: 1180 },
    works: [
      { name: 'Устройство примыканий к проходкам', expression: 'OV + VK + ceil(VKL)', unit: 'шт' }
    ],
    materials: [
      { name: 'LOGICROOF V-RP', expression: '(OV + VK + ceil(VKL)) * 0.9', unit: 'м2' }
    ]
  }
}

// Функции для загрузки/сохранения пользовательских настроек опций
export function getCustomOptionBlocks() {
  try {
    const data = window.localStorage.getItem('eco_roof_custom_options')
    return data ? JSON.parse(data) : {}
  } catch (e) {
    return {}
  }
}

export function saveCustomOptionBlocks(blocks) {
  try {
    window.localStorage.setItem('eco_roof_custom_options', JSON.stringify(blocks))
  } catch (e) {
    console.error('Failed to save custom options', e)
  }
}

// Получить итоговый словарь: База + Пользовательские изменения
export function getMergedOptionBlocks() {
  const base = JSON.parse(JSON.stringify(BASE_OPTION_BLOCKS))
  const custom = getCustomOptionBlocks()

  for (const key in custom) {
    if (base[key]) {
      base[key].works = custom[key].works || []
      base[key].materials = custom[key].materials || []
    } else {
      base[key] = custom[key]
    }
  }
  return base
}

export function getOptionEstimateBlocks(selectedKeys = []) {
  const merged = getMergedOptionBlocks()
  const normalized = new Set((Array.isArray(selectedKeys) ? selectedKeys : []).map(normalize).filter(Boolean))
  return [...normalized]
    .map((key) => merged[key])
    .filter(Boolean)
}

export function hasOptionEstimateBlock(key) {
  return Boolean(getMergedOptionBlocks()[normalize(key)])
}

// Экспортируем константу для обратной совместимости
export const OPTION_BLOCKS = BASE_OPTION_BLOCKS