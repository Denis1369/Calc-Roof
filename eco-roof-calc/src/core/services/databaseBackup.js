import { getDb } from '@/core/db/client'
import { saveBinaryFile } from '@/core/utils/binaryFileExport'

const BACKUP_FILE_EXTENSION = 'roofcalcdb'
const BACKUP_FILE_MIME = 'application/json'
const BACKUP_FILE_TYPE = 'roofcalc-database-backup'
const BACKUP_VERSION = 1
const LOCK_RETRY_COUNT = 8
const LOCK_RETRY_DELAY_MS = 250

const TABLES = [
  'app_meta',
  'materials',
  'material_variants',
  'works',
  'work_price_tiers',
  'coefficients',
  'formulas',
  'systems',
  'system_params',
  'system_features',
  'system_layers',
  'system_layer_material_options',
  'system_layer_work_links',
  'system_default_overrides',
  'saved_system_configs',
  'saved_estimates'
]

const CLEAR_ORDER = [
  'system_layer_material_options',
  'system_layer_work_links',
  'system_layers',
  'system_params',
  'system_features',
  'system_default_overrides',
  'saved_system_configs',
  'saved_estimates',
  'material_variants',
  'work_price_tiers',
  'systems',
  'materials',
  'works',
  'coefficients',
  'formulas',
  'app_meta'
]

function quoteIdentifier(identifier) {
  return `"${`${identifier || ''}`.replaceAll('"', '""')}"`
}

function sanitizeFileName(value) {
  const date = new Date().toISOString().slice(0, 10)
  const prepared = `${value || `roofcalc-base-${date}`}`
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()

  return prepared || `roofcalc-base-${date}`
}

async function getExistingTables(db) {
  const rows = await db.select(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
  `)

  return new Set(rows.map((row) => row.name))
}

async function getTableColumns(db, tableName) {
  const rows = await db.select(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
  return rows.map((row) => row.name)
}

async function selectTableRows(db, tableName, existingTables) {
  if (!existingTables.has(tableName)) return []
  return db.select(`SELECT * FROM ${quoteIdentifier(tableName)}`)
}

function buildCounts(tables) {
  return Object.fromEntries(
    Object.entries(tables || {}).map(([tableName, rows]) => [
      tableName,
      Array.isArray(rows) ? rows.length : 0
    ])
  )
}

function formatError(error) {
  if (!error) return 'Неизвестная ошибка'
  if (typeof error === 'string') return error
  if (error.message) return error.message

  try {
    return JSON.stringify(error)
  } catch {
    return `${error}`
  }
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function isDatabaseLockedError(error) {
  return /database is locked|database table is locked|code:\s*5/i.test(formatError(error))
}

async function executeWithRetry(db, query, params = [], context = 'Запрос к базе') {
  let lastError = null

  for (let attempt = 0; attempt <= LOCK_RETRY_COUNT; attempt += 1) {
    try {
      return await db.execute(query, params)
    } catch (error) {
      lastError = error

      if (!isDatabaseLockedError(error) || attempt === LOCK_RETRY_COUNT) {
        break
      }

      await sleep(LOCK_RETRY_DELAY_MS * (attempt + 1))
    }
  }

  throw new Error(`${context}: ${formatError(lastError)}`)
}

export async function exportDatabaseBackup() {
  const db = await getDb()
  const existingTables = await getExistingTables(db)
  const tables = {}

  for (const tableName of TABLES) {
    tables[tableName] = await selectTableRows(db, tableName, existingTables)
  }

  const payload = {
    app: 'RoofCalc',
    fileType: BACKUP_FILE_TYPE,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
    counts: buildCounts(tables)
  }

  const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2))
  const fileName = `${sanitizeFileName('roofcalc-base')}.${BACKUP_FILE_EXTENSION}`

  return saveBinaryFile({
    bytes,
    fileName,
    mimeType: BACKUP_FILE_MIME
  })
}

function normalizeBackupPayload(parsed) {
  if (parsed?.fileType !== BACKUP_FILE_TYPE || parsed?.app !== 'RoofCalc') {
    throw new Error('Selected file is not a RoofCalc database backup')
  }

  if (!parsed?.tables || typeof parsed.tables !== 'object') {
    throw new Error('Backup file does not contain tables')
  }

  return parsed
}

async function clearTables(db, existingTables) {
  for (const tableName of CLEAR_ORDER) {
    if (!existingTables.has(tableName)) continue
    try {
      await executeWithRetry(
        db,
        `DELETE FROM ${quoteIdentifier(tableName)}`,
        [],
        `Очистка таблицы ${tableName}`
      )
    } catch (error) {
      throw error
    }
  }
}

async function insertTableRows(db, tableName, rows, existingTables) {
  if (!existingTables.has(tableName) || !Array.isArray(rows) || !rows.length) return

  const columns = await getTableColumns(db, tableName)
  const columnSet = new Set(columns)

  for (const [rowIndex, row] of rows.entries()) {
    const insertColumns = Object.keys(row || {}).filter((column) => columnSet.has(column))
    if (!insertColumns.length) continue

    const placeholders = insertColumns.map((_, index) => `$${index + 1}`)
    const values = insertColumns.map((column) => row[column])

    try {
      await executeWithRetry(
        db,
        `INSERT OR REPLACE INTO ${quoteIdentifier(tableName)} (${insertColumns.map(quoteIdentifier).join(', ')})
         VALUES (${placeholders.join(', ')})`,
        values,
        `Импорт таблицы ${tableName}, строка ${rowIndex + 1}${row?.id !== undefined ? `, id=${row.id}` : ''}`
      )
    } catch (error) {
      throw error
    }
  }
}

async function importTables(db, tables, existingTables) {
  await clearTables(db, existingTables)

  for (const tableName of TABLES) {
    await insertTableRows(db, tableName, tables[tableName] || [], existingTables)
  }
}

export async function importDatabaseBackupFile(file) {
  if (!file) return null

  const raw = await file.text()
  const parsed = normalizeBackupPayload(JSON.parse(raw))
  const db = await getDb()
  const existingTables = await getExistingTables(db)

  try {
    await executeWithRetry(db, 'PRAGMA busy_timeout = 5000', [], 'Настройка ожидания базы')
    await executeWithRetry(db, 'PRAGMA foreign_keys = OFF', [], 'Подготовка базы к импорту')
  } catch (error) {
    throw error
  }

  try {
    await importTables(db, parsed.tables, existingTables)
  } catch (error) {
    throw error
  } finally {
    await executeWithRetry(db, 'PRAGMA foreign_keys = ON', [], 'Включение проверки связей').catch((error) => {
      console.warn('Не удалось сразу включить проверку внешних ключей после импорта.', error)
    })
  }

  return {
    exportedAt: parsed.exportedAt || '',
    counts: buildCounts(parsed.tables)
  }
}

export { BACKUP_FILE_EXTENSION }
