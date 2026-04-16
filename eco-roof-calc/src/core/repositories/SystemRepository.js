import { normalizeKey, normalizeText } from '@/core/utils/normalizeKey'
import { getDb } from '../db/client'

function tryParseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function buildCustomSystemCode(name) {
  const base = normalizeKey(name).replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'custom_system'
  return `custom_${base}`
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

    const overrideRows = await db.select(
      'SELECT * FROM system_default_overrides WHERE system_code = $1 LIMIT 1',
      [system.code]
    )

    const overrideRow = overrideRows[0] || null

    return {
      ...system,
      params: params.map((param) => ({
        ...param,
        options: tryParseJson(param.options_json, [])
      })),
      features,
      layers: hydratedLayers,
      default_override: overrideRow ? tryParseJson(overrideRow.payload_json, null) : null
    }
  }


  async loadSystemDefaultOverride(systemCode) {
    const db = await getDb()
    const rows = await db.select(
      'SELECT * FROM system_default_overrides WHERE system_code = $1 LIMIT 1',
      [systemCode]
    )

    if (!rows.length) return null

    const row = rows[0]
    return {
      ...row,
      payload: tryParseJson(row.payload_json, {})
    }
  }

  async listSystemDefaultOverrides() {
    const db = await getDb()
    const rows = await db.select('SELECT * FROM system_default_overrides ORDER BY system_code')
    return rows.map((row) => ({
      ...row,
      payload: tryParseJson(row.payload_json, {})
    }))
  }

  async saveSystemDefaultOverride({ systemCode, title = '', payload = {} }) {
    const db = await getDb()
    const existing = await this.loadSystemDefaultOverride(systemCode)

    if (existing?.id) {
      await db.execute(
        `UPDATE system_default_overrides
         SET title = $1,
             payload_json = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE system_code = $3`,
        [title, JSON.stringify(payload), systemCode]
      )
    } else {
      await db.execute(
        `INSERT INTO system_default_overrides (system_code, title, payload_json)
         VALUES ($1, $2, $3)`,
        [systemCode, title, JSON.stringify(payload)]
      )
    }

    return this.loadSystemDefaultOverride(systemCode)
  }

  async deleteSystemDefaultOverride(systemCode) {
    const db = await getDb()
    await db.execute('DELETE FROM system_default_overrides WHERE system_code = $1', [systemCode])
  }

  async getNextAvailableSystemCode(desiredName) {
    const db = await getDb()
    const baseCode = buildCustomSystemCode(desiredName)
    let candidate = baseCode
    let index = 2

    while (true) {
      const rows = await db.select('SELECT id FROM systems WHERE code = $1 LIMIT 1', [candidate])
      if (!rows.length) {
        return candidate
      }
      candidate = `${baseCode}_${index}`
      index += 1
    }
  }

  async createCustomSystemFromExisting({
    sourceSystemCode,
    newName,
    overridePayload = null
  }) {
    const db = await getDb()
    const source = await this.getFullSystemByCode(sourceSystemCode)

    if (!source) {
      throw new Error('Source system not found')
    }

    const name = normalizeText(newName || `${source.name || source.code} (копия)`)
    if (!name) {
      throw new Error('System name is required')
    }

    const newCode = await this.getNextAvailableSystemCode(name)
    const maxSortRows = await db.select('SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM systems')
    const nextSortOrder = Number(maxSortRows[0]?.max_sort || 0) + 10

    await db.execute(
      `INSERT INTO systems (
        code,
        name,
        roof_base,
        waterproofing_type,
        insulation_family,
        sort_order,
        source_url,
        notes,
        is_active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        newCode,
        name,
        source.roof_base || '',
        source.waterproofing_type || '',
        source.insulation_family || '',
        nextSortOrder,
        source.source_url || '',
        normalizeText(`Пользовательская система. Источник: ${source.name || source.code}`),
        1
      ]
    )

    const createdRows = await db.select('SELECT * FROM systems WHERE code = $1 LIMIT 1', [newCode])
    const createdSystem = createdRows[0]

    if (!createdSystem?.id) {
      throw new Error('Failed to create custom system')
    }

    for (const param of source.params || []) {
      await db.execute(
        `INSERT INTO system_params (
          system_id,
          code,
          name,
          param_type,
          unit,
          default_value,
          options_json,
          description,
          sort_order
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          createdSystem.id,
          param.code,
          param.name,
          param.param_type || 'text',
          param.unit || '',
          param.default_value ?? '',
          JSON.stringify(param.options || []),
          param.description || '',
          Number(param.sort_order || 0)
        ]
      )
    }

    for (const feature of source.features || []) {
      await db.execute(
        `INSERT INTO system_features (
          system_id,
          code,
          name,
          is_default,
          sort_order
        ) VALUES ($1,$2,$3,$4,$5)`,
        [
          createdSystem.id,
          feature.code,
          feature.name,
          Number(feature.is_default || 0),
          Number(feature.sort_order || 0)
        ]
      )
    }

    const layerIdMap = new Map()

    for (const layer of source.layers || []) {
      await db.execute(
        `INSERT INTO system_layers (
          system_id,
          code,
          name,
          layer_kind,
          is_optional,
          feature_code,
          sort_order
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          createdSystem.id,
          layer.code,
          layer.name,
          layer.layer_kind || '',
          Number(layer.is_optional || 0),
          layer.feature_code || null,
          Number(layer.sort_order || 0)
        ]
      )

      const createdLayerRows = await db.select(
        'SELECT id FROM system_layers WHERE system_id = $1 AND code = $2 LIMIT 1',
        [createdSystem.id, layer.code]
      )
      const createdLayerId = createdLayerRows[0]?.id
      if (!createdLayerId) {
        continue
      }
      layerIdMap.set(layer.id, createdLayerId)

      for (const option of layer.material_options || []) {
        await db.execute(
          `INSERT INTO system_layer_material_options (
            layer_id,
            material_id,
            role,
            is_default,
            sort_order,
            notes
          ) VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            createdLayerId,
            option.material_id,
            option.role || 'default',
            Number(option.is_default || 0),
            Number(option.sort_order || 0),
            option.notes || ''
          ]
        )
      }

      for (const link of layer.work_links || []) {
        await db.execute(
          `INSERT INTO system_layer_work_links (
            layer_id,
            work_id,
            formula_code,
            default_expression,
            sort_order,
            notes
          ) VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            createdLayerId,
            link.work_id,
            link.formula_code || null,
            link.default_expression || '',
            Number(link.sort_order || 0),
            link.notes || ''
          ]
        )
      }
    }

    if (overridePayload) {
      await this.saveSystemDefaultOverride({
        systemCode: newCode,
        title: name,
        payload: overridePayload
      })
    }

    return this.getFullSystemByCode(newCode)
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


  async deleteSystemConfig(id) {
    const db = await getDb()
    await db.execute('DELETE FROM saved_system_configs WHERE id = $1', [id])
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