import { ref, computed } from 'vue'
import { getCatalogData } from '@/core/services/dataApi'
import { saveMaterial as saveMaterialAction } from '@/core/services/dataApi'
import { deleteMaterial as deleteMaterialAction } from '@/core/services/dataApi'
import { saveWork as saveWorkAction } from '@/core/services/dataApi'
import { deleteWork as deleteWorkAction } from '@/core/services/dataApi'
import {
  toLegacyMaterialRow,
  toLegacyWorkRow
} from '@/core/adapters/viewAdapters'
import { saveBinaryFile, XLSX_MIME } from '@/core/utils/binaryFileExport'

const FAV_MATERIALS_KEY = 'eco_roof_fav_materials'
const FAV_WORKS_KEY = 'eco_roof_fav_works'
const ARTICLE_PREFIX = 'ARTICLE:'

const expandedMaterials = ref({})
const newVariantDrafts = ref({})

function loadIds(key) {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : []
  } catch {
    return []
  }
}

function toggleMaterialVariants(materialId) {
  expandedMaterials.value = {
    ...expandedMaterials.value,
    [materialId]: !expandedMaterials.value[materialId]
  }
}

function ensureVariantDraft(materialId) {
  if (!newVariantDrafts.value[materialId]) {
    newVariantDrafts.value[materialId] = {
      variant_label: '',
      sku: '',
      thickness_mm: null,
      width_mm: null,
      height_mm: null,
      density: null,
      profile_name: '',
      price: 0,
      variant_type: 'option',
      is_default: 0,
      is_active: 1,
      extra_json: {}
    }
  }

  return newVariantDrafts.value[materialId]
}

async function addVariant(materialRow) {
  loading.value = true
  error.value = ''

  try {
    const draft = ensureVariantDraft(materialRow.идентификатор)

    const payload = materialRowToPayload(materialRow)
    payload.variants = [
      ...(payload.variants || []),
      {
        ...draft,
        price: Number(draft.price || 0)
      }
    ]

    await saveMaterialAction(payload)

    newVariantDrafts.value[materialRow.идентификатор] = {
      variant_label: '',
      sku: '',
      thickness_mm: null,
      width_mm: null,
      height_mm: null,
      density: null,
      profile_name: '',
      price: 0,
      variant_type: 'option',
      is_default: 0,
      is_active: 1,
      extra_json: {}
    }

    await loadData()
  } catch (err) {
    console.error(err)
    error.value = err?.message || 'Не удалось добавить вариант'
    throw err
  } finally {
    loading.value = false
  }
}

async function updateVariant(materialRow, variantRow) {
  loading.value = true
  error.value = ''

  try {
    const payload = materialRowToPayload(materialRow)
    payload.variants = (payload.variants || []).map((item) =>
      Number(item.id) === Number(variantRow.id)
        ? {
            ...item,
            variant_label: variantRow.variant_label || '',
            sku: variantRow.sku || '',
            thickness_mm: variantRow.thickness_mm ?? null,
            width_mm: variantRow.width_mm ?? null,
            height_mm: variantRow.height_mm ?? null,
            density: variantRow.density ?? null,
            profile_name: variantRow.profile_name || '',
            price: Number(variantRow.price || 0),
            is_default: Number(variantRow.is_default ?? 0),
            is_active: Number(variantRow.is_active ?? 1)
          }
        : item
    )

    await saveMaterialAction(payload)
    await loadData()
  } catch (err) {
    console.error(err)
    error.value = err?.message || 'Не удалось обновить вариант'
    throw err
  } finally {
    loading.value = false
  }
}

async function deleteVariant(materialRow, variantId) {
  loading.value = true
  error.value = ''

  try {
    const payload = materialRowToPayload(materialRow)
    payload.variants = (payload.variants || []).filter(
      (item) => Number(item.id) !== Number(variantId)
    )

    await saveMaterialAction(payload)
    await loadData()
  } catch (err) {
    console.error(err)
    error.value = err?.message || 'Не удалось удалить вариант'
    throw err
  } finally {
    loading.value = false
  }
}

function saveIds(key, ids) {
  localStorage.setItem(key, JSON.stringify(ids))
}

function defaultMaterialForm() {
  return {
    подкатегория: '',
    артикул_товара: '',
    единица_измерения: 'м2',
    базовая_цена: 0,
    базовое_наименование: '',

    вариант: '',
    толщина_мм: null,
    ширина_мм: null,
    высота_мм: null,
    плотность: null,
    профиль: ''
  }
}

