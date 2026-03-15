<template>
  <div class="items-group mt-3">
    <div class="table-subtitle">{{ title }}</div>

    <div v-if="items.length > 0" class="table-wrapper">
      <table class="data-table" :class="type === 'work' ? 'works-table' : 'mat-table'">
        <thead>
          <tr>
            <th class="col-code">Код</th>
            <th class="col-name">Наименование {{ type === 'work' ? 'работ' : 'материалов' }}</th>
            <th v-if="type === 'material'" class="col-variant">Толщина / вариант</th>
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
            <td class="center bold accent-text" :title="`Код: [${item.code || ''}]`">
              {{ item.code }}
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
                v-if="hasVariantOptions(item)"
                v-model="item.selectedVariantId"
                class="cell-input center variant-select"
                @change="handleVariantChange(item)"
              >
                <option
                  v-for="variant in item.variantOptions"
                  :key="variant.идентификатор"
                  :value="variant.идентификатор"
                >
                  {{ formatVariantLabel(variant) }}
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
                placeholder="Напр: S * 1.1"
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
import { getDb } from '../database'

const props = defineProps({
  title: String,
  type: String,
  items: Array,
  listId: String
})

const emit = defineEmits(['changeName', 'changeFormula', 'recalculate', 'remove', 'add'])

const totalSum = computed(() => {
  return props.items.reduce((sum, i) => sum + ((i.qty || 0) * (i.price || 0)), 0)
})

const materialCache = new Map()

onMounted(() => {
  ensureVariantsLoaded()
})

watch(
  () => props.items?.map(item => `${item.name || ''}|${item.base_name || ''}|${item.material_id || ''}`).join('||'),
  () => {
    ensureVariantsLoaded()
  },
  { deep: true }
)

async function handleNameChange(item) {
  emit('changeName', item)
  await ensureVariantsLoadedForItem(item, true)
  emit('recalculate')
}

async function ensureVariantsLoaded() {
  if (props.type !== 'material') return
  for (const item of props.items || []) {
    await ensureVariantsLoadedForItem(item, false)
  }
}

async function ensureVariantsLoadedForItem(item, forceReload) {
  if (props.type !== 'material') return

  const sourceName = `${item.base_name || item.name || ''}`.trim()
  if (!sourceName) return

  const cacheKey = normalize(sourceName)

  if (!forceReload && materialCache.has(cacheKey)) {
    applyMaterialLookup(item, materialCache.get(cacheKey), false)
    return
  }

  const db = await getDb()
  const material = await findBaseMaterial(db, item)

  if (!material) {
    item.variantOptions = []
    item.selectedVariantId = null
    return
  }

  const variants = await db.select(
    `SELECT *
     FROM Справочник_вариантов_материалов
     WHERE material_id = $1 AND активен = 1
     ORDER BY толщина, идентификатор`,
    [material.идентификатор]
  )

  const payload = { material, variants }
  materialCache.set(cacheKey, payload)
  applyMaterialLookup(item, payload, false)
}

function applyMaterialLookup(item, payload, emitRecalculate) {
  const material = payload?.material || null
  const variants = Array.isArray(payload?.variants) ? payload.variants : []

  if (material) {
    item.material_id = material.идентификатор
    item.base_name = material.базовое_наименование || material.полное_наименование_материала || item.name
    item.name = item.base_name
    item.unit = material.единица_измерения || item.unit
    item.variantOptions = variants.map(variant => ({
      ...variant,
      label: formatVariantLabel(variant)
    }))

    const selected = resolveSelectedVariant(item)
    if (selected) {
      applyVariantToItem(item, selected, emitRecalculate)
    } else if (item.variantOptions.length > 0 && !item.selectedVariantId) {
      applyVariantToItem(item, item.variantOptions[0], emitRecalculate)
    }
  } else {
    item.variantOptions = []
    item.selectedVariantId = null
  }
}

function resolveSelectedVariant(item) {
  if (!hasVariantOptions(item)) return null

  let selected = item.variantOptions.find(variant => Number(variant.идентификатор) === Number(item.selectedVariantId))
  if (selected) return selected

  if (item.variant_id) {
    selected = item.variantOptions.find(variant => Number(variant.идентификатор) === Number(item.variant_id))
    if (selected) return selected
  }

  if (item.code) {
    selected = item.variantOptions.find(variant => `${variant.артикул_товара || ''}` === `${item.code || ''}`)
    if (selected) return selected
  }

  if (item.thickness) {
    selected = item.variantOptions.find(variant => Number(variant.толщина) === Number(item.thickness))
    if (selected) return selected
  }

  return null
}

function handleVariantChange(item) {
  if (!hasVariantOptions(item)) return
  const selected = item.variantOptions.find(variant => Number(variant.идентификатор) === Number(item.selectedVariantId))
  if (!selected) return
  applyVariantToItem(item, selected, true)
}

function applyVariantToItem(item, variant, emitRecalculate) {
  item.variant_id = variant.идентификатор
  item.selectedVariantId = variant.идентификатор
  item.thickness = variant.толщина || 0
  item.thickness_unit = variant.единица_толщины || 'мм'
  item.code = variant.артикул_товара || item.code
  item.price = Number(variant.базовая_цена || 0)
  if (emitRecalculate) {
    emit('recalculate')
  }
}

function hasVariantOptions(item) {
  return Array.isArray(item.variantOptions) && item.variantOptions.length > 0
}

