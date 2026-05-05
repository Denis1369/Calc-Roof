<template>
  <div class="calculator-view">
    <EstimateActionsPanel
      :project-name="projectName"
      :contractor-profile="contractorProfile"
      :vat-rate="vatRate"
      @update:projectName="projectName = $event"
      @update:contractorProfile="contractorProfile = $event"
      @update:vatRate="vatRate = $event"
      @save="saveProject"
      @load="openProjectLoadModal"
      @exportProject="exportProjectFileAction"
      @importProject="openProjectImportDialog"
      @report="createReport"
      @xlsx="exportXlsx"
      @print="printEstimate"
    />

    <input
      ref="projectImportInput"
      type="file"
      accept=".roofcalc,.json,application/json"
      class="hidden-file-input"
      @change="handleProjectImportFile"
    />

    <Teleport to="body">
      <div v-if="isProjectLoadOpen" class="load-modal-overlay hide-on-print">
        <div class="load-modal-card page-card">
          <div class="load-modal-header">
            <div>
              <h3 class="load-modal-title">Загрузить сохранённый расчёт</h3>
              <p class="load-modal-subtitle">Выберите проект из базы. Текущая смета на экране будет заменена выбранной.</p>
            </div>
            <button class="load-modal-close" type="button" @click="closeProjectLoadModal">✕</button>
          </div>

          <div v-if="isProjectLoadLoading" class="load-modal-empty ui-card-soft">
            Загружаю список проектов...
          </div>

          <div v-else-if="!savedProjectsList.length" class="load-modal-empty ui-card-soft">
            В базе пока нет сохранённых проектов. Сначала нажмите «Сохранить».
          </div>

          <div v-else class="saved-projects-list">
            <button
              v-for="project in savedProjectsList"
              :key="project.id"
              class="saved-project-row ui-card-soft"
              type="button"
              @click="selectSavedProject(project)"
            >
              <span class="saved-project-main">
                <strong>{{ project.title || project.estimate?.projectName || 'Без названия' }}</strong>
                <span>ID {{ project.id }}</span>
              </span>
              <span class="saved-project-meta">{{ formatProjectDate(project.created_at) }}</span>
              <span class="saved-project-action">Открыть</span>
            </button>
          </div>

          <div class="load-modal-footer">
            <button class="ui-btn ui-btn-secondary" type="button" @click="closeProjectLoadModal">Отмена</button>
            <button class="ui-btn ui-btn-secondary" type="button" @click="openProjectLoadModal">Обновить список</button>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="estimate-body">
      <EstimateOverviewCard :roof-params="globalRoofParams" />

      <section class="estimate-search page-card hide-on-print">
        <div class="search-row">
          <div class="search-field">
            <label class="ui-label">Поиск по смете</label>
            <input
              v-model="estimateSearchQuery"
              class="ui-input"
              type="search"
              placeholder="Введите работу, материал, раздел или участок..."
            />
          </div>

          <div class="search-type">
            <label class="ui-label">Где искать</label>
            <select v-model="estimateSearchType" class="ui-select">
              <option value="all">Везде</option>
              <option value="work">Только работы</option>
              <option value="material">Только материалы</option>
            </select>
          </div>
        </div>

        <div v-if="estimateSearchQuery.trim()" class="search-results">
          <button
            v-for="result in estimateSearchResults"
            :key="result.key"
            type="button"
            class="search-result"
            @click="scrollToEstimateRow(result)"
          >
            <span class="result-type">{{ result.type === 'work' ? 'Работа' : 'Материал' }}</span>
            <span class="result-name">{{ result.name }}</span>
            <span class="result-path">{{ result.zoneName }} · {{ result.sectionTitle }}</span>
          </button>

          <div v-if="!estimateSearchResults.length" class="search-empty">
            Ничего не найдено по текущей смете.
          </div>
        </div>
      </section>

      <EstimateZoneCard
        v-for="(zone, zIdx) in estimateZones"
        :key="zone.id"
        :zone="zone"
        :zone-index="zIdx"
        :highlighted-row-id="highlightedSearchRowId"
        :get-section-total="getSectionTotal"
        @editPie="openEditPieModal"
        @editSystem="openSystemEditor"
        @removeZone="removeZone"
        @recalculate="recalculateVolumes"
        @changeWorkName="onWorkNameChange"
        @changeMaterialName="onMaterialNameChange"
        @changeFormula="applyFormula"
        @removeWork="removeWorkRow"
        @removeMaterial="removeMaterialRow"
        @addWork="addWork"
        @addMaterial="addMaterial"
        @removeSection="removeSection"
        @addSection="addSection"
        @addCustomParam="addCustomParam"
      />

      <div class="add-zone-row hide-on-print">
        <button @click="addZone" class="ui-btn ui-btn-primary btn-large">+ Добавить пустой участок</button>

        <div class="custom-dropdown" ref="dropdownRef">
          <button class="dropdown-toggle" @click="isTemplateDropdownOpen = !isTemplateDropdownOpen">
            <span>Или выберите готовую систему...</span>
            <span class="arrow" :class="{ 'arrow-up': isTemplateDropdownOpen }">▼</span>
          </button>

          <transition name="fade">
            <div v-if="isTemplateDropdownOpen" class="dropdown-menu">
              <div v-if="savedTemplatesDb.length === 0" class="dropdown-empty">Шаблоны не найдены</div>

              <div
                v-for="t in savedTemplatesDb"
                :key="t.идентификатор"
                class="dropdown-item"
                @click="selectTemplate(t.идентификатор)"
              >
                <span class="item-icon">📋</span>
                <span class="item-text">{{ t.название }}</span>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <EstimateTotalsCard
        :overhead-expenses="overheadExpenses"
        :works-db="worksDb"
        :pricing-area="globalRoofParams.area"
        :grand-total-works="grandTotalWorks"
        :grand-total-materials="grandTotalMaterials"
        :total-expenses="totalExpenses"
        :sub-total-without-vat="subTotalWithoutVat"
        :vat-amount="vatAmount"
        :final-grand-total-with-vat="finalGrandTotalWithVat"
        :vat-rate="vatRate"
        @addExpense="addExpense"
        @removeExpense="removeExpense"
      />

      <section class="bottom-actions page-card hide-on-print">
        <div>
          <h3 class="bottom-actions-title">Сохранение и выгрузка</h3>
          <p class="bottom-actions-text">
            Главные действия продублированы здесь, чтобы не возвращаться наверх после длинной сметы.
          </p>
        </div>

        <div class="bottom-actions-buttons">
          <button @click="saveProject" class="ui-btn ui-btn-success">Сохранить</button>
          <button @click="openProjectLoadModal" class="ui-btn ui-btn-primary">Загрузить из базы</button>
          <button @click="exportProjectFileAction" class="ui-btn ui-btn-secondary">Сохранить файлом</button>
          <button @click="openProjectImportDialog" class="ui-btn ui-btn-secondary">Открыть файл</button>
          <button @click="createReport" class="ui-btn ui-btn-primary">Создать отчет</button>
          <button @click="exportXlsx" class="ui-btn ui-btn-primary">Выгрузить XLSX</button>
          <button @click="scrollToTop" class="ui-btn ui-btn-secondary">Наверх</button>
        </div>
      </section>
    </div>

    <TemplateOptionsModal
      :is-open="isEditOptionsOpen"
      :system="editPieSystem"
      :selected-keys="editPieSelectedKeys"
      :option-order="editPieOptionOrder"
      title="Редактирование пирога · шаг 1"
      continue-label="Вперед"
      cancel-label="Назад на 1 шаг"
      @close="closeEditFlow"
      @order-change="handleEditOptionsOrderChange"
      @continue="handleEditOptionsContinue"
    />

    <TemplateParamsModal
      :is-open="isEditParamsOpen"
      :system="editPieSystem"
      :selected-keys="editPieSelectedKeys"
      :initial-values="editPieParamValues"
      title="Редактирование пирога · шаг 2"
      submit-label="Применить"
      back-label="Назад на 1 шаг"
      @close="closeEditFlow"
      @back="backToEditOptions"
      @submit="applyEditPieModal"
    />

    <datalist id="works-list">
      <option v-for="w in worksDb" :key="w.идентификатор" :value="w.наименование_работы"></option>
    </datalist>

    <datalist id="materials-list">
      <option v-for="m in materialsDb" :key="m.идентификатор" :value="m.полное_наименование_материала"></option>
    </datalist>

    <datalist id="formulas-list">
      <option v-for="f in formulasDb" :key="f.идентификатор" :value="f.название_формулы">
        {{ f.выражение }}
      </option>
    </datalist>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import TemplateOptionsModal from '@/components/TemplateOptionsModal.vue'
