export const migration005SystemDefaultOverrides = {
  version: '005_system_default_overrides',
  async up(db) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS system_default_overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        system_code TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL DEFAULT '',
        payload_json TEXT NOT NULL DEFAULT '{}',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }
}
