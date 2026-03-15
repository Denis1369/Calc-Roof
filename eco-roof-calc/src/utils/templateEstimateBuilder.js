import { evaluate } from 'mathjs'
import { getDb } from '../database'

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
  const db = await getDb()

  const worksDb = await db.select('SELECT * FROM Справочник_видов_работ')
  const materialsDb = await db.select('SELECT * FROM Справочник_материалов')
  const coefficientsDb = await db.select('SELECT * FROM Справочник_коэффициентов')

  const selectedSet = new Set(selectedKeys)

  const scope = createScope(paramValues)
  const profile = resolveSystemProfile(system)

  const sections = await buildSections({
    profile,
    scope,
    selectedSet,
    paramValues,
    worksDb,
    materialsDb,
    coefficientsDb
  })

  return {
    projectName: system.название,
    vatRate: 20,
    estimateZones: [
      {
        id: crypto.randomUUID(),
        name: `Монтаж системы: ${system.название}`,
        supplierType: 'ТехноНИКОЛЬ',
        roofParams: {
          area: scope.S,
          perimeter: scope.P,
          parapetDrains: scope.OD,
          innerDrains: scope.ID,
          aerators: scope.A
        },
        customParams: buildCustomParams(scope),
        sections
      }
    ]
  }
}

async function buildSections({ profile, scope, selectedSet, paramValues, worksDb, materialsDb, coefficientsDb }) {
  if (profile === 'pvc_prof_pir') {
    return buildPvcProfPirSections({ scope, selectedSet, paramValues, worksDb, materialsDb, coefficientsDb })
  }

  if (profile === 'pvc_prof') {
    return buildPvcProfSections({ scope, selectedSet, paramValues, worksDb, materialsDb, coefficientsDb })
  }

  if (profile === 'pvc_jb') {
    return buildPvcConcreteSections({ scope, selectedSet, paramValues, worksDb, materialsDb, coefficientsDb })
  }

  if (profile === 'brm_prof') {
    return buildBrmProfSections({ scope, selectedSet, paramValues, worksDb, materialsDb, coefficientsDb })
  }

  return buildBrmConcreteSections({ scope, selectedSet, paramValues, worksDb, materialsDb, coefficientsDb })
}

