<template>
  <div class="items-group mt-3">
    <div class="table-subtitle">{{ title }}</div>

    <div v-if="items.length > 0" class="table-wrapper">
      <table
        class="data-table"
        :class="type === 'work' ? 'works-table' : 'mat-table'"
        :style="{ minWidth: `${tableMinWidth}px` }"
      >
        <thead>
          <tr>
            <th class="col-code" :style="colStyle('code')">
              Код ячейки
              <div class="resizer hide-on-print" @mousedown.stop="startResize($event, 'code')"></div>
            </th>
            <th class="col-name" :style="colStyle('name')">
              Наименование {{ type === 'work' ? 'работ' : 'материалов' }}
              <div class="resizer hide-on-print" @mousedown.stop="startResize($event, 'name')"></div>
            </th>
            <th v-if="type === 'material'" class="col-variant" :style="colStyle('variant')">
              Профиль / вариант
              <div class="resizer hide-on-print" @mousedown.stop="startResize($event, 'variant')"></div>
            </th>
            <th v-if="type === 'material'" class="col-thickness" :style="colStyle('thickness')">
              Толщина, мм
              <div class="resizer hide-on-print" @mousedown.stop="startResize($event, 'thickness')"></div>
            </th>
            <th class="col-unit" :style="colStyle('unit')">
              Ед.изм.
              <div class="resizer hide-on-print" @mousedown.stop="startResize($event, 'unit')"></div>
            </th>
            <th class="col-formula" :style="colStyle('formula')">
              Формула расчета
              <div class="resizer hide-on-print" @mousedown.stop="startResize($event, 'formula')"></div>
            </th>
            <th class="col-qty" :style="colStyle('qty')">
              Кол-во
              <div class="resizer hide-on-print" @mousedown.stop="startResize($event, 'qty')"></div>
            </th>
            <th class="col-price" :style="colStyle('price')">
              Цена за ед.
              <div class="resizer hide-on-print" @mousedown.stop="startResize($event, 'price')"></div>
            </th>
            <th class="col-sum" :style="colStyle('sum')">
              Сумма
              <div class="resizer hide-on-print" @mousedown.stop="startResize($event, 'sum')"></div>
            </th>
            <th class="col-action hide-on-print" :style="colStyle('action')"></th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="(item, idx) in items"
            :key="item.id || item.key || idx"
            :data-estimate-row-id="item.id || item.key || idx"
            :class="{ 'row-highlighted': `${item.id || item.key || idx}` === `${props.highlightedRowId}` }"
          >
            <td class="center bold accent-text" :title="buildCodeTitle(item)">
              {{ item.code || '—' }}
            </td>

            <td class="name-cell">
              <div class="autocomplete-cell">
                <input
                  v-model="item.name"
                  @input="handleNameInput(item, idx, $event)"
                  @focus="openNameSuggestions(item, idx, $event)"
                  @change="handleNameChange(item)"
                  @keydown="handleNameKeydown($event, item, idx)"
                  autocomplete="off"
                  class="cell-input text-left name-input"
                  placeholder="Начните вводить для поиска..."
                  :title="item.name"
                />
                <button
                  class="suggestion-toggle"
                  type="button"
                  title="Показать варианты"
                  @mousedown.prevent
                  @click="toggleNameSuggestions(item, idx, $event)"
                >
                  ▼
                </button>
              </div>
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

              <div v-else class="variant-empty">{{ formatMaterialVariant(item) }}</div>
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
              <div v-else class="variant-empty">{{ formatMaterialThickness(item) }}</div>
            </td>

            <td class="center">
              <input v-model="item.unit" class="cell-input center" />
            </td>

            <td>
              <input
                v-model="item.expression"
                @change="handleFormulaEdit(item)"
                @input="$emit('recalculate')"
                list="formulas-list"
                class="cell-input formula-input center"
                placeholder="Напр: C47 * 1.15 или ((C47/3)+C130+C131)/25"
              />
            </td>

            <td class="center">
              <input
                v-model.number="item.qty"
                type="number"
                step="0.001"
                class="cell-input center qty-input bold"
                title="Можно ввести количество вручную. Формула станет фиксированным числом."
                @change="handleQtyEdit(item)"
              />
            </td>

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

    <div v-else class="empty-items ui-card-soft">
      Нет {{ type === 'work' ? 'работ' : 'материалов' }}. Можно добавить строку ниже или удалить весь раздел кнопкой «Удалить раздел» в заголовке.
    </div>

    <Teleport to="body">
      <div
        v-if="activeAutocomplete.item"
        ref="dropdownRef"
        class="autocomplete-menu"
        :style="dropdownStyle"
      >
        <button
          v-for="(option, optionIndex) in activeAutocomplete.options"
          :key="option.key"
          type="button"
          class="autocomplete-option"
          :class="{ highlighted: optionIndex === activeAutocomplete.highlightedIndex }"
          :title="option.label"
          @mousedown.prevent
          @click="selectNameSuggestion(option)"
          @mouseenter="activeAutocomplete.highlightedIndex = optionIndex"
        >
          <span class="autocomplete-option-title">{{ option.label }}</span>
          <span v-if="option.meta" class="autocomplete-option-meta">{{ option.meta }}</span>
        </button>

        <div v-if="!activeAutocomplete.options.length" class="autocomplete-empty">
          Ничего не найдено. Можно ввести своё название вручную.
        </div>
      </div>
    </Teleport>

    <button @click="$emit('add')" class="btn-text hide-on-print mt-1">
      + Добавить {{ type === 'work' ? 'работу' : 'материал' }}
    </button>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { getCatalogData } from '@/core/services/dataApi'

