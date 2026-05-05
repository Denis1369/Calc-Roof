import { getDb } from '../db/client'
import { normalizeKey, normalizeText } from '@/core/utils/normalizeKey'
import { safeNumber, safeNullableNumber } from '@/core/utils/safeNumber'

function groupBy(items, keyGetter) {
  const map = new Map()

  for (const item of items) {
    const key = keyGetter(item)
    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key).push(item)
  }

  return map
}

let materialVariantColumnsPromise = null

async function getMaterialVariantColumns(db) {
  if (!materialVariantColumnsPromise) {
    materialVariantColumnsPromise = db.select('PRAGMA table_info(material_variants)').catch(() => [])
  }

  return materialVariantColumnsPromise
}

async function hasMaterialVariantSortOrder(db) {
  const columns = await getMaterialVariantColumns(db)
  return columns.some((column) => column.name === 'sort_order')
}

function buildMaterialVariantOrderClause({ includeMaterialId = false, hasSortOrder = false } = {}) {
  const parts = []

  if (includeMaterialId) {
    parts.push('material_id')
  }

  parts.push('is_default DESC')

  if (hasSortOrder) {
    parts.push('sort_order')
  }

  parts.push('variant_label', 'id')
  return parts.join(', ')
}

export class CatalogRepository {
  async listMaterials({ includeInactive = false } = {}) {
    const db = await getDb()
    const whereClause = includeInactive ? '' : 'WHERE is_active = 1'
    const hasSortOrder = await hasMaterialVariantSortOrder(db)

    const materials = await db.select(`
      SELECT *
      FROM materials
      ${whereClause}
      ORDER BY category, subcategory, base_name, id
    `)

    const variants = await db.select(`
      SELECT *
      FROM material_variants
      ${includeInactive ? '' : 'WHERE is_active = 1'}
      ORDER BY ${buildMaterialVariantOrderClause({ includeMaterialId: true, hasSortOrder })}
    `)

    const variantsByMaterialId = groupBy(variants, (row) => row.material_id)

    return materials.map((material) => ({
      ...material,
      variants: variantsByMaterialId.get(material.id) || []
    }))
  }

  async getMaterialById(id) {
    const db = await getDb()
    const hasSortOrder = await hasMaterialVariantSortOrder(db)

    const rows = await db.select(
      'SELECT * FROM materials WHERE id = $1 LIMIT 1',
      [id]
    )

    if (!rows.length) {
      return null
    }

    const variants = await db.select(
      `SELECT * FROM material_variants WHERE material_id = $1 ORDER BY ${buildMaterialVariantOrderClause({ hasSortOrder })}`,
      [id]
    )

    return {
      ...rows[0],
      variants
    }
  }

  async saveMaterial(input) {
    const db = await getDb()

    const baseName = normalizeText(input.base_name || input.display_name)
    const displayName = normalizeText(input.display_name || input.base_name)
    const key = normalizeKey(baseName)

    if (!baseName || !displayName) {
      throw new Error('Material base_name/display_name is required')
    }

    let materialId = input.id || null

    if (materialId) {
      await db.execute(
        `UPDATE materials SET
          normalize_key = $1,
          category = $2,
          subcategory = $3,
          base_name = $4,
          display_name = $5,
          brand = $6,
          model = $7,
          material_type = $8,
          unit = $9,
          base_price = $10,
          source_url = $11,
          notes = $12,
          is_active = $13,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $14`,
        [
          key,
          normalizeText(input.category),
          normalizeText(input.subcategory),
          baseName,
          displayName,
          normalizeText(input.brand),
          normalizeText(input.model),
          normalizeText(input.material_type),
          normalizeText(input.unit),
          safeNumber(input.base_price, 0),
          normalizeText(input.source_url),
          normalizeText(input.notes),
          Number(input.is_active ?? 1),
          materialId
        ]
      )
    } else {
      await db.execute(
        `INSERT INTO materials (
          normalize_key,
          category,
          subcategory,
          base_name,
          display_name,
          brand,
          model,
          material_type,
          unit,
          base_price,
          source_url,
          notes,
          is_active
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          key,
          normalizeText(input.category),
          normalizeText(input.subcategory),
          baseName,
          displayName,
          normalizeText(input.brand),
          normalizeText(input.model),
          normalizeText(input.material_type),
          normalizeText(input.unit),
          safeNumber(input.base_price, 0),
          normalizeText(input.source_url),
          normalizeText(input.notes),
          Number(input.is_active ?? 1)
        ]
      )

      const createdRows = await db.select(
        'SELECT id FROM materials WHERE normalize_key = $1 LIMIT 1',
        [key]
      )
      materialId = createdRows[0]?.id
    }

    if (!materialId) {
      throw new Error('Failed to resolve material id after save')
    }

    if (Array.isArray(input.variants)) {
      await db.execute(
        'DELETE FROM material_variants WHERE material_id = $1',
        [materialId]
      )

      for (const variant of input.variants) {
        const variantLabel = normalizeText(variant.variant_label)
        if (!variantLabel) {
          continue
        }

        await db.execute(
          `INSERT INTO material_variants (
            material_id,
            normalize_key,
            variant_type,
            variant_label,
            sku,
            thickness_mm,
            width_mm,
            height_mm,
            density,
            profile_name,
            price,
            source_url,
            extra_json,
            is_default,
            is_active
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            materialId,
            normalizeKey(variant.variant_label),
            normalizeText(variant.variant_type, 'option'),
            variantLabel,
            normalizeText(variant.sku),
            safeNullableNumber(variant.thickness_mm),
            safeNullableNumber(variant.width_mm),
            safeNullableNumber(variant.height_mm),
            safeNullableNumber(variant.density),
            normalizeText(variant.profile_name),
            safeNumber(variant.price, 0),
            normalizeText(variant.source_url),
            JSON.stringify(variant.extra_json || variant.extra || {}),
            Number(variant.is_default ?? 0),
            Number(variant.is_active ?? 1)
          ]
        )
      }
    }

