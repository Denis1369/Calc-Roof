import Database from '@tauri-apps/plugin-sql'

let dbInstance = null

export async function getDb() {
  if (!dbInstance) {
    dbInstance = await Database.load('sqlite:estimates.db')
  }
  return dbInstance
}

export async function initDatabase() {
  const db = await getDb()

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Справочник_материалов (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      главная_категория TEXT,
      подкатегория TEXT,
      артикул_товара TEXT,
      полное_наименование_материала TEXT,
      единица_измерения TEXT,
      базовая_цена REAL DEFAULT 0,
      ссылка TEXT
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Справочник_вариантов_материалов (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      артикул_товара TEXT,
      полное_наименование_варианта TEXT,
      тип_варианта TEXT DEFAULT 'толщина',
      значение_варианта REAL DEFAULT 0,
      единица_варианта TEXT DEFAULT 'мм',
      label_варианта TEXT DEFAULT '',
      длина REAL DEFAULT 0,
      ширина REAL DEFAULT 0,
      плотность REAL DEFAULT 0,
      базовая_цена REAL DEFAULT 0,
      ссылка TEXT,
      активен INTEGER DEFAULT 1
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Справочник_видов_работ (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      категория_работы TEXT DEFAULT 'Общие работы',
      наименование_работы TEXT,
      единица_измерения_работы TEXT,
      цена_0_300 REAL DEFAULT 0,
      цена_300_600 REAL DEFAULT 0,
      цена_600_1000 REAL DEFAULT 0,
      цена_1000_3000 REAL DEFAULT 0,
      цена_3000_6000 REAL DEFAULT 0,
      цена_6000_15000 REAL DEFAULT 0,
      цена_15000_30000 REAL DEFAULT 0,
      цена_более_30000 REAL DEFAULT 0
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Справочник_коэффициентов (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      заголовок TEXT,
      название TEXT,
      значение REAL
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Справочник_формул (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      название_формулы TEXT,
      выражение TEXT
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Сохраненные_сметы (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      название_объекта TEXT,
      дата_создания DATETIME DEFAULT CURRENT_TIMESTAMP,
      данные_сметы_json TEXT
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Справочник_шаблонов (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      название TEXT,
      данные_json TEXT
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Справочник_систем (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      код TEXT UNIQUE,
      название TEXT NOT NULL,
      тип_основания TEXT,
      тип_гидроизоляции TEXT,
      превью TEXT,
      опции_json TEXT NOT NULL,
      параметры_json TEXT NOT NULL,
      правила_генерации_json TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      активна INTEGER DEFAULT 1
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Сохраненные_конфигурации_систем (
      идентификатор INTEGER PRIMARY KEY AUTOINCREMENT,
      код_системы TEXT NOT NULL,
      название TEXT,
      выбранные_опции_json TEXT NOT NULL,
      введенные_параметры_json TEXT NOT NULL,
      дата_создания DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute('CREATE INDEX IF NOT EXISTS idx_material_variants_material_id ON Справочник_вариантов_материалов(material_id)').catch(() => {})
  await db.execute('CREATE INDEX IF NOT EXISTS idx_material_name ON Справочник_материалов(полное_наименование_материала)').catch(() => {})
  await db.execute('CREATE INDEX IF NOT EXISTS idx_work_name ON Справочник_видов_работ(наименование_работы)').catch(() => {})

  await db.execute("ALTER TABLE Справочник_материалов ADD COLUMN избранное INTEGER DEFAULT 0").catch(() => {})
  await db.execute("ALTER TABLE Справочник_видов_работ ADD COLUMN избранное INTEGER DEFAULT 0").catch(() => {})
  await db.execute("ALTER TABLE Справочник_материалов ADD COLUMN бренд TEXT DEFAULT ''").catch(() => {})
  await db.execute("ALTER TABLE Справочник_материалов ADD COLUMN модель TEXT DEFAULT ''").catch(() => {})
  await db.execute("ALTER TABLE Справочник_материалов ADD COLUMN тип_материала TEXT DEFAULT ''").catch(() => {})
  await db.execute("ALTER TABLE Справочник_материалов ADD COLUMN базовое_наименование TEXT DEFAULT ''").catch(() => {})
  await db.execute("ALTER TABLE Справочник_материалов ADD COLUMN система_тип TEXT DEFAULT ''").catch(() => {})

  console.log('Гибридная база данных успешно инициализирована!')
}

export function createTemplateField(overrides = {}) {
  return {
    key: crypto.randomUUID(),
    label: '',
    type: 'number',
    unit: '',
    value: '',
    ...overrides
  }
}

export function createTemplateItem(overrides = {}) {
  return {
    key: crypto.randomUUID(),
    label: '',
    checked: false,
    fields: [createTemplateField()],
    ...overrides
  }
}

export function createTemplatePayload(overrides = {}) {
  return {
    version: 2,
    items: [],
    ...overrides
  }
}

export function createSystemOptionParam(overrides = {}) {
  return {
    key: crypto.randomUUID(),
    label: '',
    description: '',
    placeholder: '',
    example: '',
    type: 'number',
    unit: '',
    value: '',
    group: 'additional',
    options: [],
    ...overrides
  }
}

export function createSystemOption(overrides = {}) {
  return {
    key: crypto.randomUUID(),
    label: '',
    default: false,
    params: [],
    ...overrides
  }
}

export function createSystemParam(overrides = {}) {
  return {
    key: crypto.randomUUID(),
    label: '',
    description: '',
    placeholder: '',
    example: '',
    type: 'number',
    unit: '',
    value: '',
    group: 'basic',
    options: [],
    required: false,
    customPlaceholder: 'Введите свой вариант',
    ...overrides
  }
}

export function createSystemRuleRow(overrides = {}) {
  return {
    key: crypto.randomUUID(),
    type: 'material',
    name: '',
    aliases: [],
    unit: '',
    qty_formula: '',
    price_formula: '',
    article: '',
    supplier: '',
    optional_feature_key: '',
    ...overrides
  }
}

export function createSystemRuleSection(overrides = {}) {
  return {
    key: crypto.randomUUID(),
    title: '',
    works: [],
    materials: [],
    optional_feature_key: '',
    ...overrides
  }
}

export function createSystemPayload(overrides = {}) {
  return {
    код: '',
    название: '',
    тип_основания: '',
    тип_гидроизоляции: '',
    превью: '',
    опции: [],
    параметры: [],
    правила_генерации: [],
    sort_order: 0,
    активна: 1,
    ...overrides
  }
}

export function createMaterialVariant(overrides = {}) {
  return {
    идентификатор: null,
    material_id: null,
    артикул_товара: '',
    полное_наименование_варианта: '',
    тип_варианта: 'толщина',
    значение_варианта: 0,
    единица_варианта: 'мм',
    label_варианта: '',
    длина: 0,
    ширина: 0,
    плотность: 0,
    базовая_цена: 0,
    ссылка: '',
    активен: 1,
    ...overrides
  }
}

export function normalizeTemplateData(rawValue) {
  if (!rawValue) {
    return createTemplatePayload()
  }

  try {
    const parsed = JSON.parse(rawValue)

    if (Array.isArray(parsed)) {
      return createTemplatePayload({
        items: parsed.map(item => ({
          ...createTemplateItem(),
          ...item,
          fields: Array.isArray(item.fields)
            ? item.fields.map(field => ({ ...createTemplateField(), ...field }))
            : [createTemplateField()]
        }))
      })
    }

    return createTemplatePayload({
      ...parsed,
      items: Array.isArray(parsed.items)
        ? parsed.items.map(item => ({
            ...createTemplateItem(),
            ...item,
            fields: Array.isArray(item.fields)
              ? item.fields.map(field => ({ ...createTemplateField(), ...field }))
              : [createTemplateField()]
          }))
        : []
    })
  } catch {
    return createTemplatePayload()
  }
}

export function normalizeSystemOptions(rawValue) {
  if (!rawValue) return []

  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue
    if (!Array.isArray(parsed)) return []

    return parsed.map(option => ({
      ...createSystemOption(),
      ...option,
      params: Array.isArray(option.params)
        ? option.params.map(param => ({ ...createSystemOptionParam(), ...param }))
        : []
    }))
  } catch {
    return []
  }
}

export function normalizeSystemParams(rawValue) {
  if (!rawValue) return []

  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue
    if (!Array.isArray(parsed)) return []

    return parsed.map(param => ({
      ...createSystemParam(),
      ...param
    }))
  } catch {
    return []
  }
}

export function normalizeSystemRules(rawValue) {
  if (!rawValue) return []

  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue
    if (!Array.isArray(parsed)) return []

    return parsed.map(section => ({
      ...createSystemRuleSection(),
      ...section,
      works: Array.isArray(section.works)
        ? section.works.map(row => ({ ...createSystemRuleRow({ type: 'work' }), ...row }))
        : [],
      materials: Array.isArray(section.materials)
        ? section.materials.map(row => ({ ...createSystemRuleRow({ type: 'material' }), ...row }))
        : []
    }))
  } catch {
    return []
  }
}

export function normalizeSystemRecord(row) {
  return {
    идентификатор: row.идентификатор,
    код: row.код || '',
    название: row.название || '',
    тип_основания: row.тип_основания || '',
    тип_гидроизоляции: row.тип_гидроизоляции || '',
    превью: row.превью || '',
    sort_order: row.sort_order ?? 0,
    активна: row.активна ?? 1,
    опции: normalizeSystemOptions(row.опции_json),
    параметры: normalizeSystemParams(row.параметры_json),
    правила_генерации: normalizeSystemRules(row.правила_генерации_json)
  }
}

export function normalizeMaterialVariantRecord(row) {
  return createMaterialVariant({
    идентификатор: row.идентификатор,
    material_id: row.material_id,
    артикул_товара: row.артикул_товара || '',
    полное_наименование_варианта: row.полное_наименование_варианта || '',
    тип_варианта: row.тип_варианта || 'толщина',
    значение_варианта: row.значение_варианта ?? 0,
    единица_варианта: row.единица_варианта || 'мм',
    label_варианта: row.label_варианта || '',
    длина: row.длина ?? 0,
    ширина: row.ширина ?? 0,
    плотность: row.плотность ?? 0,
    базовая_цена: row.базовая_цена ?? 0,
    ссылка: row.ссылка || '',
    активен: row.активен ?? 1
  })
}