const props = defineProps({
  title: String,
  type: String,
  items: Array,
  listId: String,
  highlightedRowId: { type: String, default: '' }
})

const emit = defineEmits(['changeName', 'changeFormula', 'recalculate', 'remove', 'add'])

function buildCodeTitle(item) {
  const cellCode = `${item?.code || item?.cellCode || ''}`.trim()
  const templateCode = `${item?.templateCode || ''}`.trim()
  const itemCode = `${item?.itemCode || item?.productCode || ''}`.trim()

  const lines = []
  if (cellCode) lines.push(`Код ячейки: ${cellCode}`)
  if (templateCode && templateCode !== cellCode) lines.push(`Шаблонный код: ${templateCode}`)
  if (itemCode) lines.push(`Код товара: ${itemCode}`)
  return lines.join('\n') || 'Код ячейки не задан'
}


const totalSum = computed(() => {
  return props.items.reduce((sum, i) => sum + ((i.qty || 0) * (i.price || 0)), 0)
})

const materialCache = new Map()
let materialCatalog = []
let workCatalog = []
const profileThicknessOptions = [0.65, 0.7, 0.75, 0.8, 0.9, 1.0, 1.2]
const colWidths = reactive({
  code: 84,
  name: 360,
  variant: 180,
  thickness: 104,
  unit: 72,
  formula: 170,
  qty: 96,
  price: 116,
  sum: 140,
  action: 48
})
const activeAutocomplete = reactive({
  key: '',
  item: null,
  options: [],
  highlightedIndex: 0
})
const dropdownStyle = ref({})
const dropdownRef = ref(null)
let activeAnchorEl = null
let resizeKey = ''
let resizeStartX = 0
let resizeStartWidth = 0

const tableMinWidth = computed(() => {
  const materialExtra = props.type === 'material'
    ? colWidths.variant + colWidths.thickness
    : 0

  return (
    colWidths.code +
    colWidths.name +
    materialExtra +
    colWidths.unit +
    colWidths.formula +
    colWidths.qty +
    colWidths.price +
    colWidths.sum +
    colWidths.action
  )
})