import TemplateParamsModal from '@/components/TemplateParamsModal.vue'
import { toSystemTemplateView } from '@/core/adapters/viewAdapters'
import { getSystemTemplate } from '@/core/services/dataApi'
import EstimateActionsPanel from '@/features/estimate/components/EstimateActionsPanel.vue'
import EstimateOverviewCard from '@/features/estimate/components/EstimateOverviewCard.vue'
import EstimateTotalsCard from '@/features/estimate/components/EstimateTotalsCard.vue'
import EstimateZoneCard from '@/features/estimate/components/EstimateZoneCard.vue'
import { useCalculator } from '@/modules/calculator/useCalculator'
import { applyPendingGeneratedEstimate, buildEstimateFromSystem } from '@/modules/templates/buildEstimate'

const router = useRouter()
const CALCULATOR_DRAFT_KEY = 'eco-roof-calculator-draft-v1'

const {
  projectName,
  contractorProfile,
  vatRate,
  estimateZones,
  overheadExpenses,
  worksDb,
  materialsDb,
  formulasDb,
  savedTemplatesDb,
  isTemplateDropdownOpen,
  dropdownRef,
  selectTemplate,
  globalRoofParams,
  loadDatabases,
  unloadDatabases,
  onWorkNameChange,
  onMaterialNameChange,
  applyFormula,
  recalculateVolumes,
  saveProject,
  getSavedProjects,
  loadProjectById,
  getCurrentEditableProjectPayload,
  restoreProjectPayload,
  exportProjectFile,
  importProjectFile,
  addZone,
  removeZone,
  addSection,
  removeSection,
  addWork,
  addMaterial,
  addExpense,
  addCustomParam,
  getSectionTotal,
  grandTotalWorks,
  grandTotalMaterials,
  totalExpenses,
  subTotalWithoutVat,
  vatAmount,
  finalGrandTotalWithVat,
  createReport: generateSmartPirReport,
  exportReportXlsx: generateSmartPirReportXlsx,
  printEstimate
} = useCalculator()

