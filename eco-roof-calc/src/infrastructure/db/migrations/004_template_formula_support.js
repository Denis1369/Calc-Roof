export const migration004TemplateFormulaSupport = {
  version: '004_template_formula_support',
  async up(db) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    const materialOptionColumns = await db.select(`PRAGMA table_info(system_layer_material_options)`)
    const workLinkColumns = await db.select(`PRAGMA table_info(system_layer_work_links)`)

    const hasMaterialExpression = materialOptionColumns.some((col) => col.name === 'default_expression')
    const hasMaterialStableCode = materialOptionColumns.some((col) => col.name === 'stable_code')
    const hasWorkStableCode = workLinkColumns.some((col) => col.name === 'stable_code')

    if (!hasMaterialExpression) {
      await db.execute(`
        ALTER TABLE system_layer_material_options
        ADD COLUMN default_expression TEXT NOT NULL DEFAULT ''
      `)
    }

    if (!hasMaterialStableCode) {
      await db.execute(`
        ALTER TABLE system_layer_material_options
        ADD COLUMN stable_code TEXT NOT NULL DEFAULT ''
      `)
    }

    if (!hasWorkStableCode) {
      await db.execute(`
        ALTER TABLE system_layer_work_links
        ADD COLUMN stable_code TEXT NOT NULL DEFAULT ''
      `)
    }
  }
}