async function buildPvcProfPirSections(ctx) {
  const { scope, selectedSet, paramValues } = ctx

  const lowerThicknessM = mmToMeters(paramValues.insulation_bottom_thickness || 50)
  const upperThicknessM = mmToMeters(paramValues.insulation_top_thickness || 50)

  const sections = [
    {
      title: 'Пароизоляция',
      works: [
        {
          name: 'Устройство пароизоляционного слоя из пленки',
          aliases: [
            'Устройство пароизоляционного слоя из пленки',
            'Устройство пароизоляционного слоя из пароизоляционной пленки',
            'Устройство пароизоляции из пленки'
          ],
          expression: 'S'
        }
      ],
      materials: [
        {
          name: getString(paramValues.vapor_barrier_type, 'Пароизоляционная пленка ТехноНИКОЛЬ'),
          aliases: [
            'Пароизоляционная пленка ТехноНИКОЛЬ',
            'Пароизоляционная пленка ТЕХНОНИКОЛЬ',
            'Паробарьер СА500',
            'Паробарьер С'
          ],
          expression: 'S * [Запас на нахлесты пароизоляции]'
        },
        {
          name: 'Двусторонний скотч',
          aliases: ['Двусторонний скотч'],
          expression: '(S / [Скотч двусторонний ширина рулона, м]) / [Скотч двусторонний длина рулона, м]'
        }
      ]
    },
    {
      title: 'Теплоизоляция',
      works: [
        {
          name: 'Устройство комбинированного теплоизоляционного слоя (Мин. Вата + ПИР) в два слоя с перехлестом швов, общей толщиной 100 мм',
          aliases: [
            'Устройство комбинированного теплоизоляционного слоя (Мин. Вата + ПИР) в два слоя с перехлестом швов, общей толщиной 100 мм',
            'Устройство комбинированного утеплителя (Минераловатный утеплитель 100 мм + экструдированный пенополистирол - 50 мм) 2 слоя с разбежкой швов, с общей толщиной 150 мм'
          ],
          expression: 'S'
        },
        {
          name: 'Механическое крепление теплоизоляционного слоя',
          aliases: ['Механическое крепление теплоизоляционного слоя'],
          expression: 'S'
        }
      ],
      materials: [
        {
          name: getString(paramValues.insulation_bottom_type, 'Минераловатный утеплитель 100 мм'),
          aliases: ['Минераловатный утеплитель 100 мм', 'ТЕХНОРУФ Н ПРОФ'],
          expression: `S * ${lowerThicknessM} * [Запас минераловатного утеплителя]`
        },
        {
          name: getString(paramValues.insulation_top_type, 'LOGICPIR PROF'),
          aliases: [
            'Теплоизоляционный материал ТехноНИКОЛЬ LOGICPIR Ф/Ф 80 мм',
            'LOGICPIR PROF',
            'Экструдированный пенополистирол - 50 мм'
          ],
          expression: `S * ${upperThicknessM}`
        },
        {
          name: 'Телескопический крепеж TERMOCLIP 1, 130 мм',
          aliases: [
            'Телескопический крепеж TERMOCLIP 1, 130 мм',
            'Крепеж кровельный телескопический 60 мм + саморез остроконечный 100 мм + анкер 8*45 мм'
          ],
          expression: 'S * [Крепеж теплоизоляции]'
        },
        {
          name: 'Саморез сверлоконечный ТехноНИКОЛЬ 4,8х60 мм',
          aliases: [
            'Саморез сверлоконечный ТехноНИКОЛЬ 4,8х60 мм',
            'Саморез кровельный 4,8х60 мм'
          ],
          expression: 'S * [Крепеж теплоизоляции]'
        }
      ]
    },
    {
      title: 'Кровельный ковер',
      works: [
        {
          name: 'Монтаж гидроизоляционного покрытия из ПВХ мембраны с продольным нахлестом 120мм и поперечным 200мм.',
          aliases: [
            'Монтаж гидроизоляционного покрытия из ПВХ мембраны с продольным нахлестом 120мм и поперечным 200мм.',
            'Монтаж гидроизоляционного покрытия из ПВХ мембраны, с шириной рулона 2 м, с продольным нахлестом не менее 120мм и поперечным 200мм',
            'Монтаж гидроизоляционного покрытия из ПВХ мембраны, с шириной рулона 0.5-1 м, с продольным нахлестом не менее 120мм и поперечным 200мм'
          ],
          expression: 'S'
        }
      ],
      materials: [
        {
          name: getString(paramValues.membrane_type, 'ПВХ-мембрана ТехноНИКОЛЬ LogicROOF V-RP 1,5 мм'),
          aliases: [
            'Армированная ПВХ мембрана Ecoplast V-RP толщиной 1,5 мм',
            'ПВХ-мембрана ТехноНИКОЛЬ LogicROOF V-RP 1,5 мм'
          ],
          expression: 'S * [ПВХ мембрана ширина 2.1 м k]'
        },
        {
          name: 'Кровельная стальная шайба ТехноНИКОЛЬ D-50мм.',
          aliases: ['Кровельная стальная шайба ТехноНИКОЛЬ D-50мм.'],
          expression: 'S * [Крепеж мембраны шт на 1 м2]'
        },
        {
          name: 'Кровельный саморез 4.8*50 мм + анкер 8*45 мм',
          aliases: [
            'Кровельный саморез 4.8*50 мм + анкер 8*45 мм',
            'Саморез кровельный телескопический 60 мм + саморез остроконечный 100 мм + анкер 8*45 мм'
          ],
          expression: 'S * [Крепеж мембраны шт на 1 м2]'
        }
      ]
    }
  ]

  if (selectedSet.has('parapet')) {
    sections.push({
      title: 'Примыкания',
      works: [
        {
          name: 'Монтаж гидроизоляционного покрытия на парапеты (и вертикальные стены) из ПВХ-мембраны с окончанием под рейку (с промежуточным креплением)',
          aliases: [
            'Монтаж гидроизоляционного покрытия на парапеты (и вертикальные стены) из ПВХ-мембраны с окончанием под рейку (с промежуточным креплением)',
            'Монтаж гидроизоляционного покрытия на парапеты (и вент. шахты) до 450 мм из ПВХ мембраны с окончанием под прижимную и краевую рейку.'
          ],
          expression: 'P'
        },
        {
          name: 'Монтаж прижимной и краевой кровельной планки',
          aliases: [
            'Монтаж прижимной и краевой кровельной планки',
            'Монтаж прижимной и краевой алюминиевой планки'
          ],
          expression: 'P'
        }
      ],
      materials: [
        {
          name: 'Рейка прижимная ТехноНИКОЛЬ',
          aliases: ['Рейка прижимная ТехноНИКОЛЬ', 'Прижимная кровельная планка алюминиевая 30*2000мм'],
          expression: 'P'
        },
        {
          name: 'Рейка краевая ТехноНИКОЛЬ',
          aliases: ['Рейка краевая ТехноНИКОЛЬ', 'Краевая кровельная планка алюминиевая 30*2000мм'],
          expression: 'P'
        },
        {
          name: 'Герметик полиуретановый ТехноНИКОЛЬ, 600мм',
          aliases: ['Герметик полиуретановый ТехноНИКОЛЬ, 600мм'],
          expression: 'P * [Расход герметика на 1 м.п. планки]'
        },
        {
          name: 'Крепеж кровельный ТехноНИКОЛЬ (саморез 5,5*35)',
          aliases: ['Крепеж кровельный ТехноНИКОЛЬ (саморез 5,5*35)'],
          expression: 'P * [Крепеж 5,5х35 на 1 м.п. планки]'
        }
      ]
    })
  }

  if (selectedSet.has('inner_drains') && scope.ID > 0) {
    sections.push({
      title: 'Воронки внутреннего водоотведения',
      works: [
        {
          name: 'Монтаж воронок внутреннего водоотведения',
          aliases: ['Монтаж воронок внутреннего водоотведения'],
          expression: 'ID'
        }
      ],
      materials: []
    })
  }

  if (selectedSet.has('outer_drains') && scope.OD > 0) {
    sections.push({
      title: 'Воронки внешнего водоотведения',
      works: [
        {
          name: 'Монтаж внешнего водоотведения',
          aliases: ['Монтаж внешнего водоотведения', 'Монтаж наружной водосточной системы (тип водосточной системы - не вандалостойкая)'],
          expression: 'OD'
        }
      ],
      materials: []
    })
  }

  if (selectedSet.has('aerators') && scope.A > 0) {
    sections.push({
      title: 'Аэраторы',
      works: [
        {
          name: 'Монтаж кровельных аэраторов',
          aliases: ['Монтаж кровельных аэраторов'],
          expression: 'A'
        }
      ],
      materials: []
    })
  }

  if (selectedSet.has('walkways') && scope.WL > 0) {
    sections.push({
      title: 'Пешеходные дорожки',
      works: [
        {
          name: 'Устройство пешеходных дорожек Puzzle',
          aliases: ['Устройство пешеходных дорожек Puzzle'],
          expression: '(WL / [Walkway Puzzle длина элемента, м]) * [Walkway Puzzle запас k]'
        }
      ],
      materials: []
    })
  }

  return finalizeSections(ctx, sections)
}

