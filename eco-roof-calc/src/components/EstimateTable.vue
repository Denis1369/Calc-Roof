<template>
  <div class="items-group mt-3">
    <div class="table-subtitle">{{ title }}</div>

    <div v-if="items.length > 0" class="table-wrapper">
      <table class="data-table" :class="type === 'work' ? 'works-table' : 'mat-table'">
        <thead>
          <tr>
            <th class="col-code">Код ячейки</th>
            <th class="col-name">Наименование {{ type === 'work' ? 'работ' : 'материалов' }}</th>
            <th v-if="type === 'material'" class="col-variant">Профиль / вариант</th>
            <th v-if="type === 'material'" class="col-thickness">Толщина, мм</th>
            <th v-if="type === 'material'" class="col-supplier">Тип / Поставщик</th>
            <th class="col-unit">Ед.изм.</th>
            <th class="col-formula">Формула расчета</th>
            <th class="col-qty">Кол-во</th>
            <th class="col-price">Цена за ед.</th>
            <th class="col-sum">Сумма</th>
            <th class="col-action hide-on-print"></th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="(item, idx) in items" :key="item.id || item.key || idx">
            <td class="center bold accent-text" :title="buildCodeTitle(item)">
              {{ item.code || '—' }}
            </td>

            <td>
              <input
                v-model="item.name"
                :list="listId"
                @change="handleNameChange(item)"
                class="cell-input text-left"
                placeholder="Начните вводить для поиска..."
              />
            </td>

            <td v-if="type === 'material'" class="center">
              <select
                v-if="isProfileSheet(item) && item.profileOptions?.length"
                v-model="item.selectedProfileVariantId"
                class="cell-input center variant-select"
                @change="handleProfileVariantChange(item)"
              >
                <option
                  v-for="variant in item.profileOptions"
                  :key="variant.id"
                  :value="variant.id"
                >
                  {{ variant.profile_name || variant.variant_label }}
                </option>
              </select>

              <select
                v-else-if="hasVariantOptions(item)"
                v-model="item.selectedVariantId"
                class="cell-input center variant-select"
                @change="handleVariantChange(item)"
              >
                <option v-for="variant in item.variantOptions" :key="variant.id" :value="variant.id">
                  {{ formatVariantLabel(variant) }}
                </option>
              </select>

              <div v-else class="variant-empty">—</div>
            </td>

            <td v-if="type === 'material'" class="center">
              <select
                v-if="isProfileSheet(item)"
                v-model.number="item.profileThickness"
                class="cell-input center variant-select"
                @change="handleThicknessChange(item)"
              >
                <option v-for="value in profileThicknessOptions" :key="value" :value="value">
                  {{ value }}
                </option>
              </select>
              <div v-else class="variant-empty">—</div>
            </td>

            <td v-if="type === 'material'" class="center">
              <select v-model="item.supplier" class="cell-input center supplier-select">
                <option value="ТехноНИКОЛЬ">ТехноНИКОЛЬ</option>
                <option value="Аналог">Аналог</option>
              </select>
            </td>

            <td class="center">
              <input v-model="item.unit" class="cell-input center" />
            </td>

            <td>
              <input
                v-model="item.expression"
                @change="$emit('changeFormula', item)"
                @input="$emit('recalculate')"
                list="formulas-list"
                class="cell-input formula-input center"
                placeholder="Напр: C47 * 1.15 или ((C47/3)+C130+C131)/25"
              />
            </td>

            <td class="center bold qty-display">{{ item.qty }}</td>

            <td>
              <input type="number" v-model.number="item.price" class="cell-input right" />
            </td>

            <td class="right bold">
              {{ ((item.qty || 0) * (item.price || 0)).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽
            </td>

            <td class="center hide-on-print">
              <button @click="$emit('remove', idx)" class="btn-icon">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="subtotal-row">
        <span class="subtotal-label">Итого за {{ type === 'work' ? 'работы' : 'материалы' }}:</span>
        <span class="subtotal-value">{{ totalSum.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
      </div>
    </div>

    <button @click="$emit('add')" class="btn-text hide-on-print mt-1">
      + Добавить {{ type === 'work' ? 'работу' : 'материал' }}
    </button>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { getCatalogData } from '../application/catalog/getCatalogData'

const props = defineProps({
  title: String,
  type: String,
  items: Array,
  listId: String
})

const emit = defineEmits(['changeName', 'changeFormula', 'recalculate', 'remove', 'add'])

function buildCodeTitle(item) {
  const cellCode = `${item?.code || ''}`.trim()
  const itemCode = `${item?.itemCode || item?.productCode || ''}`.trim()

  if (cellCode && itemCode) {
    return `Код ячейки: ${cellCode}\nКод товара: ${itemCode}`
  }

  if (cellCode) {
    return `Код ячейки: ${cellCode}`
  }

  if (itemCode) {
    return `Код товара: ${itemCode}`
  }

  return 'Код ячейки не задан'
}


const totalSum = computed(() => {
  return props.items.reduce((sum, i) => sum + ((i.qty || 0) * (i.price || 0)), 0)
})

const materialCache = new Map()
let materialCatalog = []
const profileThicknessOptions = [0.65, 0.7, 0.75, 0.8, 0.9, 1.0, 1.2]

onMounted(async () => {
  await ensureCatalogLoaded()
  await ensureVariantsLoaded()
})

watch(
  () => props.items?.map(item => `${item.name || ''}|${item.base_name || ''}|${item.material_id || ''}|${item.profile_name || ''}`).join('||'),
  async () => {
    await ensureVariantsLoaded()
  },
  { deep: true }
)

async function ensureCatalogLoaded() {
  if (materialCatalog.length) return
  const data = await getCatalogData()
  materialCatalog = Array.isArray(data.materials) ? data.materials : []
}

async function handleNameChange(item) {
  emit('changeName', item)
  await ensureVariantsLoadedForItem(item, true)
  emit('recalculate')
}

async function ensureVariantsLoaded() {
  if (props.type !== 'material') return
  await ensureCatalogLoaded()
  for (const item of props.items || []) {
    await ensureVariantsLoadedForItem(item, false)
  }
}

async function ensureVariantsLoadedForItem(item, forceReload) {
  if (props.type !== 'material') return
  await ensureCatalogLoaded()

  const sourceName = `${item.base_name || item.name || item.profile_name || ''}`.trim()
  if (!sourceName) return

  const cacheKey = normalize(sourceName)

  if (!forceReload && materialCache.has(cacheKey)) {
    applyMaterialLookup(item, materialCache.get(cacheKey), false)
    return
  }

  const material = findBaseMaterial(item)

  if (!material) {
    item.variantOptions = []
    item.profileOptions = []
    item.selectedVariantId = null
    item.selectedProfileVariantId = null
    return
  }

  const variants = Array.isArray(material.variants) ? material.variants : []
  const payload = { material, variants }
  materialCache.set(cacheKey, payload)
  applyMaterialLookup(item, payload, false)
}

function applyMaterialLookup(item, payload, emitRecalculate) {
  const material = payload?.material || null
  const variants = Array.isArray(payload?.variants) ? payload.variants : []

  if (!material) {
    item.variantOptions = []
    item.profileOptions = []
    item.selectedVariantId = null
    item.selectedProfileVariantId = null
    return
  }

  item.material_id = material.id
  item.base_name = material.base_name || material.display_name || item.name
  item.unit = material.unit || item.unit

  if (isProfileSheet(item) || isProfileSheetMaterial(material)) {
    item.profileOptions = variants.filter((variant) => `${variant.variant_type || ''}` === 'profile')
    item.variantOptions = []

    const selectedProfile =
      item.profileOptions.find((variant) => Number(variant.id) === Number(item.selectedProfileVariantId)) ||
      item.profileOptions.find((variant) => `${variant.profile_name || ''}` === `${item.profile_name || ''}`) ||
      item.profileOptions.find((variant) => Number(variant.is_default || 0) === 1) ||
      item.profileOptions[0]

    if (selectedProfile) {
      item.selectedProfileVariantId = selectedProfile.id
      item.profile_name = selectedProfile.profile_name || ''
      item.variant_label = selectedProfile.variant_label || selectedProfile.profile_name || ''
      item.name = `Профлист ${selectedProfile.profile_name || selectedProfile.variant_label || ''}`.trim()
      item.price = Number(selectedProfile.price || item.price || 0)
    }

    item.profileThickness = Number(item.profileThickness || item.thickness || 0.8)
    item.thickness = Number(item.profileThickness || 0.8)
    item.thickness_unit = 'мм'
    item.itemCode = buildProfileSheetCode(item)

    if (emitRecalculate) emit('recalculate')
    return
  }

  item.variantOptions = variants
  item.profileOptions = []

  const selected = resolveSelectedVariant(item)
  if (selected) {
    applyVariantToItem(item, selected, emitRecalculate)
  } else if (item.variantOptions.length > 0) {
    applyVariantToItem(item, item.variantOptions[0], emitRecalculate)
  }
}

function resolveSelectedVariant(item) {
  if (!hasVariantOptions(item)) return null

  let selected = item.variantOptions.find(variant => Number(variant.id) === Number(item.selectedVariantId))
  if (selected) return selected

  if (item.variant_id) {
    selected = item.variantOptions.find(variant => Number(variant.id) === Number(item.variant_id))
    if (selected) return selected
  }

  if (item.itemCode) {
    selected = item.variantOptions.find(variant => `${variant.sku || ''}` === `${item.itemCode || ''}`)
    if (selected) return selected
  }

  if (item.thickness) {
    selected = item.variantOptions.find(variant => Number(variant.thickness_mm || 0) === Number(item.thickness))
    if (selected) return selected
  }

  return null
}

function handleVariantChange(item) {
  if (!hasVariantOptions(item)) return
  const selected = item.variantOptions.find(variant => Number(variant.id) === Number(item.selectedVariantId))
  if (!selected) return
  applyVariantToItem(item, selected, true)
}

function handleProfileVariantChange(item) {
  if (!Array.isArray(item.profileOptions)) return
  const selected = item.profileOptions.find(variant => Number(variant.id) === Number(item.selectedProfileVariantId))
  if (!selected) return
  item.profile_name = selected.profile_name || ''
  item.variant_id = selected.id
  item.variant_label = selected.variant_label || selected.profile_name || ''
  item.name = `Профлист ${selected.profile_name || selected.variant_label || ''}`.trim()
  item.price = Number(selected.price || item.price || 0)
  item.itemCode = buildProfileSheetCode(item, selected)
  emit('recalculate')
}

function handleThicknessChange(item) {
  item.thickness = Number(item.profileThickness || 0)
  item.thickness_unit = 'мм'
  item.itemCode = buildProfileSheetCode(item)
  emit('recalculate')
}

function buildProfileSheetCode(item, selectedVariant = null) {
  const materialId = item.material_id || 'profile-sheet'
  const profile = selectedVariant?.profile_name || item.profile_name || 'PROFILE'
  const thickness = item.profileThickness || item.thickness || ''
  return `${materialId}-${profile}-${thickness}`
}

function applyVariantToItem(item, variant, emitRecalculate) {
  item.variant_id = variant.id
  item.selectedVariantId = variant.id
  item.thickness = variant.thickness_mm || 0
  item.thickness_unit = 'мм'
  item.itemCode = variant.sku || item.itemCode
  item.price = Number(variant.price || 0)
  item.variant_label = variant.variant_label || ''
  if (emitRecalculate) {
    emit('recalculate')
  }
}

function hasVariantOptions(item) {
  return Array.isArray(item.variantOptions) && item.variantOptions.length > 0
}

function formatVariantLabel(variant) {
  if (variant.profile_name) {
    return `Профлист ${variant.profile_name}`
  }

  const thickness = Number(variant.thickness_mm || 0)
  if (thickness > 0) {
    return `${thickness} мм`
  }

  if (variant.height_mm && variant.width_mm) {
    return `${variant.height_mm}×${variant.width_mm}`
  }

  return variant.variant_label || variant.sku || `Вариант ${variant.id}`
}

function findBaseMaterial(item) {
  if (item.material_id) {
    const byId = materialCatalog.find(material => Number(material.id) === Number(item.material_id))
    if (byId) return byId
  }

  const candidateNames = [
    item.base_name,
    item.name,
    item.profile_name,
    item.variant_label
  ].filter(Boolean)

  for (const name of candidateNames) {
    const target = normalize(name)

    let found = materialCatalog.find(material => normalize(material.base_name) === target)
    if (found) return found

    found = materialCatalog.find(material => normalize(material.display_name) === target)
    if (found) return found

    found = materialCatalog.find(
      material => Array.isArray(material.variants) && material.variants.some(variant =>
        normalize(variant.profile_name).includes(target) || normalize(variant.variant_label).includes(target)
      )
    )
    if (found) return found

    found = materialCatalog.find(material => normalize(material.base_name).includes(target))
    if (found) return found

    found = materialCatalog.find(material => normalize(material.display_name).includes(target))
    if (found) return found
  }

  return null
}

function isProfileSheet(item) {
  return normalize(item.base_name || item.name).includes('профилированный лист') || normalize(item.name).includes('профлист')
}

function isProfileSheetMaterial(material) {
  return normalize(material.base_name || material.display_name).includes('профилированный лист')
}

function normalize(value) {
  return `${value || ''}`.toLowerCase().replace(/\s+/g, ' ').trim()
}
</script>

<style scoped>
.items-group {
  margin-top: 1.5rem;
}

.mt-1 {
  margin-top: 10px;
}

.mt-3 {
  margin-top: 1.5rem;
}

.table-subtitle {
  font-size: 1.6rem;
  font-style: italic;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 1rem;
}

.table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: 14px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1150px;
}

.data-table th,
.data-table td {
  border-bottom: 1px solid var(--border-color);
  padding: 0;
  text-align: center;
  background: var(--bg-card);
}

.data-table th {
  background: var(--bg-card-soft);
  color: var(--text-soft);
  padding: 12px 8px;
  font-size: 13px;
  text-transform: uppercase;
}

.col-code { width: 90px; }
.col-name { width: 360px; }
.col-variant { width: 190px; }
.col-thickness { width: 120px; }
.col-supplier { width: 150px; }
.col-unit { width: 80px; }
.col-formula { width: 180px; }
.col-qty { width: 110px; }
.col-price { width: 120px; }
.col-sum { width: 140px; }
.col-action { width: 54px; }

.cell-input {
  width: 100%;
  padding: 10px;
  border: none;
  background: transparent;
  color: var(--text-main);
  font: inherit;
  box-sizing: border-box;
}

.cell-input:focus {
  outline: 2px solid color-mix(in srgb, var(--accent) 28%, transparent);
  background: var(--bg-hover);
}

.variant-select,
.supplier-select,
.formula-input {
  text-align: center;
}

.variant-empty {
  color: var(--text-soft);
  padding: 10px;
}

.qty-display {
  padding: 10px;
}

.subtotal-row {
  display: flex;
  justify-content: flex-end;
  gap: 18px;
  padding: 12px 14px;
  background: var(--bg-card-soft);
  border-top: 1px solid var(--border-color);
}

.subtotal-label {
  color: var(--text-soft);
}

.subtotal-value {
  color: var(--accent);
  font-weight: 800;
}

.btn-text {
  width: 100%;
  margin-top: 10px;
  padding: 12px;
  border: 2px dashed var(--border-color);
  border-radius: 12px;
  background: transparent;
  color: var(--text-soft);
  font-weight: 700;
  cursor: pointer;
}

.btn-text:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-icon {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 18px;
}

.center { text-align: center; }
.right { text-align: right; }
.bold { font-weight: 700; }
.accent-text { color: var(--accent); }
.hide-on-print { }
</style>
