export const id = '003_favorites'

export async function up(db) {
  await db.execute(`
    ALTER TABLE materials
    ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0
  `).catch(() => {})

  await db.execute(`
    ALTER TABLE works
    ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0
  `).catch(() => {})

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_materials_is_favorite
    ON materials (is_favorite)
  `)

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_works_is_favorite
    ON works (is_favorite)
  `)
}