async function buildPvcProfSections(ctx) {
  return buildPvcProfPirSections(ctx)
}

async function buildPvcConcreteSections(ctx) {
  const { scope, selectedSet, paramValues } = ctx
  const lowerThicknessM = mmToMeters(paramValues.insulation_bottom_thickness || 50)

  const sections = [
    {
      title: 'Подготовительные работы',
      works: [
        {
          name: 'Подготовка поверхности (очистка поверхности)',
          aliases: ['Подготовка поверхности (очистка поверхности)', 'Подготовка поверхности (зачистка поверхности, удаление наплывов, обеспыливание )'],
          expression: 'S'
        }
      ],
      materials: []
    },
    {
      title: 'Теплоизоляция',
      works: [
        {
          name: 'Устройство минераловатного утеплителя в два слоя, общей толщиной 120 мм',
          aliases: ['Устройство минераловатного утеплителя в два слоя, общей толщиной 120 мм'],
          expression: 'S'
        }
      ],
      materials: [
        {
          name: getString(paramValues.insulation_bottom_type, 'Минераловатный утеплитель 100 мм'),
          aliases: ['Минераловатный утеплитель 100 мм', 'ТЕХНОРУФ Н ПРОФ'],
          expression: `S * ${lowerThicknessM} * [Запас минераловатного утеплителя]`
        }
      ]
    },
    {
      title: 'Кровельный ковер',
      works: [
        {
          name: 'Монтаж гидроизоляционного покрытия из ПВХ мембраны с продольным нахлестом 120мм и поперечным 200мм.',
          aliases: ['Монтаж гидроизоляционного покрытия из ПВХ мембраны с продольным нахлестом 120мм и поперечным 200мм.'],
          expression: 'S'
        }
      ],
      materials: [
        {
          name: getString(paramValues.membrane_type, 'ПВХ-мембрана ТехноНИКОЛЬ LogicROOF V-RP 1,5 мм'),
          aliases: ['Армированная ПВХ мембрана Ecoplast V-RP толщиной 1,5 мм', 'ПВХ-мембрана ТехноНИКОЛЬ LogicROOF V-RP 1,5 мм'],
          expression: 'S * [ПВХ мембрана ширина 2.1 м k]'
        }
      ]
    }
  ]

  if (selectedSet.has('inner_drains') && scope.ID > 0) {
    sections.push({
      title: 'Воронки внутреннего водоотведения',
      works: [{ name: 'Монтаж воронок внутреннего водоотведения', aliases: ['Монтаж воронок внутреннего водоотведения'], expression: 'ID' }],
      materials: []
    })
  }

  return finalizeSections(ctx, sections)
}