const isEditOptionsOpen = ref(false)
const isEditParamsOpen = ref(false)
const editPieZoneIndex = ref(null)
const editPieSystem = ref(null)
const editPieSelectedKeys = ref([])
const editPieOptionOrder = ref([])
const editPieParamValues = ref({})
const estimateSearchQuery = ref('')
const estimateSearchType = ref('all')
const highlightedSearchRowId = ref('')
const projectImportInput = ref(null)
const isProjectLoadOpen = ref(false)
const isProjectLoadLoading = ref(false)
const savedProjectsList = ref([])
const isDraftAutosaveReady = ref(false)
let draftSaveTimer = null

const estimateSearchResults = computed(() => {
  const query = normalizeSearchText(estimateSearchQuery.value)
  if (!query) return []

  const tokens = query.split(' ').filter(Boolean)
  const results = []

  for (const zone of estimateZones.value || []) {
    for (const section of zone.sections || []) {
      for (const item of section.works || []) {
        pushSearchResult(results, { type: 'work', item, zone, section, tokens })
      }

      for (const item of section.materials || []) {
        pushSearchResult(results, { type: 'material', item, zone, section, tokens })
      }
    }
  }

  return results.slice(0, 40)
})

function showActionError(message, error) {
  console.error(error)
  window.alert(message)
}

function normalizeSearchText(value) {
  return `${value || ''}`.toLowerCase().replace(/\s+/g, ' ').trim()
}

function pushSearchResult(results, { type, item, zone, section, tokens }) {
  if (estimateSearchType.value !== 'all' && estimateSearchType.value !== type) return

  const haystack = normalizeSearchText([
    item?.name,
    item?.code,
    item?.itemCode,
    item?.unit,
    section?.title,
    zone?.name
  ].filter(Boolean).join(' '))

  if (!tokens.every((token) => haystack.includes(token))) return

  const rowId = `${item?.id || item?.key || item?.code || ''}`
  if (!rowId) return

  results.push({
    key: `${type}-${rowId}`,
    type,
    rowId,
    name: item?.name || 'Без названия',
    zoneName: zone?.name || 'Участок',
    sectionTitle: section?.title || 'Раздел'
  })
}

