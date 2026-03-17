import Database from '@tauri-apps/plugin-sql'

const DB_URL = 'sqlite:eco_roof_v2_dev_2.db'

let dbPromise = null

export async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await Database.load(DB_URL)
      await db.execute('PRAGMA foreign_keys = ON')
      return db
    })()
  }

  return dbPromise
}

export function resetDbInstance() {
  dbPromise = null
}

export { DB_URL }