function defaultWorkForm() {
  return {
    категория_работы: '',
    наименование_работы: '',
    единица_измерения_работы: 'м2',
    цена_0_300: 0,
    цена_300_600: 0,
    цена_600_1000: 0,
    цена_1000_3000: 0,
    цена_3000_6000: 0,
    цена_6000_15000: 0,
    цена_15000_30000: 0,
    цена_более_30000: 0
  }
}

function buildInitialVariantFromForm(form) {
  const hasAnyVariantField =
    `${form.артикул_товара || ''}`.trim() ||
    `${form.вариант || ''}`.trim() ||
    form.толщина_мм !== null ||
    form.ширина_мм !== null ||
    form.высота_мм !== null ||
    form.плотность !== null ||
    `${form.профиль || ''}`.trim()

  if (!hasAnyVariantField) {
    return null
  }

  return {
    variant_label:
      `${form.вариант || ''}`.trim() ||
      `${form.базовое_наименование || ''}`.trim() ||
      `${form.полное_наименование_материала || ''}`.trim(),
    sku: `${form.артикул_товара || ''}`.trim(),
    thickness_mm: form.толщина_мм ?? null,
    width_mm: form.ширина_мм ?? null,
    height_mm: form.высота_мм ?? null,
    density: form.плотность ?? null,
    profile_name: `${form.профиль || ''}`.trim(),
    price: Number(form.базовая_цена || 0),
    variant_type: 'option',
    is_default: 1,
    is_active: 1,
    extra_json: {}
  }
}

function getNewMaterialName(form) {
  return `${form.базовое_наименование || ''}`.trim()
}

function normalizeSearch(value) {
  return `${value || ''}`.toLowerCase().trim()
}

function extractArticleFromNotes(notes = '') {
  const lines = `${notes || ''}`.split('\n')
  const articleLine = lines.find((line) => line.startsWith(ARTICLE_PREFIX))
  return articleLine ? articleLine.slice(ARTICLE_PREFIX.length).trim() : ''
}

function stripArticleFromNotes(notes = '') {
  return `${notes || ''}`
    .split('\n')
    .filter((line) => !line.startsWith(ARTICLE_PREFIX))
    .join('\n')
    .trim()
}

function mergeArticleIntoNotes(existingNotes = '', article = '') {
  const cleanNotes = stripArticleFromNotes(existingNotes)
  const cleanArticle = `${article || ''}`.trim()

  return [cleanArticle ? `${ARTICLE_PREFIX}${cleanArticle}` : '', cleanNotes]
    .filter(Boolean)
    .join('\n')
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл'))
    reader.readAsArrayBuffer(file)
  })
}

function cellToText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if (value.text) return `${value.text}`
    if (value.richText) return value.richText.map((part) => part?.text || '').join('')
    if (value.result !== undefined) return `${value.result}`
    if (value.formula) return `${value.result ?? ''}`
  }

  return `${value}`.trim()
}

function cellToNumber(value) {
  const normalized = cellToText(value)
    .replace(/\s+/g, '')
    .replace(',', '.')
  const number = Number(normalized)
  return Number.isFinite(number) ? number : 0
}

function normalizeHeader(value) {
  return cellToText(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, '')
}

function getHeaderMap(headerRow) {
  const map = {}
  headerRow.eachCell((cell, colNumber) => {
    map[normalizeHeader(cell.value)] = colNumber
  })
  return map
}

function getCellByHeader(row, headerMap, aliases) {
  for (const alias of aliases) {
    const index = headerMap[normalizeHeader(alias)]
    if (index) return row.getCell(index).value
  }

  return ''
}

function buildPriceTiersFromLegacyWork(work) {
  return [
    { area_from: 0, area_to: 300, price: Number(work.цена_0_300 || 0) },
    { area_from: 300, area_to: 600, price: Number(work.цена_300_600 || 0) },
    { area_from: 600, area_to: 1000, price: Number(work.цена_600_1000 || 0) },
    { area_from: 1000, area_to: 3000, price: Number(work.цена_1000_3000 || 0) },
    { area_from: 3000, area_to: 6000, price: Number(work.цена_3000_6000 || 0) },
    { area_from: 6000, area_to: 15000, price: Number(work.цена_6000_15000 || 0) },
    { area_from: 15000, area_to: 30000, price: Number(work.цена_15000_30000 || 0) },
    { area_from: 30000, area_to: null, price: Number(work.цена_более_30000 || 0) }
  ]
}

