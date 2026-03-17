import { getDb } from '../db/client'

function tryParseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

export class SystemRepository {
  async listSystems({ includeInactive = false } = {}) {
    const db = await getDb()

    return db.select(`
      SELECT *
      FROM systems
      ${includeInactive ? '' : 'WHERE is_active = 1'}
      ORDER BY sort_order, name, id
    `)
  }

  async getSystemByCode(code) {
    const db = await getDb()

    const rows = await db.select(
      'SELECT * FROM systems WHERE code = $1 LIMIT 1',
      [code]
    )

    return rows[0] || null
  }

  async getFullSystemByCode(code) {
    const db = await getDb()
    const system = await this.getSystemByCode(code)

    if (!system) {
      return null
    }

    const params = await db.select(
      `SELECT *
       FROM system_params
       WHERE system_id = $1
       ORDER BY sort_order, id`,
      [system.id]
    )

    const features = await db.select(
      `SELECT *
       FROM system_features
       WHERE system_id = $1
       ORDER BY sort_order, id`,
      [system.id]
    )

    const layers = await db.select(
      `SELECT *
       FROM system_layers
       WHERE system_id = $1
       ORDER BY sort_order, id`,
      [system.id]
    )

    const hydratedLayers = []

    for (const layer of layers) {
      const materialOptions = await db.select(
        `SELECT
          slmo.*,
          m.normalize_key AS material_normalize_key,
          m.category AS material_category,
          m.subcategory AS material_subcategory,
          m.base_name AS material_base_name,
          m.display_name AS material_display_name,
          m.brand AS material_brand,
          m.model AS material_model,
          m.material_type AS material_type,
          m.unit AS material_unit,
          m.base_price AS material_base_price,
          m.source_url AS material_source_url,
          m.notes AS material_notes
        FROM system_layer_material_options slmo
        INNER JOIN materials m ON m.id = slmo.material_id
        WHERE slmo.layer_id = $1
        ORDER BY slmo.sort_order, slmo.id`,
        [layer.id]
      )

      const workLinks = await db.select(
        `SELECT
          slwl.*,
          w.category AS work_category,
          w.name AS work_name,
          w.unit AS work_unit,
          w.notes AS work_notes,
          f.name AS formula_name,
          f.expression AS formula_expression,
          f.description AS formula_description
        FROM system_layer_work_links slwl
        INNER JOIN works w ON w.id = slwl.work_id
        LEFT JOIN formulas f ON f.code = slwl.formula_code
        WHERE slwl.layer_id = $1
        ORDER BY slwl.sort_order, slwl.id`,
        [layer.id]
      )

      hydratedLayers.push({
        ...layer,
        material_options: materialOptions,
        work_links: workLinks
      })
    }

    return {
      ...system,
      params: params.map((param) => ({
        ...param,
        options: tryParseJson(param.options_json, [])
      })),
      features,
      layers: hydratedLayers
    }
  }

  async saveSystemConfig({
    id = null,
    systemCode,
    title = '',
    params = {},
    features = {}
  }) {
    const db = await getDb()

    if (!systemCode) {
      throw new Error('systemCode is required')
    }

    if (id) {
      await db.execute(
        `UPDATE saved_system_configs SET
          system_code = $1,
          title = $2,
          params_json = $3,
          features_json = $4
        WHERE id = $5`,
        [
          systemCode,
          title,
          JSON.stringify(params),
          JSON.stringify(features),
          id
        ]
      )

      return this.loadSystemConfig(id)
    }

    await db.execute(
      `INSERT INTO saved_system_configs (
        system_code,
        title,
        params_json,
        features_json
      ) VALUES ($1,$2,$3,$4)`,
      [
        systemCode,
        title,
        JSON.stringify(params),
        JSON.stringify(features)
      ]
    )

    const rows = await db.select(
      `SELECT id
       FROM saved_system_configs
       WHERE system_code = $1 AND title = $2
       ORDER BY id DESC
       LIMIT 1`,
      [systemCode, title]
    )

    return this.loadSystemConfig(rows[0]?.id)
  }

  async loadSystemConfig(id) {
    const db = await getDb()

    const rows = await db.select(
      'SELECT * FROM saved_system_configs WHERE id = $1 LIMIT 1',
      [id]
    )

    if (!rows.length) {
      return null
    }

    const row = rows[0]

    return {
      ...row,
      params: tryParseJson(row.params_json, {}),
      features: tryParseJson(row.features_json, {})
    }
  }

  async listSavedSystemConfigs() {
    const db = await getDb()

    const rows = await db.select(`
      SELECT *
      FROM saved_system_configs
      ORDER BY id DESC
    `)

    return rows.map((row) => ({
      ...row,
      params: tryParseJson(row.params_json, {}),
      features: tryParseJson(row.features_json, {})
    }))
  }
}