    return this.getMaterialById(materialId)
  }

  async deleteMaterial(id) {
    const db = await getDb()
    await db.execute('DELETE FROM materials WHERE id = $1', [id])
  }

  async listWorks({ includeInactive = false } = {}) {
    const db = await getDb()
    const whereClause = includeInactive ? '' : 'WHERE is_active = 1'

    const works = await db.select(`
      SELECT *
      FROM works
      ${whereClause}
      ORDER BY category, name, id
    `)

    const tiers = await db.select(`
      SELECT *
      FROM work_price_tiers
      ORDER BY work_id, area_from, id
    `)

    const tiersByWorkId = groupBy(tiers, (row) => row.work_id)

    return works.map((work) => ({
      ...work,
      price_tiers: tiersByWorkId.get(work.id) || []
    }))
  }

  async getWorkById(id) {
    const db = await getDb()

    const rows = await db.select(
      'SELECT * FROM works WHERE id = $1 LIMIT 1',
      [id]
    )

    if (!rows.length) {
      return null
    }

    const priceTiers = await db.select(
      'SELECT * FROM work_price_tiers WHERE work_id = $1 ORDER BY area_from, id',
      [id]
    )

    return {
      ...rows[0],
      price_tiers: priceTiers
    }
  }

  async saveWork(input) {
    const db = await getDb()

    const name = normalizeText(input.name)
    const key = normalizeKey(name)

    if (!name) {
      throw new Error('Work name is required')
    }

    let workId = input.id || null

    if (workId) {
      await db.execute(
        `UPDATE works SET
          normalize_key = $1,
          category = $2,
          name = $3,
          unit = $4,
          notes = $5,
          is_active = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $7`,
        [
          key,
          normalizeText(input.category),
          name,
          normalizeText(input.unit),
          normalizeText(input.notes),
          Number(input.is_active ?? 1),
          workId
        ]
      )
    } else {
      await db.execute(
        `INSERT INTO works (
          normalize_key,
          category,
          name,
          unit,
          notes,
          is_active
        ) VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          key,
          normalizeText(input.category),
          name,
          normalizeText(input.unit),
          normalizeText(input.notes),
          Number(input.is_active ?? 1)
        ]
      )

      const createdRows = await db.select(
        'SELECT id FROM works WHERE normalize_key = $1 LIMIT 1',
        [key]
      )
      workId = createdRows[0]?.id
    }

    if (!workId) {
      throw new Error('Failed to resolve work id after save')
    }

    if (Array.isArray(input.price_tiers)) {
      await db.execute(
        'DELETE FROM work_price_tiers WHERE work_id = $1',
        [workId]
      )

      for (const tier of input.price_tiers) {
        await db.execute(
          `INSERT INTO work_price_tiers (
            work_id,
            area_from,
            area_to,
            price
          ) VALUES ($1,$2,$3,$4)`,
          [
            workId,
            safeNumber(tier.area_from, 0),
            tier.area_to === null ? null : safeNullableNumber(tier.area_to),
            safeNumber(tier.price, 0)
          ]
        )
      }
    }

    return this.getWorkById(workId)
  }

  async deleteWork(id) {
    const db = await getDb()
    await db.execute('DELETE FROM works WHERE id = $1', [id])
  }

  async listCoefficients() {
    const db = await getDb()

    return db.select(`
      SELECT *
      FROM coefficients
      ORDER BY group_name, name, id
    `)
  }

  async listFormulas() {
    const db = await getDb()

    return db.select(`
      SELECT *
      FROM formulas
      ORDER BY name, code, id
    `)
  }
}