function materialRowToPayload(materialRow) {
  const raw = materialRow.raw || {}
  const existingVariants = Array.isArray(materialRow.variants)
    ? materialRow.variants
    : Array.isArray(raw.variants)
      ? raw.variants
      : []

  return {
    id: materialRow.идентификатор || null,
    category: materialRow.главная_категория || '',
    subcategory: materialRow.подкатегория || '',
    base_name:
      materialRow.базовое_наименование ||
      raw.base_name ||
      materialRow.полное_наименование_материала ||
      '',
    display_name: materialRow.полное_наименование_материала || '',
    brand: materialRow.бренд || raw.brand || '',
    model: materialRow.модель || raw.model || '',
    material_type: materialRow.тип_материала || raw.material_type || '',
    unit: materialRow.единица_измерения || '',
    base_price: Number(materialRow.базовая_цена || 0),
    source_url: materialRow.ссылка || '',
    notes: stripArticleFromNotes(raw.notes || ''),
    variants: existingVariants.map((variant) => ({
      id: variant.id || null,
      variant_label: variant.variant_label || '',
      sku: variant.sku || '',
      thickness_mm: variant.thickness_mm ?? null,
      width_mm: variant.width_mm ?? null,
      height_mm: variant.height_mm ?? null,
      density: variant.density ?? null,
      profile_name: variant.profile_name || '',
      price: Number(variant.price || 0),
      variant_type: variant.variant_type || 'option',
      is_default: Number(variant.is_default ?? 0),
      is_active: Number(variant.is_active ?? 1),
      extra_json: variant.extra_json || {}
    }))
  }
}

function workRowToPayload(workRow) {
  const raw = workRow.raw || {}

  return {
    id: workRow.идентификатор || null,
    category: workRow.категория_работы || '',
    name: workRow.наименование_работы || '',
    unit: workRow.единица_измерения_работы || '',
    notes: raw.notes || '',
    price_tiers: buildPriceTiersFromLegacyWork(workRow)
  }
}

function enrichMaterialRows(materials, favoriteIds) {
  return materials.map((material) => {
    const row = toLegacyMaterialRow(material)

    row.варианты = Array.isArray(material.variants) ? material.variants : []
    row.количество_вариантов = row.варианты.length
    row.избранное = favoriteIds.includes(Number(row.идентификатор)) ? 1 : 0

    return row
  })
}

function enrichWorkRows(works, favoriteIds) {
  return works.map((work) => {
    const row = toLegacyWorkRow(work)
    row.избранное = favoriteIds.includes(Number(row.идентификатор)) ? 1 : 0
    return row
  })
}