onMounted(async () => {
  await ensureCatalogLoaded()
  await ensureVariantsLoaded()
  document.addEventListener('mousedown', handleDocumentMouseDown)
  window.addEventListener('resize', updateDropdownPosition)
  window.addEventListener('scroll', updateDropdownPosition, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentMouseDown)
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', stopResize)
  window.removeEventListener('resize', updateDropdownPosition)
  window.removeEventListener('scroll', updateDropdownPosition, true)
})

function colStyle(key) {
  return {
    width: `${colWidths[key]}px`,
    minWidth: `${colWidths[key]}px`
  }
}

function startResize(event, key) {
  resizeKey = key
  resizeStartX = event.clientX
  resizeStartWidth = colWidths[key]
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', handleResizeMove)
  document.addEventListener('mouseup', stopResize)
}

function handleResizeMove(event) {
  if (!resizeKey) return
  colWidths[resizeKey] = Math.max(54, resizeStartWidth + (event.clientX - resizeStartX))
}

function stopResize() {
  resizeKey = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', stopResize)
}

watch(
  () => props.items?.map(item => `${item.name || ''}|${item.base_name || ''}|${item.material_id || ''}|${item.profile_name || ''}`).join('||'),
  async () => {
    await ensureVariantsLoaded()
  },
  { deep: true }
)

async function ensureCatalogLoaded() {
  if (materialCatalog.length && workCatalog.length) return
  const data = await getCatalogData()
  materialCatalog = Array.isArray(data.materials) ? data.materials : []
  workCatalog = Array.isArray(data.works) ? data.works : []
}

async function handleNameChange(item) {
  emit('changeName', item)
  await ensureVariantsLoadedForItem(item, true)
  emit('recalculate')
}

function handleQtyEdit(item) {
  const value = Number(item.qty)
  item.manualQty = true
  item.expression = Number.isFinite(value) ? `${value}` : '0'
  emit('changeFormula', item)
  emit('recalculate')
}

function handleFormulaEdit(item) {
  item.manualQty = false
  emit('changeFormula', item)
  emit('recalculate')
}