async function buildBrmProfSections(ctx) {
  const { scope, selectedSet, paramValues } = ctx
  const lowerThicknessM = mmToMeters(paramValues.insulation_bottom_thickness || 50)

  const sections = [
    {
      title: 'Пароизоляция',
      works: [
        {
          name: 'Монтаж пароизоляции в 1 слой',
          aliases: ['Монтаж пароизоляции в 1 слой', 'Монтаж пароизоляции (плоскость + заведение на парапет)'],
          expression: 'S'
        }
      ],
      materials: [
        {
          name: 'Паробарьер С',
          aliases: ['Паробарьер С', 'Пароизоляционная пленка ТехноНИКОЛЬ'],
          expression: 'S * [Паробарьер С для профлиста Н75-750 k]'
        }
      ]
    },
    {
      title: 'Теплоизоляция',
      works: [
        {
          name: 'Устройство минераловатного утеплителя в два слоя, общей толщиной 120 мм',
          aliases: ['Устройство минераловатного утеплителя в два слоя, общей толщиной 120 мм'],
          expression: 'S'
        }
      ],
      materials: [
        {
          name: getString(paramValues.insulation_bottom_type, 'Минераловатный утеплитель 100 мм'),
          aliases: ['Минераловатный утеплитель 100 мм', 'ТЕХНОРУФ Н ПРОФ'],
          expression: `S * ${lowerThicknessM} * [Запас минераловатного утеплителя]`
        }
      ]
    },
    {
      title: 'Кровельный ковер',
      works: [
        {
          name: 'Монтаж гидроизоляционного покрытия из полимеро-битумного наплавляемого материала в 2 слоя',
          aliases: ['Монтаж гидроизоляционного покрытия из полимеро-битумного наплавляемого материала в 2 слоя'],
          expression: 'S'
        }
      ],
      materials: [
        {
          name: 'Битумный праймер',
          aliases: ['Битумный праймер', 'Праймер битумный ТехноНИКОЛЬ № 01'],
          expression: 'S * [Праймер битумный N01 кг на 1 м2]'
        }
      ]
    }
  ]

  if (selectedSet.has('inner_drains') && scope.ID > 0) {
    sections.push({
      title: 'Воронки внутреннего водоотведения',
      works: [{ name: 'Монтаж воронок внутреннего водоотведения', aliases: ['Монтаж воронок внутреннего водоотведения'], expression: 'ID' }],
      materials: []
    })
  }

  return finalizeSections(ctx, sections)
}