export function useDirectories() {
  const loading = ref(false)
  const error = ref('')

  const materials = ref([])
  const works = ref([])
  const coefficients = ref([])
  const formulas = ref([])

  const materialsDb = ref([])
  const worksDb = ref([])
  const coefficientsDb = ref([])
  const formulasDb = ref([])

  const newMaterial = ref(defaultMaterialForm())
  const newWork = ref(defaultWorkForm())

  const searchMaterial = ref('')
  const searchWork = ref('')

  const onlyFavMaterials = ref(false)
  const onlyFavWorks = ref(false)

  const favoriteMaterialIds = ref(loadIds(FAV_MATERIALS_KEY))
  const favoriteWorkIds = ref(loadIds(FAV_WORKS_KEY))

  const collapsedGroups = ref({})
  const collapsedMatMain = ref({})
  const collapsedMatSub = ref({})

  const uniqueCategories = computed(() => {
    return [...new Set(
      worksDb.value
        .map((item) => `${item.категория_работы || ''}`.trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'ru'))
  })

  const groupedMaterials = computed(() => {
    const search = normalizeSearch(searchMaterial.value)
    const result = {}

    const filtered = materialsDb.value.filter((item) => {
      if (onlyFavMaterials.value && !item.избранное) {
        return false
      }

      if (!search) {
        return true
      }

      return [
        item.главная_категория,
        item.подкатегория,
        item.артикул_товара,
        item.полное_наименование_материала
      ]
        .join(' ')
        .toLowerCase()
        .includes(search)
    })

    for (const item of filtered) {
      const main = item.главная_категория || 'Без категории'
      const sub = item.подкатегория || 'Без подкатегории'

      if (!result[main]) {
        result[main] = {}
      }

      if (!result[main][sub]) {
        result[main][sub] = []
      }

      result[main][sub].push(item)
    }

    return result
  })

  const groupedWorks = computed(() => {
    const search = normalizeSearch(searchWork.value)
    const result = {}

    const filtered = worksDb.value.filter((item) => {
      if (onlyFavWorks.value && !item.избранное) {
        return false
      }

      if (!search) {
        return true
      }

      return [
        item.категория_работы,
        item.наименование_работы
      ]
        .join(' ')
        .toLowerCase()
        .includes(search)
    })

    for (const item of filtered) {
      const category = item.категория_работы || 'Без категории'

      if (!result[category]) {
        result[category] = []
      }

      result[category].push(item)
    }

    return result
  })

  async function loadData() {
    loading.value = true
    error.value = ''

    try {
      const data = await getCatalogData()

      materials.value = data.materials
      works.value = data.works
      coefficients.value = data.coefficients
      formulas.value = data.formulas

      materialsDb.value = enrichMaterialRows(
        data.materials,
        favoriteMaterialIds.value
      )

      worksDb.value = enrichWorkRows(
        data.works,
        favoriteWorkIds.value
      )

      coefficientsDb.value = data.coefficients
      formulasDb.value = data.formulas
    } catch (err) {
      console.error(err)
      error.value = err?.message || 'Не удалось загрузить справочники'
    } finally {
      loading.value = false
    }
  }

  async function addMaterial() {
    loading.value = true
    error.value = ''

    try {
      const initialVariant = buildInitialVariantFromForm(newMaterial.value)
      const materialName = getNewMaterialName(newMaterial.value)
      const subcategory = `${newMaterial.value.подкатегория || ''}`.trim()

      await saveMaterialAction({
        category: subcategory,
        subcategory,
        base_name: materialName,
        display_name: materialName,
        brand: '',
        model: '',
        material_type: '',
        unit: newMaterial.value.единица_измерения || '',
        base_price: Number(newMaterial.value.базовая_цена || 0),
        source_url: '',
        notes: '',
        variants: initialVariant ? [initialVariant] : []
      })

      newMaterial.value = defaultMaterialForm()
      await loadData()
    } catch (err) {
      console.error(err)
      error.value = err?.message || 'Не удалось добавить материал'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateMaterial(materialRow) {
    loading.value = true
    error.value = ''

    try {
      await saveMaterialAction(materialRowToPayload(materialRow))
      await loadData()
    } catch (err) {
      console.error(err)
      error.value = err?.message || 'Не удалось обновить материал'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function exportMaterialsXlsx() {
    loading.value = true
    error.value = ''

    try {
      const ExcelJS = (await import('exceljs')).default
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Материалы')

      worksheet.columns = [
        { header: 'Подкатегория', key: 'subcategory', width: 28 },
        { header: 'Наименование', key: 'name', width: 58 },
        { header: 'Ед. изм.', key: 'unit', width: 12 },
        { header: 'Базовая цена', key: 'basePrice', width: 16 },
        { header: 'Вариант', key: 'variant', width: 30 },
        { header: 'Артикул', key: 'sku', width: 22 },
        { header: 'Толщина, мм', key: 'thickness', width: 14 },
        { header: 'Ширина, мм', key: 'width', width: 14 },
        { header: 'Высота, мм', key: 'height', width: 14 },
        { header: 'Плотность', key: 'density', width: 14 },
        { header: 'Профиль', key: 'profile', width: 24 },
        { header: 'Цена варианта', key: 'variantPrice', width: 16 }
      ]

      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

      for (const material of materialsDb.value || []) {
        const variants = Array.isArray(material.варианты) && material.варианты.length
          ? material.варианты
          : [null]

        for (const variant of variants) {
          worksheet.addRow({
            subcategory: material.подкатегория || '',
            name: material.полное_наименование_материала || material.базовое_наименование || '',
            unit: material.единица_измерения || '',
            basePrice: Number(material.базовая_цена || 0),
            variant: variant?.variant_label || '',
            sku: variant?.sku || '',
            thickness: variant?.thickness_mm ?? '',
            width: variant?.width_mm ?? '',
            height: variant?.height_mm ?? '',
            density: variant?.density ?? '',
            profile: variant?.profile_name || '',
            variantPrice: variant ? Number(variant.price || 0) : ''
          })
        }
      }

      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle', wrapText: true }
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      return saveBinaryFile({
        bytes: buffer,
        fileName: 'Справочник материалов.xlsx',
        mimeType: XLSX_MIME
      })
    } catch (err) {
      console.error(err)
      error.value = err?.message || 'Не удалось выгрузить материалы в XLSX'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function importMaterialsXlsx(file) {
    if (!file) return 0

    loading.value = true
    error.value = ''

    try {
      const ExcelJS = (await import('exceljs')).default
      const workbook = new ExcelJS.Workbook()
      const buffer = await readFileAsArrayBuffer(file)
      await workbook.xlsx.load(buffer)

      const worksheet = workbook.worksheets[0]
      if (!worksheet) {
        throw new Error('В XLSX не найден лист с материалами')
      }

      const headerMap = getHeaderMap(worksheet.getRow(1))
      const groups = new Map()

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return

        const name = cellToText(getCellByHeader(row, headerMap, ['Наименование', 'Название']))
        if (!name) return

        const subcategory = cellToText(getCellByHeader(row, headerMap, ['Подкатегория', 'Категория']))
        const key = `${normalizeSearch(subcategory)}|${normalizeSearch(name)}`

        if (!groups.has(key)) {
          const basePriceCell = getCellByHeader(row, headerMap, ['Базовая цена', 'Баз. цена'])
          const basePriceText = cellToText(basePriceCell)

          groups.set(key, {
            subcategory,
            name,
            unit: cellToText(getCellByHeader(row, headerMap, ['Ед. изм.', 'Ед', 'Единица'])),
            basePrice: basePriceText ? cellToNumber(basePriceCell) : null,
            variants: []
          })
        }

        const group = groups.get(key)
        const variantLabel = cellToText(getCellByHeader(row, headerMap, ['Вариант', 'Название варианта']))
        const sku = cellToText(getCellByHeader(row, headerMap, ['Артикул', 'SKU']))
        const profile = cellToText(getCellByHeader(row, headerMap, ['Профиль']))
        const hasVariant =
          variantLabel ||
          sku ||
          profile ||
          cellToText(getCellByHeader(row, headerMap, ['Толщина, мм'])) ||
          cellToText(getCellByHeader(row, headerMap, ['Ширина, мм'])) ||
          cellToText(getCellByHeader(row, headerMap, ['Высота, мм']))

        if (hasVariant) {
          group.variants.push({
            variant_label: variantLabel || profile || name,
            sku,
            thickness_mm: cellToNumber(getCellByHeader(row, headerMap, ['Толщина, мм'])) || null,
            width_mm: cellToNumber(getCellByHeader(row, headerMap, ['Ширина, мм'])) || null,
            height_mm: cellToNumber(getCellByHeader(row, headerMap, ['Высота, мм'])) || null,
            density: cellToNumber(getCellByHeader(row, headerMap, ['Плотность'])) || null,
            profile_name: profile,
            price: cellToNumber(getCellByHeader(row, headerMap, ['Цена варианта', 'Цена'])),
            variant_type: profile ? 'profile' : 'option',
            is_default: group.variants.length === 0 ? 1 : 0,
            is_active: 1,
            extra_json: {}
          })
        }
      })

      for (const group of groups.values()) {
        const existing = materialsDb.value.find((material) => {
          return normalizeSearch(material.полное_наименование_материала) === normalizeSearch(group.name) &&
            normalizeSearch(material.подкатегория) === normalizeSearch(group.subcategory)
        })

        const payload = existing
          ? materialRowToPayload(existing)
          : {
              id: null,
              category: group.subcategory || '',
              subcategory: group.subcategory || '',
              base_name: group.name,
              display_name: group.name,
              brand: '',
              model: '',
              material_type: '',
              unit: group.unit || 'м2',
              base_price: Number(group.basePrice || 0),
              source_url: '',
              notes: '',
              variants: []
            }

        payload.category = group.subcategory || payload.category || ''
        payload.subcategory = group.subcategory || payload.subcategory || ''
        payload.base_name = group.name
        payload.display_name = group.name
        payload.unit = group.unit || payload.unit || 'м2'
        payload.base_price = group.basePrice === null ? Number(payload.base_price || 0) : Number(group.basePrice || 0)

        if (group.variants.length || !existing) {
          payload.variants = group.variants
        }

        await saveMaterialAction(payload)
      }

      await loadData()
      return groups.size
    } catch (err) {
      console.error(err)
      error.value = err?.message || 'Не удалось загрузить материалы из XLSX'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteMaterial(id) {
    loading.value = true
    error.value = ''

    try {
      await deleteMaterialAction(id)
      favoriteMaterialIds.value = favoriteMaterialIds.value.filter(
        (item) => Number(item) !== Number(id)
      )
      saveIds(FAV_MATERIALS_KEY, favoriteMaterialIds.value)
      await loadData()
    } catch (err) {
      console.error(err)
      error.value = err?.message || 'Не удалось удалить материал'
      throw err
    } finally {
      loading.value = false
    }
  }

  function toggleFavMaterial(materialRow) {
    const id = Number(materialRow.идентификатор)
    const exists = favoriteMaterialIds.value.includes(id)

    favoriteMaterialIds.value = exists
      ? favoriteMaterialIds.value.filter((item) => item !== id)
      : [...favoriteMaterialIds.value, id]

    saveIds(FAV_MATERIALS_KEY, favoriteMaterialIds.value)
    materialRow.избранное = exists ? 0 : 1
  }

  async function addWork() {
    loading.value = true
    error.value = ''

    try {
      await saveWorkAction(workRowToPayload(newWork.value))
      newWork.value = defaultWorkForm()
      await loadData()
    } catch (err) {
      console.error(err)
      error.value = err?.message || 'Не удалось добавить работу'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateWork(workRow) {
    loading.value = true
    error.value = ''

    try {
      await saveWorkAction(workRowToPayload(workRow))
      await loadData()
    } catch (err) {
      console.error(err)
      error.value = err?.message || 'Не удалось обновить работу'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteWork(id) {
    loading.value = true
    error.value = ''

    try {
      await deleteWorkAction(id)
      favoriteWorkIds.value = favoriteWorkIds.value.filter(
        (item) => Number(item) !== Number(id)
      )
      saveIds(FAV_WORKS_KEY, favoriteWorkIds.value)
      await loadData()
    } catch (err) {
      console.error(err)
      error.value = err?.message || 'Не удалось удалить работу'
      throw err
    } finally {
      loading.value = false
    }
  }

  function toggleFavWork(workRow) {
    const id = Number(workRow.идентификатор)
    const exists = favoriteWorkIds.value.includes(id)

    favoriteWorkIds.value = exists
      ? favoriteWorkIds.value.filter((item) => item !== id)
      : [...favoriteWorkIds.value, id]

    saveIds(FAV_WORKS_KEY, favoriteWorkIds.value)
    workRow.избранное = exists ? 0 : 1
  }

  function toggleGroup(category) {
    collapsedGroups.value = {
      ...collapsedGroups.value,
      [category]: !collapsedGroups.value[category]
    }
  }

  function toggleMatMain(category) {
    collapsedMatMain.value = {
      ...collapsedMatMain.value,
      [category]: !collapsedMatMain.value[category]
    }
  }

  function toggleMatSub(mainCategory, subCategory) {
    const key = `${mainCategory}_${subCategory}`

    collapsedMatSub.value = {
      ...collapsedMatSub.value,
      [key]: !collapsedMatSub.value[key]
    }
  }

  return {
    loading,
    error,

    materials,
    works,
    coefficients,
    formulas,

    materialsDb,
    worksDb,
    coefficientsDb,
    formulasDb,

    newMaterial,
    newWork,

    searchMaterial,
    searchWork,

    onlyFavMaterials,
    onlyFavWorks,

    groupedMaterials,
    groupedWorks,

    uniqueCategories,

    collapsedGroups,
    collapsedMatMain,
    collapsedMatSub,

    loadData,

    addMaterial,
    updateMaterial,
    deleteMaterial,
    toggleFavMaterial,
    exportMaterialsXlsx,
    importMaterialsXlsx,

    addWork,
    updateWork,
    deleteWork,
    toggleFavWork,

    toggleGroup,
    toggleMatMain,
    toggleMatSub,

    expandedMaterials,
    newVariantDrafts,
    toggleMaterialVariants,
    ensureVariantDraft,
    addVariant,
    updateVariant,
    deleteVariant,
  }
}