function scrollToEstimateRow(result) {
  highlightedSearchRowId.value = result.rowId
  const rowId = `${result.rowId}`.replace(/"/g, '\\"')
  const el = document.querySelector(`[data-estimate-row-id="${rowId}"]`)

  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function createReport() {
  const html = generateSmartPirReport()
  if (!html) {
    window.alert('Не удалось сформировать отчёт.')
    return
  }

  router.push('/report/smartpir')
}

async function exportXlsx() {
  try {
    const savedPath = await generateSmartPirReportXlsx()
    if (savedPath) {
      window.alert(`XLSX выгружен: ${savedPath}`)
    }
  } catch (error) {
    console.error(error)
    window.alert('Не удалось экспортировать XLSX-отчёт.')
  }
}

async function exportProjectFileAction() {
  const savedPath = await exportProjectFile()
  if (savedPath) {
    window.alert(`Файл расчёта сохранён: ${savedPath}\n\nЕго можно открыть на другом ПК через кнопку «Открыть файл».`)
  }
}

async function openProjectLoadModal() {
  isProjectLoadOpen.value = true
  isProjectLoadLoading.value = true

  try {
    savedProjectsList.value = await getSavedProjects()
  } catch (error) {
    showActionError('Не удалось получить список сохранённых проектов.', error)
    savedProjectsList.value = []
    isProjectLoadOpen.value = false
  } finally {
    isProjectLoadLoading.value = false
  }
}

function closeProjectLoadModal() {
  isProjectLoadOpen.value = false
}

async function selectSavedProject(project) {
  if (!project?.id) return

  try {
    const normalized = await loadProjectById(project.id)
    closeProjectLoadModal()
    window.alert(`Загружен проект: ${normalized.projectName}`)
  } catch (error) {
    showActionError('Не удалось загрузить выбранный проект.', error)
  }
}

function formatProjectDate(value) {
  if (!value) return 'Дата не указана'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return `${value}`

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function cloneForDraft(value) {
  return JSON.parse(JSON.stringify(value))
}

function buildDraftPayload() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    estimate: cloneForDraft(getCurrentEditableProjectPayload())
  }
}

function saveCalculatorDraftNow() {
  if (!isDraftAutosaveReady.value) return

  try {
    localStorage.setItem(CALCULATOR_DRAFT_KEY, JSON.stringify(buildDraftPayload()))
  } catch (error) {
    console.warn('Не удалось сохранить черновик расчёта.', error)
  }
}

function scheduleCalculatorDraftSave() {
  if (!isDraftAutosaveReady.value) return

  clearTimeout(draftSaveTimer)
  draftSaveTimer = setTimeout(saveCalculatorDraftNow, 350)
}

function restoreCalculatorDraft() {
  try {
    const raw = localStorage.getItem(CALCULATOR_DRAFT_KEY)
    if (!raw) return false

    const parsed = JSON.parse(raw)
    const estimate = parsed?.estimate || parsed
    if (!estimate) return false

    restoreProjectPayload(estimate)
    return true
  } catch (error) {
    console.warn('Не удалось восстановить черновик расчёта.', error)
    localStorage.removeItem(CALCULATOR_DRAFT_KEY)
    return false
  }
}

function openProjectImportDialog() {
  projectImportInput.value?.click()
}

async function handleProjectImportFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  const loadedName = await importProjectFile(file)
  if (loadedName) {
    window.alert(`Расчёт открыт: ${loadedName}`)
  }
}

async function openEditPieModal(zone, zoneIndex) {
  try {
    const meta = zone?.templateMeta
    if (!meta?.systemCode) return

    const system = await getSystemTemplate(meta.systemCode)
    if (!system) return

    editPieSystem.value = toSystemTemplateView(system)
    editPieZoneIndex.value = zoneIndex
    editPieSelectedKeys.value = Array.isArray(meta.selectedKeys) ? [...meta.selectedKeys] : []
    editPieOptionOrder.value = Array.isArray(meta.optionOrder) ? [...meta.optionOrder] : [...editPieSelectedKeys.value]
    editPieParamValues.value = { ...(meta.paramValues || {}) }
    isEditOptionsOpen.value = true
  } catch (error) {
    showActionError('Не удалось открыть редактирование пирога.', error)
  }
}

function openSystemEditor(systemCode) {
  if (!systemCode) return
  router.push({ path: '/templates', query: { system: systemCode } })
}

