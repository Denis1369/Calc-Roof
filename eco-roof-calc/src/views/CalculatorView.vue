<template>
  <div class="calculator-view">
    <header class="page-header hide-on-print">
      <h1 class="ui-title">Коммерческая смета объекта</h1>
      <p class="page-subtitle">Сводный расчет с разбивкой по участкам и авто-подтягиванием цен из БД</p>
    </header>

    <section class="controls-panel page-card hide-on-print">
      <div class="db-controls-row">
        <div class="calc-group project-group">
          <label class="ui-label">Название проекта (для сохранения):</label>
          <input
            v-model="projectName"
            type="text"
            placeholder="Например: ТЦ Галактика, кровля"
            class="ui-input"
          />
        </div>

        <div class="calc-group vat-group">
          <label class="ui-label">НДС (%):</label>
          <input type="number" v-model.number="vatRate" min="0" max="100" class="ui-input" />
        </div>

        <div class="action-buttons">
          <button @click="saveProject" class="ui-btn ui-btn-success">💾 Сохранить</button>
          <button @click="loadProject" class="ui-btn ui-btn-primary">📂 Загрузить</button>
          <button @click="printEstimate" class="ui-btn ui-btn-secondary">🖨️ Печать</button>
        </div>
      </div>
    </section>

    <div class="estimate-body">
      <div class="document-header-text page-card">
        <strong>Общие суммарные данные по всем участкам:</strong><br />
        Суммарная площадь кровель =
        <span class="bold accent-text">{{ globalRoofParams.area.toFixed(2) }}</span> м2,<br />
        Примыкания к парапету и верт. конструкциям =
        <span class="bold accent-text">{{ globalRoofParams.perimeter.toFixed(2) }}</span> пог.м.,<br />
        Водоотведение парапетное = {{ globalRoofParams.parapetDrains }} шт.,<br />
        Водоотведение внутреннее = {{ globalRoofParams.innerDrains }} шт.,<br />
        Аэраторы = {{ globalRoofParams.aerators }} шт.
      </div>

      <div v-for="(zone, zIdx) in estimateZones" :key="zone.id" class="zone-block page-card">
        <div class="zone-header">
          <input v-model="zone.name" class="zone-title-input" placeholder="Название участка" />

          <div class="zone-header-actions hide-on-print">
            <button
              v-if="zone.templateMeta?.systemCode"
              @click="openEditPieModal(zone, zIdx)"
              class="ui-btn ui-btn-secondary zone-edit-btn"
              type="button"
            >
              ✏️ Редактировать пирог
            </button>

            <button
              @click="removeZone(zIdx)"
              class="btn-icon danger-text"
              title="Удалить участок"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="zone-params-block hide-on-print">
          <div class="zone-params-title">Ввод параметров для этого участка (для формул):</div>

          <div class="params-grid">
            <div class="calc-group">
              <label class="ui-label">Тип материалов</label>
              <select v-model="zone.supplierType" @change="applySupplierToZone(zone)" class="ui-select zone-supplier-select">
                <option value="ТехноНИКОЛЬ">ТехноНИКОЛЬ</option>
                <option value="Аналог">Аналог</option>
              </select>
            </div>

            <div class="calc-group">
              <label class="ui-label">Площадь (S, м²)</label>
              <input type="number" v-model.number="zone.roofParams.area" @input="recalculateVolumes" min="0" step="0.1" class="ui-input" />
            </div>

            <div class="calc-group">
              <label class="ui-label">Периметр (P, пог.м)</label>
              <input type="number" v-model.number="zone.roofParams.perimeter" @input="recalculateVolumes" min="0" step="0.1" class="ui-input" />
            </div>

            <div class="calc-group">
              <label class="ui-label">Водоотвод (шт)</label>
              <input type="number" v-model.number="zone.roofParams.parapetDrains" @input="recalculateVolumes" min="0" class="ui-input" />
            </div>

            <div class="calc-group">
              <label class="ui-label">Воронки (ID, шт)</label>
              <input type="number" v-model.number="zone.roofParams.innerDrains" @input="recalculateVolumes" min="0" class="ui-input" />
            </div>

            <div class="calc-group">
              <label class="ui-label">Аэраторы (A, шт)</label>
              <input type="number" v-model.number="zone.roofParams.aerators" @input="recalculateVolumes" min="0" class="ui-input" />
            </div>

            <div class="calc-group" v-for="(cp, pIdx) in zone.customParams" :key="'cp' + pIdx">
              <label class="ui-label custom-param-label">
                <span :title="cp.name">{{ cp.name }} ({{ cp.symbol }})</span>
                <span
                  @click="zone.customParams.splice(pIdx, 1); recalculateVolumes()"
                  class="remove-param"
                  title="Удалить переменную"
                >
                  ✕
                </span>
              </label>
              <input
                type="number"
                v-model.number="cp.value"
                @input="recalculateVolumes"
                min="0"
                step="0.1"
                class="ui-input custom-param-input"
              />
            </div>
          </div>

          <div class="add-param-row">
            <button @click="addCustomParam(zone)" class="btn-link-small">
              + Добавить свою переменную для формул
            </button>
          </div>
        </div>

        <div v-for="(section, sIdx) in zone.sections" :key="section.id" class="section-block">
          <div class="section-header">
            <input v-model="section.title" class="section-title-input" placeholder="Название раздела" />
            <button @click="removeSection(zone, sIdx)" class="btn-icon danger-text hide-on-print">✕</button>
          </div>

          <EstimateTable
            title="Работы:"
            type="work"
            :items="section.works"
            listId="works-list"
            @changeName="onWorkNameChange($event, section, zone)"
            @changeFormula="applyFormula"
            @recalculate="recalculateVolumes"
            @remove="section.works.splice($event, 1)"
            @add="addWork(section)"
          />

          <EstimateTable
            title="Материалы:"
            type="material"
            :items="section.materials"
            listId="materials-list"
            @changeName="onMaterialNameChange($event, section)"
            @changeFormula="applyFormula"
            @recalculate="recalculateVolumes"
            @remove="section.materials.splice($event, 1)"
            @add="addMaterial(section, zone)"
          />

          <div class="section-total-row">
            <span class="section-total-label">ИТОГО по Разделу:</span>
            <span class="section-total-value">
              {{ getSectionTotal(section).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽
            </span>
          </div>
        </div>

        <div class="add-section-row hide-on-print">
          <button @click="addSection(zone)" class="btn-outline">
            + Добавить раздел в этот участок
          </button>
        </div>
      </div>

      <div class="add-zone-row hide-on-print">
        <button @click="addZone" class="ui-btn ui-btn-primary btn-large">+ Добавить пустой участок</button>

        <div class="custom-dropdown" ref="dropdownRef">
          <button class="dropdown-toggle" @click="isTemplateDropdownOpen = !isTemplateDropdownOpen">
            <span>Или выберите готовую систему...</span>
            <span class="arrow" :class="{ 'arrow-up': isTemplateDropdownOpen }">▼</span>
          </button>

          <transition name="fade">
            <div class="dropdown-menu" v-if="isTemplateDropdownOpen">
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

      <section class="grand-totals page-card">
        <div class="summary-line">
          <span>Сумма по разделам (Монтажные работы):</span>
          <span class="bold">{{ grandTotalWorks.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
        </div>

        <div class="summary-line">
          <span>Сумма по разделам (Материалы):</span>
          <span class="bold">{{ grandTotalMaterials.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
        </div>

        <div class="expenses-block mt-4">
          <h3 class="expenses-title">Накладные, транспортные и утилизационные расходы:</h3>

          <table class="expenses-table">
            <tbody>
              <tr v-for="(exp, eIdx) in overheadExpenses" :key="eIdx">
                <td>
                  <input
                    v-model="exp.name"
                    list="works-list"
                    class="expense-input text-left"
                    placeholder="Название расхода"
                    autocomplete="off"
                  />
                </td>
                <td class="col-unit center">
                  <input v-model="exp.unit" class="expense-input center" />
                </td>
                <td class="col-qty right">
                  <input type="number" v-model.number="exp.qty" class="expense-input right" />
                </td>
                <td class="col-price right">
                  <input type="number" v-model.number="exp.price" class="expense-input right" />
                </td>
                <td class="col-sum right bold">
                  {{ (exp.qty * exp.price).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽
                </td>
                <td class="col-action center hide-on-print">
                  <button @click="overheadExpenses.splice(eIdx, 1)" class="btn-icon">🗑️</button>
                </td>
              </tr>
            </tbody>
          </table>

          <button @click="addExpense" class="btn-text-dashed hide-on-print mt-2">
            + Добавить накладной расход
          </button>

          <div class="subtotal-row mt-2">
            <span class="subtotal-label">Сумма накладных расходов:</span>
            <span class="subtotal-value">
              {{ totalExpenses.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽
            </span>
          </div>
        </div>

        <div class="totals-summary-block">
          <div class="summary-line highlight-line">
            <span>ИТОГО БЕЗ НДС:</span>
            <span class="bold">{{ subTotalWithoutVat.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
          </div>

          <div class="summary-line muted-line">
            <span>В том числе НДС ({{ vatRate }}%):</span>
            <span>{{ vatAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
          </div>

          <div class="final-grand-total">
            <span>ВСЕГО К ОПЛАТЕ (С НДС):</span>
            <span>{{ finalGrandTotalWithVat.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
          </div>
        </div>
      </section>
    </div>

    <TemplateOptionsModal
      :is-open="isEditOptionsOpen"
      :system="editPieSystem"
      :selected-keys="editPieSelectedKeys"
      title="Редактирование пирога · шаг 1"
      continue-label="Далее"
      cancel-label="Отмена"
      @close="closeEditFlow"
      @continue="handleEditOptionsContinue"
    />

    <TemplateParamsModal
      :is-open="isEditParamsOpen"
      :system="editPieSystem"
      :selected-keys="editPieSelectedKeys"
      :initial-values="editPieParamValues"
      title="Редактирование пирога · шаг 2"
      submit-label="Применить"
      back-label="Назад"
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
import { onMounted, onUnmounted, ref } from 'vue'
import { useCalculator } from '../composables/useCalculator.js'
import EstimateTable from '../components/EstimateTable.vue'
import TemplateOptionsModal from '../components/TemplateOptionsModal.vue'
import TemplateParamsModal from '../components/TemplateParamsModal.vue'
import { applyPendingGeneratedEstimate, buildEstimateFromSystem } from '../utils/templateEstimateBuilder'
import { getSystemTemplate } from '../application/systems/getSystemTemplate'
import { toSystemTemplateView } from '../shared/adapters/systemViewAdapter'

const {
  projectName,
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
  applySupplierToZone,
  globalRoofParams,
  loadDatabases,
  unloadDatabases,
  onWorkNameChange,
  onMaterialNameChange,
  applyFormula,
  recalculateVolumes,
  saveProject,
  loadProject,
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
  printEstimate
} = useCalculator()

const isEditOptionsOpen = ref(false)
const isEditParamsOpen = ref(false)
const editPieZoneIndex = ref(null)
const editPieSystem = ref(null)
const editPieSelectedKeys = ref([])
const editPieParamValues = ref({})

async function openEditPieModal(zone, zoneIndex) {
  const meta = zone?.templateMeta
  if (!meta?.systemCode) return

  const system = await getSystemTemplate(meta.systemCode)
  if (!system) return

  editPieSystem.value = toSystemTemplateView(system)
  editPieZoneIndex.value = zoneIndex
  editPieSelectedKeys.value = Array.isArray(meta.selectedKeys) ? [...meta.selectedKeys] : []
  editPieParamValues.value = { ...(meta.paramValues || {}) }
  isEditOptionsOpen.value = true
}

function closeEditFlow() {
  isEditOptionsOpen.value = false
  isEditParamsOpen.value = false
  editPieZoneIndex.value = null
  editPieSystem.value = null
  editPieSelectedKeys.value = []
  editPieParamValues.value = {}
}

function handleEditOptionsContinue(keys) {
  editPieSelectedKeys.value = [...keys]
  isEditOptionsOpen.value = false
  isEditParamsOpen.value = true
}

function backToEditOptions() {
  isEditParamsOpen.value = false
  isEditOptionsOpen.value = true
}

async function applyEditPieModal(values) {
  if (editPieZoneIndex.value === null || !editPieSystem.value) return

  editPieParamValues.value = { ...(values || {}) }

  const rebuilt = await buildEstimateFromSystem(
    editPieSystem.value,
    editPieSelectedKeys.value,
    editPieParamValues.value
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
}

onMounted(async () => {
  await loadDatabases()

  applyPendingGeneratedEstimate({
    projectName,
    vatRate,
    estimateZones,
    recalculateVolumes
  })
})

onUnmounted(() => {
  unloadDatabases()
})
</script>

<style scoped>
.calculator-view {
  max-width: 80%;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  margin-bottom: 24px;
}

.page-subtitle {
  text-align: center;
  color: var(--text-soft);
  margin-top: 10px;
  font-size: 15px;
}

.ui-title {
  text-align: center;
  text-transform: uppercase;
}

.controls-panel {
  padding: 20px;
  margin-bottom: 24px;
}

.db-controls-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 20px;
}

.project-group {
  flex: 3;
}

.vat-group {
  flex: 1;
  max-width: 150px;
}

.calc-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.estimate-body {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.document-header-text {
  padding: 20px;
  border-left: 5px solid var(--accent);
  font-size: 1.05rem;
  line-height: 1.7;
  border-radius: 0 12px 12px 0;
}

.accent-text {
  color: var(--accent);
  font-family: monospace;
  font-weight: 800;
}

.zone-block {
  overflow: hidden;
}

.zone-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-card-soft);
  padding: 14px 20px;
  gap: 15px;
  border-bottom: 1px solid var(--border-color);
}

.zone-title-input {
  flex: 1;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: #111827;
  font-size: 1.1rem;
  font-weight: 700;
  height: 42px;
  padding: 0 15px;
  border-radius: 8px;
  outline: none;
}

.zone-title-input:focus {
  border-color: var(--accent);
}

.zone-params-block {
  background: var(--bg-card-soft);
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.zone-params-title {
  font-weight: 700;
  margin-bottom: 14px;
  color: var(--text-soft);
  font-size: 0.9rem;
  text-transform: uppercase;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 18px;
  align-items: flex-start;
}

.zone-supplier-select {
  font-weight: 700;
}

.section-block {
  padding: 20px;
}

.section-header {
  margin-bottom: 18px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 10px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.section-title-input {
  font-size: 1.15rem;
  font-weight: 800;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0;
  background: transparent;
  width: 70%;
  color: var(--text-main);
  outline: none;
}

.section-title-input:focus {
  border-bottom-color: var(--accent);
}

.section-total-row {
  text-align: right;
  padding: 16px 0 0;
  font-size: 1.1rem;
  font-weight: 800;
  border-top: 1px solid var(--border-color);
  margin-top: 16px;
  color: var(--text-main);
}

.add-section-row {
  padding: 0 20px 20px;
}

.btn-outline {
  background: transparent;
  border: 2px dashed var(--accent);
  color: var(--accent);
  width: 100%;
  margin-top: 4px;
  padding: 12px 16px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
  font-size: 1rem;
}

.btn-outline:hover {
  background: var(--accent-soft);
}

.btn-icon {
  opacity: 0.75;
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

.danger-text {
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

.mt-2 {
  margin-top: 0.5rem;
}

.mt-4 {
  margin-top: 2rem;
}

.add-zone-row {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin: 8px 0 24px;
  align-items: center;
  flex-wrap: wrap;
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

.grand-totals {
  padding: 28px;
  border: 2px solid var(--accent);
}

.summary-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 1.05rem;
  gap: 16px;
}

.expenses-title {
  margin: 0 0 16px;
  color: var(--text-main);
}

.expenses-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
}

.expenses-table td {
  border: 1px solid var(--border-color);
  padding: 0;
  height: 45px;
  vertical-align: middle;
}

.expense-input {
  width: 100%;
  height: 44px;
  border: none;
  background: transparent;
  padding: 0 12px;
  box-sizing: border-box;
  color: var(--text-main);
  outline: none;
}

.expense-input:focus {
  background: var(--bg-hover);
  box-shadow: inset 0 0 0 2px var(--accent);
}

.col-unit {
  width: 80px;
}

.col-qty {
  width: 100px;
}

.col-price {
  width: 130px;
}

.col-sum {
  width: 150px;
}

.col-action {
  width: 50px;
  border: none !important;
}

.btn-text-dashed {
  background: transparent;
  border: 2px dashed var(--border-strong);
  color: var(--text-soft);
  font-weight: 700;
  cursor: pointer;
  padding: 10px 14px;
  font-size: 0.95rem;
  border-radius: 10px;
  display: block;
  width: 100%;
  text-align: center;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.btn-text-dashed:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
  color: var(--accent);
}

.subtotal-row {
  text-align: right;
  padding: 12px 0 0;
  border-top: 1px solid var(--border-color);
}

.subtotal-label {
  margin-right: 1rem;
  color: var(--text-soft);
}

.subtotal-value {
  font-weight: 700;
  min-width: 150px;
  display: inline-block;
  color: var(--text-main);
}

.totals-summary-block {
  background: var(--bg-card-soft);
  padding: 20px;
  border-radius: 12px;
  margin-top: 24px;
  border: 1px solid var(--border-color);
}

.highlight-line {
  border-top: 1px solid var(--border-color);
  padding-top: 18px;
  margin-top: 10px;
  font-size: 1.2rem;
  font-weight: 800;
}

.muted-line {
  color: var(--text-soft);
  font-size: 1rem;
}

.final-grand-total {
  display: flex;
  justify-content: space-between;
  font-size: 1.6rem;
  font-weight: 900;
  color: var(--accent);
  margin-top: 18px;
  padding-top: 18px;
  border-top: 2px solid var(--border-color);
  gap: 16px;
}

.add-param-row {
  margin-top: 14px;
  text-align: right;
}

.btn-link-small {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
  transition: color var(--transition-fast);
}

.btn-link-small:hover {
  color: var(--accent-hover);
}

.custom-param-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.remove-param {
  color: var(--danger);
  cursor: pointer;
  font-size: 0.9rem;
  margin-left: 5px;
}

.remove-param:hover {
  font-weight: 700;
}

@media (max-width: 900px) {
  .calculator-view {
    padding: 16px;
  }

  .db-controls-row {
    flex-direction: column;
    align-items: stretch;
  }

  .project-group,
  .vat-group {
    flex: none;
    max-width: none;
  }

  .action-buttons {
    width: 100%;
  }

  .action-buttons > * {
    flex: 1 1 auto;
  }

  .zone-header,
  .section-header {
    flex-direction: column;
    align-items: stretch;
  }

  .section-title-input {
    width: 100%;
  }

  .summary-line,
  .final-grand-total {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media print {
  .hide-on-print {
    display: none !important;
  }

  .calculator-view {
    padding: 0;
    max-width: 100%;
    color: #000;
    background: #fff;
  }

  .page-card,
  .zone-block,
  .grand-totals,
  .document-header-text,
  .totals-summary-block {
    background: #fff !important;
    color: #000 !important;
    box-shadow: none !important;
  }

  .zone-block {
    border: 2px solid #000 !important;
    margin-bottom: 20px;
    page-break-inside: avoid;
  }

  .zone-header {
    background: #eee !important;
    border-bottom: 2px solid #000 !important;
  }

  .zone-title-input,
  .section-title-input,
  .expense-input {
    color: #000 !important;
  }

  .expenses-table td {
    border: 1px solid #000 !important;
    color: #000 !important;
  }

  .final-grand-total {
    color: #000 !important;
    border-top: 4px solid #000 !important;
  }

  .totals-summary-block {
    border: none !important;
    padding: 0 !important;
    margin-top: 1rem !important;
  }

  .accent-text {
    color: #000 !important;
  }

  .grand-totals {
    border-color: #000 !important;
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

.zone-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.zone-edit-btn {
  white-space: nowrap;
}

</style>