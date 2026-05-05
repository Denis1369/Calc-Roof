import { getDb } from '../db/client'

export class AppMetaRepository {
  async get(key) {
    try {
      const db = await getDb()
      const rows = await db.select('SELECT value FROM app_meta WHERE key = $1', [key])
      return rows.length > 0 ? rows[0].value : null
    } catch (e) {
      console.error(`Ошибка при получении app_meta для ключа ${key}:`, e)
      return null
    }
  }

  async set(key, value) {
    try {
      const db = await getDb()
      // Сохраняем или обновляем значение (SQLite UPSERT)
      await db.execute(
        `INSERT INTO app_meta (key, value, updated_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP) 
         ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
        [key, value]
      )
    } catch (e) {
      console.error(`Ошибка при сохранении app_meta для ключа ${key}:`, e)
      throw e
    }
  }
}
