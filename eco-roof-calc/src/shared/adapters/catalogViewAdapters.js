function getTierPrice(priceTiers, areaFrom, areaTo) {
  const tier = priceTiers.find(
    (item) =>
      Number(item.area_from) === areaFrom &&
      ((item.area_to === null && areaTo === null) ||
        Number(item.area_to) === areaTo)
  )

  return Number(tier?.price ?? 0)
}

export function toLegacyMaterialRow(material) {
  return {
    идентификатор: material.id,
    главная_категория: material.category || '',
    подкатегория: material.subcategory || '',
    артикул_товара: '',
    полное_наименование_материала: material.display_name || '',
    единица_измерения: material.unit || '',
    базовая_цена: Number(material.base_price ?? 0),
    ссылка: material.source_url || '',
    бренд: material.brand || '',
    модель: material.model || '',
    тип_материала: material.material_type || '',
    базовое_наименование: material.base_name || '',
    избранное: 0,
    variants: material.variants || [],
    raw: material
  }
}

export function toLegacyWorkRow(work) {
  const priceTiers = work.price_tiers || []

  return {
    идентификатор: work.id,
    категория_работы: work.category || '',
    наименование_работы: work.name || '',
    единица_измерения_работы: work.unit || '',
    цена_0_300: getTierPrice(priceTiers, 0, 300),
    цена_300_600: getTierPrice(priceTiers, 300, 600),
    цена_600_1000: getTierPrice(priceTiers, 600, 1000),
    цена_1000_3000: getTierPrice(priceTiers, 1000, 3000),
    цена_3000_6000: getTierPrice(priceTiers, 3000, 6000),
    цена_6000_15000: getTierPrice(priceTiers, 6000, 15000),
    цена_15000_30000: getTierPrice(priceTiers, 15000, 30000),
    цена_более_30000: getTierPrice(priceTiers, 30000, null),
    raw: work
  }
}