function removeWorkRow(section, index) {
  section.works.splice(index, 1)
  recalculateVolumes()
}

function removeMaterialRow(section, index) {
  section.materials.splice(index, 1)
  recalculateVolumes()
}

function removeExpense(index) {
  overheadExpenses.value.splice(index, 1)
}

function closeEditFlow() {
  isEditOptionsOpen.value = false
  isEditParamsOpen.value = false
  editPieZoneIndex.value = null
  editPieSystem.value = null
  editPieSelectedKeys.value = []
  editPieOptionOrder.value = []
  editPieParamValues.value = {}
}

function handleEditOptionsOrderChange(order) {
  editPieOptionOrder.value = Array.isArray(order) ? [...order] : []
}

function handleEditOptionsContinue(keys, order = []) {
  if (Array.isArray(order) && order.length) {
    handleEditOptionsOrderChange(order)
  }
  editPieSelectedKeys.value = [...keys]
  isEditOptionsOpen.value = false
  isEditParamsOpen.value = true
}

function backToEditOptions() {
  isEditParamsOpen.value = false
  isEditOptionsOpen.value = true
}

async function applyEditPieModal(values) {
  try {
    if (editPieZoneIndex.value === null || !editPieSystem.value) return

    editPieParamValues.value = { ...(values || {}) }

    const rebuilt = await buildEstimateFromSystem(
      editPieSystem.value,
      editPieSelectedKeys.value,
      editPieParamValues.value,
      { optionOrder: editPieOptionOrder.value }
    )

    const newZone = rebuilt?.estimateZones?.[0]
    if (!newZone) {
      closeEditFlow()
      return
    }

    const currentZone = estimateZones.value[editPieZoneIndex.value]
    if (!currentZone) {
      closeEditFlow()
      return
    }

    currentZone.sections = newZone.sections || []
    currentZone.roofParams = newZone.roofParams || currentZone.roofParams
    currentZone.customParams = newZone.customParams || []
    currentZone.templateMeta = newZone.templateMeta || null

    if (!currentZone.name || currentZone.name.startsWith('Монтаж системы:')) {
      currentZone.name = newZone.name || currentZone.name
    }

    recalculateVolumes()
    closeEditFlow()
  } catch (error) {
    showActionError('Не удалось применить изменения пирога.', error)
  }
}

watch(
  () => [
    projectName.value,
    contractorProfile.value,
    vatRate.value,
    estimateZones.value,
    overheadExpenses.value
  ],
  scheduleCalculatorDraftSave,
  { deep: true }
)

onMounted(async () => {
  await loadDatabases()

  const appliedPendingEstimate = applyPendingGeneratedEstimate({
    projectName,
    contractorProfile,
    vatRate,
    estimateZones,
    overheadExpenses,
    recalculateVolumes
  })

  if (!appliedPendingEstimate) {
    restoreCalculatorDraft()
  }

  recalculateVolumes()
  isDraftAutosaveReady.value = true
  saveCalculatorDraftNow()
})

onUnmounted(() => {
  clearTimeout(draftSaveTimer)
  saveCalculatorDraftNow()
  unloadDatabases()
})
</script>

<style scoped>
.calculator-view {
  max-width: 1440px;
  margin: 0 auto;
  padding: 20px;
}

.hidden-file-input {
  display: none;
}

.load-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.45);
}

.load-modal-card {
  width: min(760px, 100%);
  max-height: calc(100vh - 40px);
  overflow: auto;
  padding: 20px;
}

.load-modal-header,
.load-modal-footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.load-modal-header {
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-color);
}

.load-modal-title {
  margin: 0;
  color: var(--text-main);
  font-size: 22px;
}

.load-modal-subtitle {
  margin: 6px 0 0;
  color: var(--text-soft);
}

.load-modal-close {
  border: none;
  background: transparent;
  color: var(--text-soft);
  font-size: 22px;
  cursor: pointer;
}

.load-modal-empty {
  padding: 18px;
  color: var(--text-soft);
}

.saved-projects-list {
  display: grid;
  gap: 10px;
  max-height: 52vh;
  overflow: auto;
}

.saved-project-row {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 14px;
  align-items: center;
  border: 1px solid var(--border-color);
  padding: 14px;
  color: var(--text-main);
  text-align: left;
  cursor: pointer;
}

.saved-project-row:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
}