async function buildBrmConcreteSections(ctx) {
  const { scope, selectedSet } = ctx

  const sections = [
    {
      title: 'Подготовительные работы',
      works: [
        {
          name: 'Подготовка поверхности (очистка поверхности)',
          aliases: ['Подготовка поверхности (очистка поверхности)', 'Подготовка поверхности (зачистка поверхности, удаление наплывов, обеспыливание )'],
          expression: 'S'
        },
        {
          name: 'Праймирование основания',
          aliases: ['Праймирование основания', 'Нанесение праймера'],
          expression: 'S'
        }
      ],
      materials: [
        {
          name: 'Битумный праймер',
          aliases: ['Битумный праймер', 'Праймер битумный ТехноНИКОЛЬ № 01'],
          expression: 'S * [Праймер битумный N01 кг на 1 м2]'
        }
      ]
    },
    {
      title: 'Кровельный ковер',
      works: [
        {
          name: 'Монтаж гидроизоляционного покрытия из полимеро-битумного наплавляемого материала в 2 слоя',
          aliases: ['Монтаж гидроизоляционного покрытия из полимеро-битумного наплавляемого материала в 2 слоя'],
          expression: 'S'
        }
      ],
      materials: []
    }
  ]

  if (selectedSet.has('inner_drains') && scope.ID > 0) {
    sections.push({
      title: 'Воронки внутреннего водоотведения',
      works: [{ name: 'Монтаж воронок внутреннего водоотведения', aliases: ['Монтаж воронок внутреннего водоотведения'], expression: 'ID' }],
      materials: []
    })
  }

  return finalizeSections(ctx, sections)
}

async function finalizeSections(ctx, sections) {
  const { scope, worksDb, materialsDb, coefficientsDb } = ctx
  const result = []

  for (const section of sections) {
    const works = []
    const materials = []

    for (const row of section.works || []) {
      const work = createWorkItem(row, worksDb, scope)
      works.push(work)
    }

    for (const row of section.materials || []) {
      const material = createMaterialItem(row, materialsDb, scope, coefficientsDb)
      materials.push(material)
    }

    for (const work of works) {
      work.qty = evaluateQty(work.expression, scope, coefficientsDb)
    }

    for (const material of materials) {
      material.qty = evaluateQty(material.expression, scope, coefficientsDb)
    }

    result.push({
      id: crypto.randomUUID(),
      title: section.title,
      works,
      materials
    })
  }

  return result
}

function createWorkItem(row, worksDb, scope) {
  const found = findWorkRow(worksDb, row.aliases || [row.name])

  return {
    code: found?.идентификатор || '',
    name: found?.наименование_работы || row.name,
    unit: found?.единица_измерения_работы || row.unit || '',
    expression: normalizeExpression(row.expression),
    qty: 0,
    price: found ? pickWorkPriceByArea(found, scope.S) : 0
  }
}

function createMaterialItem(row, materialsDb, scope, coefficientsDb) {
  const found = findMaterialRow(materialsDb, row.aliases || [row.name])

  return {
    code: found?.артикул_товара || found?.идентификатор || '',
    name: found?.полное_наименование_материала || row.name,
    supplier: 'ТехноНИКОЛЬ',
    unit: found?.единица_измерения || row.unit || '',
    expression: normalizeExpression(row.expression),
    qty: evaluateQty(normalizeExpression(row.expression), scope, coefficientsDb),
    price: found?.базовая_цена || 0
  }
}