function handleNameInput(item, index, event) {
  if (props.type === 'material') {
    const currentName = normalize(item.name)
    const selectedName = normalize(item.base_name || '')

    if (selectedName && currentName !== selectedName) {
      clearMaterialSelection(item)
    }
  }

  openNameSuggestions(item, index, event)
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

  const sourceName = `${item.material_id ? (item.base_name || item.name) : (item.name || item.base_name || item.profile_name || '')}`.trim()
  if (!sourceName) {
    clearMaterialSelection(item)
    return
  }

  const cacheKey = normalize(sourceName)

  if (!forceReload && materialCache.has(cacheKey)) {
    applyMaterialLookup(item, materialCache.get(cacheKey), false)
    return
  }

  const material = findBaseMaterial(item)

  if (!material) {
    clearMaterialSelection(item)
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
    clearMaterialSelection(item)
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

function clearMaterialSelection(item) {
  item.itemCode = ''
  item.material_id = null
  item.base_name = ''
  item.variant_id = null
  item.variant_label = ''
  item.selectedVariantId = null
  item.selectedProfileVariantId = null
  item.profile_name = ''
  item.profileThickness = null
  item.thickness = null
  item.thickness_unit = ''
  item.profileOptions = []
  item.variantOptions = []
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

function formatMaterialVariant(item) {
  return item?.variant_label || item?.profile_name || '—'
}

function formatMaterialThickness(item) {
  const thickness = Number(item?.thickness || item?.profileThickness || 0)
  if (thickness > 0) {
    return `${thickness}`
  }

  return item?.thickness_label || '—'
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
        normalize(variant.profile_name) === target || normalize(variant.variant_label) === target
      )
    )
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

function itemKey(item, index) {
  return `${item?.id || item?.code || item?.cellCode || index || 'row'}`
}

function getCatalogOptions(item) {
  const source = props.type === 'work' ? workCatalog : materialCatalog

  return source.map((entry, index) => {
    if (props.type === 'work') {
      return {
        key: `work-${entry.id || index}`,
        label: entry.name || '',
        meta: [entry.category, entry.unit].filter(Boolean).join(' · '),
        raw: entry
      }
    }

    return {
      key: `material-${entry.id || index}`,
      label: entry.display_name || entry.base_name || '',
      meta: [entry.subcategory, entry.unit].filter(Boolean).join(' · '),
      raw: entry
    }
  }).filter((option) => option.label)
}

function buildSuggestionOptions(item, showAll = false) {
  const query = normalize(item?.name || '')
  const tokens = query.split(' ').filter(Boolean)

  let options = getCatalogOptions(item)
  if (!showAll && tokens.length) {
    options = options.filter((option) => {
      const haystack = normalize(`${option.label} ${option.meta || ''}`)
      return tokens.every((token) => haystack.includes(token))
    })
  }

  return options
    .sort((left, right) => {
      const leftLabel = normalize(left.label)
      const rightLabel = normalize(right.label)
      const leftStarts = query && leftLabel.startsWith(query) ? 0 : 1
      const rightStarts = query && rightLabel.startsWith(query) ? 0 : 1
      if (leftStarts !== rightStarts) return leftStarts - rightStarts
      return left.label.localeCompare(right.label, 'ru')
    })
    .slice(0, 80)
}

async function openNameSuggestions(item, index, event, showAll = false) {
  await ensureCatalogLoaded()
  activeAnchorEl = event?.currentTarget?.closest?.('.autocomplete-cell') || event?.currentTarget || activeAnchorEl
  activeAutocomplete.key = itemKey(item, index)
  activeAutocomplete.item = item
  activeAutocomplete.options = buildSuggestionOptions(item, showAll)
  activeAutocomplete.highlightedIndex = 0
  await nextTick()
  updateDropdownPosition()
}

function closeNameSuggestions() {
  activeAutocomplete.key = ''
  activeAutocomplete.item = null
  activeAutocomplete.options = []
  activeAutocomplete.highlightedIndex = 0
  activeAnchorEl = null
}

async function toggleNameSuggestions(item, index, event) {
  if (activeAutocomplete.item === item) {
    closeNameSuggestions()
    return
  }

  await openNameSuggestions(item, index, event, true)
}

function handleNameKeydown(event, item, index) {
  const isOpen = activeAutocomplete.item === item

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (!isOpen) {
      openNameSuggestions(item, index, event, true)
      return
    }
    activeAutocomplete.highlightedIndex = Math.min(
      activeAutocomplete.highlightedIndex + 1,
      Math.max(activeAutocomplete.options.length - 1, 0)
    )
    return
  }

  if (event.key === 'ArrowUp' && isOpen) {
    event.preventDefault()
    activeAutocomplete.highlightedIndex = Math.max(activeAutocomplete.highlightedIndex - 1, 0)
    return
  }

  if (event.key === 'Enter' && isOpen && activeAutocomplete.options.length) {
    event.preventDefault()
    selectNameSuggestion(activeAutocomplete.options[activeAutocomplete.highlightedIndex] || activeAutocomplete.options[0])
    return
  }

  if (event.key === 'Escape' && isOpen) {
    event.preventDefault()
    closeNameSuggestions()
  }
}

async function selectNameSuggestion(option) {
  const item = activeAutocomplete.item
  if (!item || !option) return

  item.name = option.label
  closeNameSuggestions()

  emit('changeName', {
    item,
    name: option.label,
    selected: option.raw,
    type: props.type
  })

  if (props.type === 'material') {
    await ensureVariantsLoadedForItem(item, true)
  }

  emit('recalculate')
}

function updateDropdownPosition() {
  if (!activeAnchorEl || !activeAutocomplete.item) return

  const rect = activeAnchorEl.getBoundingClientRect()
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  const width = Math.min(Math.max(rect.width, 520), Math.max(viewportWidth - 24, rect.width))
  const left = Math.max(12, Math.min(rect.left, viewportWidth - width - 12))
  const spaceBelow = viewportHeight - rect.bottom - 12
  const spaceAbove = rect.top - 12
  const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow
  const maxHeight = Math.max(160, Math.min(360, openAbove ? spaceAbove : spaceBelow))
  const top = openAbove ? Math.max(12, rect.top - maxHeight - 6) : rect.bottom + 6

  dropdownStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    maxHeight: `${maxHeight}px`
  }
}

