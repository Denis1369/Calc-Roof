import { getDb } from '../db/client'

function tryParseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

export class EstimateRepository {
  async saveEstimate({ id = null, title = '', estimate }) {
    const db = await getDb()
    const estimateJson = JSON.stringify(estimate ?? {})

    if (id) {
      await db.execute(
        `UPDATE saved_estimates
         SET title = $1, estimate_json = $2
         WHERE id = $3`,
        [title, estimateJson, id]
      )

      return this.loadEstimate(id)
    }

    const insertResult = await db.execute(
      `INSERT INTO saved_estimates (title, estimate_json)
       VALUES ($1, $2)`,
      [title, estimateJson]
    )

    const savedId = Number(insertResult?.lastInsertId ?? 0)
    if (savedId > 0) {
      return this.loadEstimate(savedId)
    }

    const rows = await db.select('SELECT last_insert_rowid() AS id')
    return this.loadEstimate(rows[0]?.id)
  }

  async loadEstimate(id) {
    const db = await getDb()

    const rows = await db.select(
      'SELECT * FROM saved_estimates WHERE id = $1 LIMIT 1',
      [id]
    )

    if (!rows.length) {
      return null
    }

    const row = rows[0]

    return {
      ...row,
      estimate: tryParseJson(row.estimate_json, {})
    }
  }

  async listSavedEstimates() {
    const db = await getDb()

    const rows = await db.select(`
      SELECT *
      FROM saved_estimates
      ORDER BY id DESC
    `)

    return rows.map((row) => ({
      ...row,
      estimate: tryParseJson(row.estimate_json, {})
    }))
  }

  async deleteEstimate(id) {
    const db = await getDb()
    await db.execute('DELETE FROM saved_estimates WHERE id = $1', [id])
  }
}
