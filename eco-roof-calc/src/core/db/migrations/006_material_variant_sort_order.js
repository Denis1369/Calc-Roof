export const migration006MaterialVariantSortOrder = {
  version: '006_material_variant_sort_order',

  async up(db) {
    const variantColumns = await db.select('PRAGMA table_info(material_variants)')
    const hasSortOrder = variantColumns.some((col) => col.name === 'sort_order')

    if (!hasSortOrder) {
      await db.execute(`
        ALTER TABLE material_variants
        ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0
      `)
    }
  }
}
