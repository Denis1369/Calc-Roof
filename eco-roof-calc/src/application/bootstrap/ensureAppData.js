import { runMigrations } from '../../infrastructure/db/runMigrations'
import { runSeed } from '../../infrastructure/seed/runSeed'

async function getTableCount(db, tableName) {
  const rows = await db.select(`SELECT COUNT(*) AS total FROM ${tableName}`)
  return Number(rows[0]?.total ?? 0)
}

export async function ensureAppData() {
  const db = await runMigrations()

  const [materialsCount, worksCount, systemsCount] = await Promise.all([
    getTableCount(db, 'materials'),
    getTableCount(db, 'works'),
    getTableCount(db, 'systems')
  ])

  const shouldSeed =
    materialsCount === 0 ||
    worksCount === 0 ||
    systemsCount === 0

  if (shouldSeed) {
    await runSeed(db)
  }

  return db
}