.saved-project-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.saved-project-main strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saved-project-main span,
.saved-project-meta {
  color: var(--text-soft);
  font-size: 13px;
}

.saved-project-action {
  color: var(--accent);
  font-weight: 800;
}

.load-modal-footer {
  margin-top: 16px;
  justify-content: flex-end;
  padding-top: 14px;
  border-top: 1px solid var(--border-color);
}

.estimate-body {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.estimate-search {
  padding: 18px;
}

.search-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 14px;
  align-items: end;
}

.search-field,
.search-type {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.search-results {
  margin-top: 14px;
  display: grid;
  gap: 8px;
  max-height: 260px;
  overflow: auto;
}

.search-result {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) minmax(180px, 0.55fr);
  gap: 10px;
  align-items: center;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--surface-soft);
  color: var(--text-main);
  padding: 10px 12px;
  cursor: pointer;
  text-align: left;
}

.search-result:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
}

.result-type {
  color: var(--accent);
  font-weight: 800;
  font-size: 12px;
  text-transform: uppercase;
}

.result-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}

.result-path,
.search-empty {
  color: var(--text-soft);
  font-size: 13px;
}

.search-empty {
  padding: 12px;
}

.add-zone-row {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin: 8px 0 24px;
  align-items: center;
  flex-wrap: wrap;
}

.bottom-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  padding: 20px;
  border: 2px solid var(--accent);
}

.bottom-actions-title {
  margin: 0 0 6px;
  color: var(--text-main);
}

.bottom-actions-text {
  margin: 0;
  color: var(--text-soft);
}

.bottom-actions-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.btn-large {
  padding: 14px 28px;
  font-size: 1.05rem;
  border-radius: 999px;
  height: auto;
}

.custom-dropdown {
  position: relative;
  width: 380px;
  max-width: 100%;
}

.dropdown-toggle {
  width: 100%;
  padding: 14px 18px;
  border-radius: 999px;
  border: 2px solid var(--accent);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  background-color: var(--bg-card);
  color: var(--accent);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.dropdown-toggle:hover {
  background-color: var(--accent-soft);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  width: 100%;
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: 0 10px 30px var(--shadow-color);
  border: 1px solid var(--border-color);
  z-index: 100;
  max-height: 350px;
  overflow-y: auto;
  padding: 8px 0;
}

.dropdown-item {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  color: var(--text-main);
  font-weight: 600;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.dropdown-item:hover {
  background: var(--bg-hover);
  color: var(--accent);
}

.dropdown-empty {
  padding: 12px 20px;
  color: var(--text-soft);
  text-align: center;
  font-style: italic;
}

.arrow {
  font-size: 0.8rem;
  transition: transform 0.3s ease;
}

.arrow-up {
  transform: rotate(180deg);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (max-width: 900px) {
  .calculator-view {
    padding: 16px;
  }

  .search-row,
  .search-result,
  .saved-project-row {
    grid-template-columns: 1fr;
  }

  .bottom-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .bottom-actions-buttons {
    justify-content: stretch;
  }

  .bottom-actions-buttons > * {
    flex: 1 1 auto;
  }
}

@media print {
  .calculator-view {
    padding: 0;
    max-width: 100%;
    color: #000;
    background: #fff;
  }

  :deep(.page-card),
  :deep(.zone-block),
  :deep(.grand-totals),
  :deep(.document-header-text),
  :deep(.totals-summary-block) {
    background: #fff !important;
    color: #000 !important;
    box-shadow: none !important;
  }

  :deep(.zone-block) {
    border: 2px solid #000 !important;
    margin-bottom: 20px;
    page-break-inside: avoid;
  }

  :deep(.zone-header) {
    background: #eee !important;
    border-bottom: 2px solid #000 !important;
  }

  :deep(.zone-title-input),
  :deep(.section-title-input),
  :deep(.expense-input) {
    color: #000 !important;
  }

  :deep(.expenses-table td) {
    border: 1px solid #000 !important;
    color: #000 !important;
  }

  :deep(.final-grand-total) {
    color: #000 !important;
    border-top: 4px solid #000 !important;
  }

  :deep(.totals-summary-block) {
    border: none !important;
    padding: 0 !important;
    margin-top: 1rem !important;
  }

  :deep(.accent-text) {
    color: #000 !important;
  }

  :deep(.grand-totals) {
    border-color: #000 !important;
  }
}
</style>