function findWorkRow(worksDb, aliases) {
  for (const alias of aliases) {
    const exact = worksDb.find(item => normalize(item.наименование_работы) === normalize(alias))
    if (exact) return exact
  }

  for (const alias of aliases) {
    const like = worksDb.find(item => normalize(item.наименование_работы).includes(normalize(alias)) || normalize(alias).includes(normalize(item.наименование_работы)))
    if (like) return like
  }

  return null
}

function findMaterialRow(materialsDb, aliases) {
  for (const alias of aliases) {
    const exact = materialsDb.find(item => normalize(item.полное_наименование_материала) === normalize(alias))
    if (exact) return exact
  }

  for (const alias of aliases) {
    const like = materialsDb.find(item => normalize(item.полное_наименование_материала).includes(normalize(alias)) || normalize(alias).includes(normalize(item.полное_наименование_материала)))
    if (like) return like
  }

  return null
}

function evaluateQty(expression, scope, coefficientsDb) {
  const expr = `${expression || '0'}`.trim()
  if (!expr) return 0

  let prepared = expr.replace(/\[(.*?)\]/g, (_, coefName) => {
    const coefficient = coefficientsDb.find(item => normalize(item.название) === normalize(coefName))
    return coefficient ? `${Number(coefficient.значение)}` : '1'
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

function createScope(paramValues) {
  const S = toNumber(paramValues.roof_area)
  const P = toNumber(paramValues.parapet_length || paramValues.roof_perimeter)
  const ID = toNumber(paramValues.inner_drains_count)
  const A = toNumber(paramValues.aerators_count)
  const OD = toNumber(paramValues.outer_drains_count)
  const WL = toNumber(paramValues.walkways_length)
  const D = toNumber(paramValues.deformation_joint_length)
  const PT = toNumber(paramValues.pass_through_count)

  return {
    S,
    P,
    ID,
    A,
    OD,
    WL,
    D,
    PT
  }
}

function buildCustomParams(scope) {
  const params = []

  if (scope.OD > 0) {
    params.push({ name: 'Внешние воронки', symbol: 'OD', value: scope.OD })
  }

  if (scope.WL > 0) {
    params.push({ name: 'Пешеходные дорожки', symbol: 'WL', value: scope.WL })
  }

  if (scope.D > 0) {
    params.push({ name: 'Деформационный шов', symbol: 'D', value: scope.D })
  }

  if (scope.PT > 0) {
    params.push({ name: 'Проходки', symbol: 'PT', value: scope.PT })
  }

  return params
}

function resolveSystemProfile(system) {
  const code = normalize(system?.код || '')
  const base = normalize(system?.тип_основания || '')
  const hydro = normalize(system?.тип_гидроизоляции || '')
  const name = normalize(system?.название || '')

  if ((code.includes('smart-pir') || name.includes('pir')) && hydro.includes('pvc') && base.includes('prof')) {
    return 'pvc_prof_pir'
  }

  if (hydro.includes('pvc') && base.includes('prof')) {
    return 'pvc_prof'
  }

  if (hydro.includes('pvc')) {
    return 'pvc_jb'
  }

  if (hydro.includes('brm') && base.includes('prof')) {
    return 'brm_prof'
  }

  return 'brm_jb'
}

function normalizeExpression(expression) {
  return `${expression || '0'}`
    .replace(/\bs\b/g, 'S')
    .replace(/\bp\b/g, 'P')
    .replace(/\bid\b/gi, 'ID')
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

function roundQty(value) {
  return Math.round(value * 1000) / 1000
}

function mmToMeters(value) {
  return toNumber(value) / 1000
}

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function getString(value, fallback) {
  return `${value || fallback || ''}`.trim()
}

function normalize(value) {
  return `${value || ''}`.toLowerCase().replace(/\s+/g, ' ').trim()
}