function formatVariantLabel(variant) {
  const thickness = Number(variant.толщина || 0)
  const unit = variant.единица_толщины || 'мм'

  if (thickness > 0) {
    return `${thickness} ${unit}`
  }

  if (variant.длина && variant.ширина) {
    return `${variant.длина}×${variant.ширина}`
  }

  return variant.артикул_товара || `Вариант ${variant.идентификатор}`
}

async function findBaseMaterial(db, item) {
  if (item.material_id) {
    const byId = await db.select(
      'SELECT * FROM Справочник_материалов WHERE идентификатор = $1 LIMIT 1',
      [item.material_id]
    )
    if (byId.length > 0) return byId[0]
  }

  const candidateNames = [
    item.base_name,
    item.name
  ].filter(Boolean)

  for (const name of candidateNames) {
    let rows = await db.select(
      `SELECT *
       FROM Справочник_материалов
       WHERE lower(базовое_наименование) = lower($1)
          OR lower(полное_наименование_материала) = lower($1)
       LIMIT 1`,
      [name]
    )

    if (rows.length > 0) return rows[0]

    rows = await db.select(
      `SELECT *
       FROM Справочник_материалов
       WHERE lower(базовое_наименование) LIKE lower($1)
          OR lower(полное_наименование_материала) LIKE lower($1)
       LIMIT 1`,
      [`%${name}%`]
    )

    if (rows.length > 0) return rows[0]
  }

  return null
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
  font-weight: 700;
  margin-bottom: 0.5rem;
  font-style: italic;
  color: var(--text-soft);
}

.table-wrapper {
  width: 100%;
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  margin-bottom: 1rem;
  background: var(--bg-card);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.works-table {
  min-width: 1050px;
}

.mat-table {
  min-width: 1320px;
}

.data-table th {
  background: var(--bg-card-soft);
  padding: 12px 8px;
  font-size: 0.75rem;
  text-transform: uppercase;
  border: 1px solid var(--border-color);
  color: var(--text-soft);
  position: sticky;
  top: 0;
  z-index: 2;
}

.data-table td {
  border: 1px solid var(--border-color);
  padding: 0;
  position: relative;
  height: 45px;
  vertical-align: middle;
  color: var(--text-main);
  background: var(--bg-card);
}

.col-code {
  width: 50px;
}

.col-name {
  width: 330px;
}

.col-variant {
  width: 130px;
}

.col-supplier {
  width: 140px;
}

.col-unit {
  width: 60px;
}

.col-formula {
  width: 200px;
}

.col-qty {
  width: 90px;
}

.col-price {
  width: 110px;
}

.col-sum {
  width: 130px;
}

.col-action {
  width: 45px;
  border: none !important;
  background: transparent !important;
}

.cell-input {
  width: 100%;
  height: 44px;
  border: none;
  background: transparent;
  padding: 0 12px;
  line-height: 44px;
  border-radius: 0;
  margin: 0;
  display: block;
  box-sizing: border-box;
  color: var(--text-main);
  outline: none;
}

.cell-input:focus {
  background: var(--bg-hover);
  box-shadow: inset 0 0 0 2px var(--accent);
  z-index: 5;
}

.supplier-select,
.variant-select {
  font-weight: 700;
  color: var(--accent);
  cursor: pointer;
}

.formula-input {
  color: var(--text-soft);
  font-family: 'Fira Code', monospace;
  font-weight: 700;
  font-size: 0.9rem;
}

.qty-display {
  background: var(--bg-card-soft);
  color: var(--accent);
  font-weight: 800;
  font-size: 1rem;
}

.accent-text {
  color: var(--accent);
  font-family: monospace;
  font-weight: 800;
}

.variant-empty {
  color: var(--text-soft);
  font-size: 13px;
}

.subtotal-row {
  text-align: right;
  padding: 0.75rem 0;
  border-top: 1px solid var(--border-color);
  color: var(--text-main);
  background: var(--bg-card);
}

.subtotal-label {
  margin-right: 1rem;
  color: var(--text-soft);
}

.subtotal-value {
  font-weight: 700;
  min-width: 150px;
  display: inline-block;
  color: var(--accent);
}

.btn-text {
  background: transparent;
  border: 2px dashed var(--border-strong);
  color: var(--text-soft);
  font-weight: 700;
  cursor: pointer;
  padding: 0.6rem 1.2rem;
  font-size: 0.95rem;
  border-radius: 10px;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
  display: block;
  width: 100%;
  text-align: center;
}

.btn-text:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
  color: var(--accent);
}

.btn-icon {
  opacity: 0.55;
  transition: transform var(--transition-fast), opacity var(--transition-fast), color var(--transition-fast);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0;
  color: var(--text-soft);
}

.btn-icon:hover {
  opacity: 1;
  transform: scale(1.15);
  color: var(--danger);
}

.center {
  text-align: center;
}

.right {
  text-align: right;
}

.bold {
  font-weight: 700;
}

.text-left {
  text-align: left;
}

@media print {
  .hide-on-print {
    display: none !important;
  }

  .data-table th,
  .data-table td {
    border: 1px solid #000 !important;
    color: #000 !important;
    background: #fff !important;
  }

  .qty-display,
  .accent-text,
  .subtotal-row,
  .subtotal-label,
  .subtotal-value,
  .formula-input {
    color: #000 !important;
    background: #fff !important;
  }
}

input[type='number']::-webkit-outer-spin-button,
input[type='number']::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type='number'] {
  -moz-appearance: textfield;
}

input::-webkit-calendar-picker-indicator {
  display: none !important;
}

input::-webkit-list-button {
  display: none !important;
}
</style>