function handleDocumentMouseDown(event) {
  if (!activeAutocomplete.item) return
  if (dropdownRef.value?.contains(event.target)) return
  if (activeAnchorEl?.contains?.(event.target)) return
  closeNameSuggestions()
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
  overflow: auto;
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding-bottom: 8px;
  scrollbar-gutter: stable both-edges;
}

.data-table {
  width: max-content;
  border-collapse: collapse;
  table-layout: fixed;
}

.data-table th,
.data-table td {
  border-bottom: 1px solid var(--border-color);
  padding: 0;
  text-align: center;
  background: var(--bg-card);
}

.data-table th {
  position: relative;
  background: var(--bg-card-soft);
  color: var(--text-soft);
  padding: 12px 8px;
  font-size: 13px;
  text-transform: uppercase;
  white-space: nowrap;
}

.data-table tr.row-highlighted td {
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-card));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
}

.resizer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 7px;
  cursor: col-resize;
  background: transparent;
}

.resizer:hover,
.resizer:active {
  background: var(--accent);
}

.name-cell {
  position: relative;
}

.autocomplete-cell {
  position: relative;
  display: flex;
  align-items: stretch;
}

.name-input {
  padding-right: 36px;
}

.suggestion-toggle {
  position: absolute;
  top: 0;
  right: 0;
  width: 34px;
  height: 100%;
  border: none;
  border-left: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-main);
  cursor: pointer;
}

.suggestion-toggle:hover {
  background: var(--bg-hover);
}

.cell-input {
  width: 100%;
  padding: 10px;
  border: none;
  background: transparent;
  color: var(--text-main);
  font: inherit;
  box-sizing: border-box;
  min-height: 44px;
}

.cell-input:focus {
  outline: 2px solid color-mix(in srgb, var(--accent) 28%, transparent);
  background: var(--bg-hover);
}

.variant-select,
.formula-input {
  text-align: center;
}

.variant-empty {
  color: var(--text-soft);
  padding: 10px;
}

.qty-input {
  color: var(--text-main);
}

.subtotal-row {
  display: flex;
  justify-content: flex-end;
  gap: 18px;
  padding: 12px 14px;
  background: var(--bg-card-soft);
  border-top: 1px solid var(--border-color);
  white-space: nowrap;
}

.subtotal-label {
  color: var(--text-soft);
}

.subtotal-value {
  color: var(--accent);
  font-weight: 800;
  white-space: nowrap;
}

.col-sum,
.data-table td.right {
  white-space: nowrap;
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

.empty-items {
  padding: 14px 16px;
  color: var(--text-soft);
  border-radius: 12px;
  border: 1px dashed var(--border-color);
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
</style>

<style>
.autocomplete-menu {
  position: fixed;
  z-index: 20000;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-card);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.22);
}

.autocomplete-option {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--text-main);
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
}

.autocomplete-option:hover,
.autocomplete-option.highlighted {
  background: var(--bg-hover);
}

.autocomplete-option-title {
  white-space: normal;
  line-height: 1.35;
  font-weight: 700;
}

.autocomplete-option-meta {
  color: var(--text-soft);
  font-size: 12px;
}

.autocomplete-empty {
  padding: 12px;
  color: var(--text-soft);
}
</style>
