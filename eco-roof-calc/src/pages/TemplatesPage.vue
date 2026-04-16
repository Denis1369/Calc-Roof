<template>
  <div class="system-editor-page">
    <header class="page-header">
      <h1 class="ui-title">Редактор систем</h1>
      <p class="page-subtitle">Меняй то, что подставляется по умолчанию: разделы, работы, материалы, расходники и формулы.</p>
    </header>

    <div class="layout">
      <aside class="sidebar page-card">
        <div class="sidebar-title">Системы</div>
        <div v-if="loading" class="empty-state ui-card-soft">Загрузка...</div>
        <div v-else class="system-list">
          <button
            v-for="system in systems"
            :key="system.код"
            class="system-list-item"
            :class="{ active: system.код === selectedSystemCode }"
            @click="openSystem(system.код)"
          >
            <div class="system-list-name">{{ system.название }}</div>
            <div class="system-list-meta">{{ baseLabel(system) }} · {{ hydroLabel(system) }}</div>
          </button>
        </div>
      </aside>

      <section class="content">
        <div v-if="!selectedSystem || !editableZone" class="empty-state page-card">
          Выбери систему слева, чтобы настроить, что должно подставляться по умолчанию.
        </div>

        <div v-else class="page-card editor-card">
          <div class="editor-header">
            <div>
              <h2 class="editor-title">{{ selectedSystem.название }}</h2>
              <div class="editor-subtitle">
                Основание: {{ baseLabel(selectedSystem) }} · Гидроизоляция: {{ hydroLabel(selectedSystem) }}
              </div>
              <div class="editor-hint">
                Это редактор основы системы. Всё, что ты здесь сохранишь, будет подставляться при выборе этой системы.
              </div>
            </div>

            <div class="editor-actions">
              <button class="ui-btn ui-btn-primary" @click="isGlobalOptionsEditorOpen = true">
                ⚙ Глобальный редактор опций
              </button>
              <button class="ui-btn ui-btn-primary" @click="createCustomSystem">＋ Создать свою систему</button>

              <button class="ui-btn ui-btn-secondary" @click="openSettings">Параметры и опции</button>
              <button class="ui-btn ui-btn-secondary" @click="rebuildFromEtalon">Пересобрать из эталона</button>
              <button class="ui-btn ui-btn-success" @click="saveOverride">Сохранить основу</button>
              <button class="ui-btn ui-btn-danger" @click="resetOverride">Сбросить основу</button>
            </div>
          </div>

          <div class="defaults-summary ui-card-soft">
            <div><strong>Выбранные доп. опции:</strong> {{ selectedOptionLabels || 'нет' }}</div>
            <div><strong>Параметров по умолчанию:</strong> {{ defaultParamsSummary }}</div>
          </div>

          <div class="zone-params-block">
            <div class="zone-params-title">Базовые параметры для пересчёта формул в редакторе</div>
            <div class="params-grid">
              <div class="calc-group">
                <label class="ui-label">Площадь (S, м²)</label>
                <input v-model.number="editableZone.roofParams.area" type="number" class="ui-input" @input="recalculateZone" />
              </div>
              <div class="calc-group">
                <label class="ui-label">Периметр (P, пог.м)</label>
                <input v-model.number="editableZone.roofParams.perimeter" type="number" class="ui-input" @input="recalculateZone" />
              </div>
              <div class="calc-group">
                <label class="ui-label">Водоотвод (OD, шт)</label>
                <input v-model.number="editableZone.roofParams.parapetDrains" type="number" class="ui-input" @input="recalculateZone" />
              </div>
              <div class="calc-group">
                <label class="ui-label">Воронки (ID, шт)</label>
                <input v-model.number="editableZone.roofParams.innerDrains" type="number" class="ui-input" @input="recalculateZone" />
              </div>
              <div class="calc-group">
                <label class="ui-label">Аэраторы (A, шт)</label>
                <input v-model.number="editableZone.roofParams.aerators" type="number" class="ui-input" @input="recalculateZone" />
              </div>
            </div>
          </div>

          <div v-for="(section, sIdx) in editableZone.sections" :key="section.id" class="section-block">
            <div class="section-header">
              <input v-model="section.title" class="section-title-input" placeholder="Название раздела" />
              <button class="btn-icon danger-text" @click="removeSection(sIdx)">✕</button>
            </div>

            <EstimateTable
              title="Работы:"
              type="work"
              :items="section.works"
              listId="works-list-editor"
              @changeName="onWorkNameChange($event, section)"
              @changeFormula="recalculateZone"
              @recalculate="recalculateZone"
              @remove="removeWork(section, $event)"
              @add="addWork(section)"
            />

            <EstimateTable
              title="Материалы:"
              type="material"
              :items="section.materials"
              listId="materials-list-editor"
              @changeName="onMaterialNameChange($event, section)"
              @changeFormula="recalculateZone"
              @recalculate="recalculateZone"
              @remove="removeMaterial(section, $event)"
              @add="addMaterial(section)"
            />

            <div class="section-total-row">
              <span class="section-total-label">Итого по разделу:</span>
              <span class="section-total-value">{{ getSectionTotal(section).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
            </div>
          </div>

          <div class="add-section-row">
            <button class="btn-outline" @click="addSection">+ Добавить раздел</button>
          </div>
        </div>
      </section>
    </div>

    <TemplateOptionsModal
      :is-open="isOptionsOpen"
      :system="selectedSystem"
      :selected-keys="selectedKeys"
      title="Что включить в основу системы"
      continue-label="Далее"
      cancel-label="Отмена"
      @close="isOptionsOpen = false"
      @continue="handleOptionsContinue"
    />

    <TemplateParamsModal
      :is-open="isParamsOpen"
      :system="selectedSystem"
      :selected-keys="selectedKeys"
      :initial-values="paramValues"
      title="Параметры системы по умолчанию"
      submit-label="Применить"
      back-label="Назад"
      @close="isParamsOpen = false"
      @back="backToOptions"
      @submit="handleParamsSubmit"
    />

    <AdditionalOptionsEditorModal
      :is-open="isGlobalOptionsEditorOpen"
      @close="isGlobalOptionsEditorOpen = false"
      @updated="rebuildFromEtalon"
    />

    <datalist id="works-list-editor">
      <option v-for="w in worksDb" :key="w.идентификатор" :value="w.наименование_работы"></option>
    </datalist>

    <datalist id="materials-list-editor">
      <option v-for="m in materialsDb" :key="m.идентификатор" :value="m.полное_наименование_материала"></option>
    </datalist>

    <datalist id="modal-works-list">
      <option v-for="w in worksDb" :key="w.идентификатор" :value="w.наименование_работы"></option>
    </datalist>
    <datalist id="modal-materials-list">
      <option v-for="m in materialsDb" :key="m.идентификатор" :value="m.полное_наименование_материала"></option>
    </datalist>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { evaluate } from 'mathjs'
import EstimateTable from '../components/EstimateTable.vue'
import TemplateOptionsModal from '../components/TemplateOptionsModal.vue'
import TemplateParamsModal from '../components/TemplateParamsModal.vue'
// Импортируем новый компонент
import AdditionalOptionsEditorModal from '../components/AdditionalOptionsEditorModal.vue'

import { listSystems } from '@/core/services/dataApi'
import { getSystemTemplate } from '@/core/services/dataApi'
import { getCatalogData } from '@/core/services/dataApi'
import { buildEstimateFromSystem } from '@/modules/templates/buildEstimate'
import { toLegacyMaterialRow, toLegacyWorkRow } from '@/core/adapters/viewAdapters'
import { toSystemListItem, toSystemTemplateView } from '@/core/adapters/viewAdapters'
import { sanitizeTemplateParamValues } from '@/modules/templates/templateEnhancements'
import { assignExcelCellCodesToSections, nextExcelCellCodeForSections } from '@/core/utils/excelCellCodes'
import { SystemRepository } from '@/core/repositories/SystemRepository'

const systemRepository = new SystemRepository()
const route = useRoute()
const router = useRouter()

const loading = ref(false)
const systems = ref([])
const selectedSystemCode = ref('')
const selectedSystem = ref(null)
const editableZone = ref(null)
const selectedKeys = ref([])
const paramValues = ref({})
const worksDb = ref([])
const materialsDb = ref([])
const formulasDb = ref([])
const coefficientsDb = ref([])
const isOptionsOpen = ref(false)
const isParamsOpen = ref(false)

// Состояние нового модального окна
const isGlobalOptionsEditorOpen = ref(false)

function uuid() {
  return crypto.randomUUID()
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalize(value) {
  return `${value || ''}`.toLowerCase().replace(/\s+/g, ' ').trim()
}

function round2(value) {
  return Math.round(toNumber(value) * 100) / 100
}

const selectedOptionLabels = computed(() => {
  if (!selectedSystem.value) return ''
  const optionMap = new Map((selectedSystem.value.опции || []).map((item) => [item.key, item.label]))
  return selectedKeys.value.map((key) => optionMap.get(key) || key).join(', ')
})

const defaultParamsSummary = computed(() => {
  const keys = Object.keys(paramValues.value || {}).filter((key) => {
    const value = paramValues.value[key]
    return !(value === '' || value === null || value === undefined)
  })
  return keys.length ? `${keys.length} шт.` : 'не заданы'
})

onMounted(async () => {
  await loadCatalogs()
  await loadSystemsList()
  const initialCode = `${route.query.system || systems.value[0]?.код || ''}`
  if (initialCode) {
    await openSystem(initialCode)
  }
})

async function loadCatalogs() {
  const data = await getCatalogData()
  worksDb.value = (data.works || []).map(toLegacyWorkRow)
  materialsDb.value = (data.materials || []).map(toLegacyMaterialRow)
  formulasDb.value = data.formulas || []
  coefficientsDb.value = data.coefficients || []
}

async function loadSystemsList() {
  loading.value = true
  try {
    const rows = await listSystems()
    systems.value = rows.map(toSystemListItem)
  } finally {
    loading.value = false
  }
}

async function openSystem(systemCode) {
  loading.value = true
  try {
    const fullSystem = await getSystemTemplate(systemCode)
    if (!fullSystem) return

    selectedSystemCode.value = systemCode
    selectedSystem.value = toSystemTemplateView(fullSystem)

    const override = fullSystem.default_override || null
    selectedKeys.value = Array.isArray(override?.selectedKeys)
      ? [...override.selectedKeys]
      : (selectedSystem.value.опции || []).filter((item) => item.default).map((item) => item.key)
    paramValues.value = { ...(override?.paramValues || {}) }

    const estimate = await buildEstimateFromSystem(selectedSystem.value, selectedKeys.value, paramValues.value)
    editableZone.value = estimate.estimateZones?.[0] || createEmptyZone()
    recalculateZone()

    if (`${route.query.system || ''}` !== systemCode) {
      router.replace({ query: { ...route.query, system: systemCode } })
    }
  } finally {
    loading.value = false
  }
}

function baseLabel(system) {
  const text = `${system?.тип_основания || ''}`.toLowerCase()
  if (text.includes('prof') || text.includes('лист')) return 'Профлист'
  return 'Бетон / ЖБ'
}

function hydroLabel(system) {
  const text = `${system?.тип_гидроизоляции || ''}`.toLowerCase()
  if (text.includes('pvc') || text.includes('пвх')) return 'ПВХ-мембрана'
  if (text.includes('brm') || text.includes('брм') || text.includes('бит')) return 'БРМ'
  return system?.тип_гидроизоляции || 'Не указано'
}

function createEmptyWork() {
  return {
    id: uuid(),
    code: '',
    cellCode: '',
    templateCode: '',
    itemCode: '',
    name: '',
    unit: 'м2',
    expression: 'S',
    qty: 0,
    price: 0,
    total: 0
  }
}

function createEmptyMaterial() {
  return {
    id: uuid(),
    code: '',
    cellCode: '',
    templateCode: '',
    itemCode: '',
    name: '',
    supplier: 'ТехноНИКОЛЬ',
    unit: 'м2',
    expression: 'S',
    qty: 0,
    price: 0,
    total: 0
  }
}

function createEmptySection(title = 'Новый раздел') {
  return { id: uuid(), title, works: [], materials: [] }
}

function createEmptyZone() {
  return {
    id: uuid(),
    name: 'Монтаж системы',
    roofParams: { area: 0, perimeter: 0, parapetDrains: 0, innerDrains: 0, aerators: 0 },
    customParams: [],
    templateMeta: { paramValues: {} },
    sections: [createEmptySection()]
  }
}

function findWorkByName(name) {
  const target = normalize(name)
  return worksDb.value.find((item) => normalize(item.наименование_работы) === target)
    || worksDb.value.find((item) => normalize(item.наименование_работы).includes(target) || target.includes(normalize(item.наименование_работы)))
    || null
}

function findMaterialByName(name) {
  const target = normalize(name)
  return materialsDb.value.find((item) => normalize(item.полное_наименование_материала) === target)
    || materialsDb.value.find((item) => normalize(item.полное_наименование_материала).includes(target) || target.includes(normalize(item.полное_наименование_материала)))
    || null
}

function replaceCoefficients(expression) {
  return `${expression || ''}`.replace(/\[(.*?)\]/g, (_, coefficientName) => {
    const target = normalize(coefficientName)
    const found = coefficientsDb.value.find((item) => {
      const name = normalize(item.name || item.название)
      const key = normalize(item.normalize_key || item.код || '')
      return name === target || key === target
    })
    return `${toNumber(found?.value ?? found?.значение ?? 1, 1)}`
  })
}

function evaluateExpression(expression, scope) {
  const prepared = replaceCoefficients(`${expression || '0'}`.replace(/^=/, '').trim())
  if (!prepared) return 0
  try {
    const value = evaluate(prepared, scope)
    return Math.round(toNumber(value) * 1000) / 1000
  } catch {
    return 0
  }
}

function getWorkPriceByArea(workRow, area) {
  const value = toNumber(area, 0)
  if (value <= 300) return toNumber(workRow?.цена_0_300, 0)
  if (value <= 600) return toNumber(workRow?.цена_300_600, 0)
  if (value <= 1000) return toNumber(workRow?.цена_600_1000, 0)
  if (value <= 3000) return toNumber(workRow?.цена_1000_3000, 0)
  if (value <= 6000) return toNumber(workRow?.цена_3000_6000, 0)
  if (value <= 15000) return toNumber(workRow?.цена_6000_15000, 0)
  if (value <= 30000) return toNumber(workRow?.цена_15000_30000, 0)
  return toNumber(workRow?.цена_более_30000, 0)
}

function buildScope(zone) {
  const scope = {
    S: toNumber(zone?.roofParams?.area),
    P: toNumber(zone?.roofParams?.perimeter),
    OD: toNumber(zone?.roofParams?.parapetDrains),
    ID: toNumber(zone?.roofParams?.innerDrains),
    A: toNumber(zone?.roofParams?.aerators),
    roof_area: toNumber(zone?.roofParams?.area),
    parapet_perimeter: toNumber(zone?.roofParams?.perimeter),
    outer_drains_count: toNumber(zone?.roofParams?.parapetDrains),
    inner_drains_count: toNumber(zone?.roofParams?.innerDrains),
    aerators_count: toNumber(zone?.roofParams?.aerators)
  }

  for (const [key, rawValue] of Object.entries(editableZone.value?.templateMeta?.paramValues || {})) {
    const number = Number(rawValue)
    if (Number.isFinite(number)) scope[key] = number
  }

  for (const param of zone?.customParams || []) {
    const symbol = `${param?.symbol || ''}`.trim()
    if (symbol) scope[symbol] = toNumber(param?.value, 0)
  }

  return scope
}

function recalculateZone() {
  if (!editableZone.value) return
  assignExcelCellCodesToSections(editableZone.value.sections || [])

  const scope = buildScope(editableZone.value)

  for (const section of editableZone.value.sections || []) {
    for (const work of section.works || []) {
      const found = findWorkByName(work.name)
      if (found) {
        work.itemCode = found.идентификатор
        work.unit = found.единица_измерения_работы || work.unit
        work.price = Number.isFinite(Number(work.price)) ? Number(work.price) : getWorkPriceByArea(found, editableZone.value?.roofParams?.area)
      }
      work.qty = evaluateExpression(work.expression, scope)
      work.total = round2(work.qty * toNumber(work.price))
      if (work.code) scope[work.code] = work.qty
      if (work.templateCode) scope[`${work.templateCode}`.trim().toUpperCase()] = work.qty
    }

    for (const material of section.materials || []) {
      const found = findMaterialByName(material.name || material.base_name)
      if (found) {
        material.itemCode = found.артикул_товара || found.идентификатор
        material.unit = found.единица_измерения || material.unit
        material.price = Number.isFinite(Number(material.price)) ? Number(material.price) : toNumber(found.базовая_цена, 0)
      }
      material.qty = evaluateExpression(material.expression, scope)
      material.total = round2(material.qty * toNumber(material.price))
      if (material.code) scope[material.code] = material.qty
      if (material.templateCode) scope[`${material.templateCode}`.trim().toUpperCase()] = material.qty
    }
  }
}

function addSection() {
  if (!editableZone.value) return
  editableZone.value.sections.push(createEmptySection(`Раздел ${editableZone.value.sections.length + 1}`))
  recalculateZone()
}

function removeSection(index) {
  editableZone.value.sections.splice(index, 1)
  if (!editableZone.value.sections.length) editableZone.value.sections.push(createEmptySection())
  recalculateZone()
}

function addWork(section) {
  const item = createEmptyWork()
  item.code = nextExcelCellCodeForSections(editableZone.value?.sections || [section])
  item.cellCode = item.code
  section.works.push(item)
  recalculateZone()
}

function addMaterial(section) {
  const item = createEmptyMaterial()
  item.code = nextExcelCellCodeForSections(editableZone.value?.sections || [section])
  item.cellCode = item.code
  section.materials.push(item)
  recalculateZone()
}

function removeWork(section, index) {
  section.works.splice(index, 1)
  recalculateZone()
}

function removeMaterial(section, index) {
  section.materials.splice(index, 1)
  recalculateZone()
}

function onWorkNameChange(payload, section) {
  const row = section.works[payload] || payload?.item || payload || null
  if (!row) return
  const found = findWorkByName(row.name)
  if (found) {
    row.itemCode = found.идентификатор
    row.name = found.наименование_работы
    row.unit = found.единица_измерения_работы || row.unit
    row.price = getWorkPriceByArea(found, editableZone.value?.roofParams?.area)
  }
  recalculateZone()
}

function onMaterialNameChange(payload, section) {
  const row = section.materials[payload] || payload?.item || payload || null
  if (!row) return
  const found = findMaterialByName(row.name)
  if (found) {
    row.itemCode = found.артикул_товара || found.идентификатор
    row.name = found.полное_наименование_материала
    row.unit = found.единица_измерения || row.unit
    row.price = toNumber(found.базовая_цена, row.price)
  }
  recalculateZone()
}

function getSectionTotal(section) {
  const works = (section.works || []).reduce((sum, item) => sum + round2(item.qty * item.price), 0)
  const materials = (section.materials || []).reduce((sum, item) => sum + round2(item.qty * item.price), 0)
  return round2(works + materials)
}

function openSettings() {
  isOptionsOpen.value = true
}

function handleOptionsContinue(keys) {
  selectedKeys.value = [...keys]
  isOptionsOpen.value = false
  isParamsOpen.value = true
}

function backToOptions() {
  isParamsOpen.value = false
  isOptionsOpen.value = true
}

async function handleParamsSubmit(values) {
  paramValues.value = sanitizeTemplateParamValues(selectedSystem.value, selectedKeys.value, values)
  isParamsOpen.value = false
  await rebuildFromEtalon()
}

async function rebuildFromEtalon() {
  if (!selectedSystem.value) return
  const estimate = await buildEstimateFromSystem(selectedSystem.value, selectedKeys.value, paramValues.value, { useDefaultOverride: false })
  editableZone.value = estimate.estimateZones?.[0] || createEmptyZone()
  editableZone.value.templateMeta = {
    ...(editableZone.value.templateMeta || {}),
    paramValues: { ...paramValues.value }
  }
  recalculateZone()
}

async function createCustomSystem() {
  if (!selectedSystem.value || !editableZone.value) return

  const suggestedName = `${selectedSystem.value.название} (моя система)`
  const newName = window.prompt('Название новой системы', suggestedName)?.trim()
  if (!newName) return

  const created = await systemRepository.createCustomSystemFromExisting({
    sourceSystemCode: selectedSystem.value.код,
    newName,
    overridePayload: {
      selectedKeys: [...selectedKeys.value],
      paramValues: { ...paramValues.value },
      sections: clone(editableZone.value.sections)
    }
  })

  await loadSystemsList()
  await openSystem(created?.code || created?.код || '')
  window.alert(`Создана новая система: ${created?.name || created?.название || newName}`)
}

async function saveOverride() {
  if (!selectedSystem.value || !editableZone.value) return

  await systemRepository.saveSystemDefaultOverride({
    systemCode: selectedSystem.value.код,
    title: selectedSystem.value.название,
    payload: {
      selectedKeys: [...selectedKeys.value],
      paramValues: { ...paramValues.value },
      sections: clone(editableZone.value.sections)
    }
  })

  window.alert('Основа системы сохранена.')
  await openSystem(selectedSystem.value.код)
}

async function resetOverride() {
  if (!selectedSystem.value) return
  if (!window.confirm('Сбросить сохранённую основу системы и вернуться к эталону?')) return
  await systemRepository.deleteSystemDefaultOverride(selectedSystem.value.код)
  await openSystem(selectedSystem.value.код)
}
</script>

<style scoped>
.system-editor-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.page-subtitle {
  margin: 0;
  color: var(--text-soft);
}

.layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 20px;
  min-height: calc(100vh - 180px);
}

.sidebar {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar-title {
  font-size: 18px;
  font-weight: 700;
}

.system-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.system-list-item {
  width: 100%;
  text-align: left;
  border: 1px solid var(--border-color);
  background: var(--surface-soft);
  border-radius: 12px;
  padding: 14px;
  cursor: pointer;
}

.system-list-item.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent) inset;
}

.system-list-name {
  font-weight: 700;
  color: var(--text-main);
}

.system-list-meta {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-soft);
}

.editor-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  flex-wrap: wrap;
}

.editor-title {
  margin: 0;
}

.editor-subtitle,
.editor-hint {
  margin-top: 6px;
  color: var(--text-soft);
}

.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.defaults-summary {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.zone-params-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.zone-params-title {
  font-weight: 700;
  color: var(--text-soft);
  text-transform: uppercase;
  font-size: 14px;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.calc-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-block {
  border-top: 1px solid var(--border-color);
  padding-top: 18px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}

.section-title-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
}

.section-total-row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
  font-weight: 700;
}

.add-section-row {
  display: flex;
  justify-content: center;
}

.empty-state {
  padding: 24px;
  color: var(--text-soft);
  text-align: center;
}

@media (max-width: 1280px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .params-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>