export function toSystemListItem(system) {
  return {
    идентификатор: system.id,
    код: system.code,
    название: system.name,
    тип_основания: system.roof_base || '',
    тип_гидроизоляции: system.waterproofing_type || '',
    семейство_утеплителя: system.insulation_family || '',
    source_url: system.source_url || '',
    notes: system.notes || '',
    raw: system
  }
}

export function toSystemTemplateView(fullSystem) {
  if (!fullSystem) {
    return null
  }

  return {
    идентификатор: fullSystem.id,
    код: fullSystem.code,
    название: fullSystem.name,
    тип_основания: fullSystem.roof_base || '',
    тип_гидроизоляции: fullSystem.waterproofing_type || '',
    семейство_утеплителя: fullSystem.insulation_family || '',
    параметры: fullSystem.params || [],
    опции: fullSystem.features || [],
    слои: fullSystem.layers || [],
    raw: fullSystem
  }
}