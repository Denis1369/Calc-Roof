import Database from '@tauri-apps/plugin-sql'

let dbInstance = null

export async function getDb() {
  if (!dbInstance) {
    dbInstance = await Database.load('sqlite:eco_roof_v2.db')
  }
  return dbInstance
}

export async function initDatabase() {
  const db = await getDb()

  await db.execute(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      normalize_key TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT '',
      subcategory TEXT NOT NULL DEFAULT '',
      base_name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      brand TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      material_type TEXT NOT NULL DEFAULT '',
      unit TEXT NOT NULL DEFAULT '',
      base_price REAL NOT NULL DEFAULT 0,
      source_url TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS material_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      normalize_key TEXT NOT NULL,
      variant_type TEXT NOT NULL DEFAULT 'option',
      variant_label TEXT NOT NULL,
      sku TEXT NOT NULL DEFAULT '',
      thickness_mm REAL,
      width_mm REAL,
      height_mm REAL,
      density REAL,
      profile_name TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      source_url TEXT NOT NULL DEFAULT '',
      extra_json TEXT NOT NULL DEFAULT '{}',
      is_default INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(material_id, normalize_key),
      FOREIGN KEY(material_id) REFERENCES materials(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS works (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      normalize_key TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS work_price_tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_id INTEGER NOT NULL,
      area_from REAL NOT NULL DEFAULT 0,
      area_to REAL,
      price REAL NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(work_id, area_from, area_to),
      FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS coefficients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      normalize_key TEXT NOT NULL UNIQUE,
      group_name TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS formulas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      expression TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS systems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      roof_base TEXT NOT NULL DEFAULT '',
      waterproofing_type TEXT NOT NULL DEFAULT '',
      insulation_family TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      source_url TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_params (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      system_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      param_type TEXT NOT NULL DEFAULT 'text',
      unit TEXT NOT NULL DEFAULT '',
      default_value TEXT NOT NULL DEFAULT '',
      options_json TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(system_id, code),
      FOREIGN KEY(system_id) REFERENCES systems(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_features (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      system_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(system_id, code),
      FOREIGN KEY(system_id) REFERENCES systems(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_layers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      system_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      layer_kind TEXT NOT NULL DEFAULT '',
      is_optional INTEGER NOT NULL DEFAULT 0,
      feature_code TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(system_id, code),
      FOREIGN KEY(system_id) REFERENCES systems(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_layer_material_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layer_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'default',
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      UNIQUE(layer_id, material_id, role),
      FOREIGN KEY(layer_id) REFERENCES system_layers(id) ON DELETE CASCADE,
      FOREIGN KEY(material_id) REFERENCES materials(id) ON DELETE CASCADE
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_layer_work_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layer_id INTEGER NOT NULL,
      work_id INTEGER NOT NULL,
      formula_code TEXT NOT NULL DEFAULT '',
      default_expression TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      UNIQUE(layer_id, work_id),
      FOREIGN KEY(layer_id) REFERENCES system_layers(id) ON DELETE CASCADE,
      FOREIGN KEY(work_id) REFERENCES works(id) ON DELETE CASCADE,
      FOREIGN KEY(formula_code) REFERENCES formulas(code) ON DELETE SET NULL
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS saved_system_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      system_code TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      params_json TEXT NOT NULL DEFAULT '{}',
      features_json TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS saved_estimates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      estimate_json TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute('CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category, subcategory)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_variants_material_id ON material_variants(material_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_works_category ON works(category)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_work_tiers_work_id ON work_price_tiers(work_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_system_layers_system_id ON system_layers(system_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_system_params_system_id ON system_params(system_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_system_features_system_id ON system_features(system_id)')

  return db
}

export async function resetDatabase() {
  const db = await getDb()

  await db.execute('DROP TABLE IF EXISTS system_layer_work_links')
  await db.execute('DROP TABLE IF EXISTS system_layer_material_options')
  await db.execute('DROP TABLE IF EXISTS system_layers')
  await db.execute('DROP TABLE IF EXISTS system_features')
  await db.execute('DROP TABLE IF EXISTS system_params')
  await db.execute('DROP TABLE IF EXISTS systems')
  await db.execute('DROP TABLE IF EXISTS formulas')
  await db.execute('DROP TABLE IF EXISTS coefficients')
  await db.execute('DROP TABLE IF EXISTS work_price_tiers')
  await db.execute('DROP TABLE IF EXISTS works')
  await db.execute('DROP TABLE IF EXISTS material_variants')
  await db.execute('DROP TABLE IF EXISTS materials')
  await db.execute('DROP TABLE IF EXISTS saved_system_configs')
  await db.execute('DROP TABLE IF EXISTS saved_estimates')

  dbInstance = null
  await initDatabase()
}

export function normalizeKey(value) {
  return `${value || ''}`
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/®/g, '')
    .replace(/[^a-zа-я0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
}

export async function listSystems() {
  const db = await getDb()
  return db.select('SELECT * FROM systems WHERE is_active = 1 ORDER BY sort_order, name')
}

export async function getSystemByCode(code) {
  const db = await getDb()
  const rows = await db.select('SELECT * FROM systems WHERE code = $1 LIMIT 1', [code])
  return rows[0] || null
}

export async function getSystemLayers(systemId) {
  const db = await getDb()
  return db.select('SELECT * FROM system_layers WHERE system_id = $1 ORDER BY sort_order, id', [systemId])
}

export async function getMaterialWithVariantsByBaseName(baseName) {
  const db = await getDb()
  const rows = await db.select('SELECT * FROM materials WHERE normalize_key = $1 LIMIT 1', [normalizeKey(baseName)])
  if (!rows.length) return null
  const material = rows[0]
  const variants = await db.select('SELECT * FROM material_variants WHERE material_id = $1 AND is_active = 1 ORDER BY is_default DESC, thickness_mm, variant_label', [material.id])
  return { material, variants }
}
