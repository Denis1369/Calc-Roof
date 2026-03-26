import { getDb } from './client'
import { migration001InitV2 } from './migrations/001_init_v2'
import { migration004TemplateFormulaSupport } from './migrations/004_template_formula_support'
import { migration005SystemDefaultOverrides } from './migrations/005_system_default_overrides'

const migrations = [migration001InitV2, migration004TemplateFormulaSupport, migration005SystemDefaultOverrides]

async function ensureMigrationsTable(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

export async function runMigrations() {
  const db = await getDb()

  await ensureMigrationsTable(db)

  const rows = await db.select('SELECT version FROM schema_migrations')
  const applied = new Set(rows.map((row) => row.version))

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue
    }

    await migration.up(db)
    await db.execute(
      'INSERT INTO schema_migrations (version) VALUES ($1)',
      [migration.version]
    )
  }

  return db
}