<template>
  <div class="presets-page">
    <header class="page-header">
      <div class="page-step">Шаг 1</div>
      <h1 class="ui-title">Калькулятор плоской кровли</h1>
      <p class="page-subtitle">
        Выберите систему, уточните инженерные параметры и передайте готовую основу в смету с вашими расценками.
      </p>
    </header>

    <section v-if="savedPresets.length" class="saved-section page-card">
      <div class="saved-header">
        <div>
          <h2 class="section-title">Сохранённые конфигурации</h2>
          <p class="section-subtitle">Их можно открыть, уточнить и сразу отправить в инженерную смету</p>
        </div>
      </div>

      <div class="saved-grid">
        <div v-for="preset in savedPresets" :key="preset.id" class="saved-card ui-card-soft">
          <div class="saved-title">{{ preset.title || 'Без названия' }}</div>
          <div class="saved-meta">{{ resolveSystemName(preset.system_code) }}</div>
          <div class="saved-actions">
            <button class="ui-btn ui-btn-secondary mini-btn" @click="openPresetForEstimate(preset)">В смету</button>
            <button class="ui-btn ui-btn-secondary mini-btn" @click="editPreset(preset)">Редактировать</button>
            <button class="ui-btn ui-btn-danger mini-btn" @click="removePreset(preset)">Удалить</button>
          </div>
        </div>
      </div>
    </section>

    <div v-if="loading" class="loading-block ui-card-soft">Загрузка систем...</div>

    <div v-else class="systems-grid">
      <div
        v-for="(system, index) in systems"
        :key="system.идентификатор"
        class="system-card ui-card"
      >
        <div class="card-image-placeholder" :style="{ background: getGradient(index) }">
          <img v-if="system.превью" :src="system.превью" class="card-image" alt="" />
          <span v-else class="icon">{{ getIcon(system.название) }}</span>
        </div>

        <div class="card-content">
          <h3 class="system-title">{{ system.название }}</h3>
          <p class="system-desc">
            Основание: {{ getBaseLabel(system.тип_основания) }} · Гидроизоляция: {{ getHydroLabel(system.тип_гидроизоляции) }}
          </p>

          <div class="system-features">
            <span class="badge badge-accent">Система из справочника</span>
          </div>
        </div>

        <div class="card-footer">
          <div class="card-footer-actions">
            <button class="calculate-btn" @click.stop="openSystem(system)">Открыть для расчета ➔</button>
            <button class="edit-system-btn" @click.stop="editSystemBase(system)">Редактировать основу</button>
          </div>
        </div>
      </div>
    </div>

    <TemplateOptionsModal
      :is-open="isOptionsOpen"
      :system="selectedSystem"
      :selected-keys="selectedOptionKeys"
      :option-order="selectedOptionOrder"
      continue-label="Вперед"
      cancel-label="Назад на 1 шаг"
      @close="closeOptions"
      @order-change="handleOptionsOrderChange"
      @continue="handleOptionsContinue"
    />

    <TemplateParamsModal
      :is-open="isParamsOpen"
      :system="selectedSystem"
      :selected-keys="selectedOptionKeys"
      :initial-values="selectedParamValues"
      submit-label="Вперед"
      back-label="Назад на 1 шаг"
      save-preset-label="Сохранить"
      @close="closeParams"
      @back="backToOptions"
      @submit="handleParamsSubmit"
      @save-preset="handleSavePreset"
    />

    <PresetNameModal
      :is-open="isPresetNameOpen"
      :title="presetDraftTitle"
      @close="closePresetNameModal"
      @submit="submitPresetName"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePresets } from '@/modules/presets/usePresets'
import { buildEstimateFromSystem, storePendingGeneratedEstimate } from '@/modules/templates/buildEstimate'
import TemplateOptionsModal from '../components/TemplateOptionsModal.vue'
import TemplateParamsModal from '../components/TemplateParamsModal.vue'
import PresetNameModal from '../components/PresetNameModal.vue'
import * as templateEnhancements from '@/modules/templates/templateEnhancements'

const sanitizeParamValues = templateEnhancements.sanitizeParamValues || templateEnhancements.sanitizeTemplateParamValues || ((_system = {}, _selectedKeys = [], values = {}) => ({ ...(values || {}) }))

const router = useRouter()
const route = useRoute()
const LAST_SELECTIONS_KEY = 'eco-roof-last-system-selection-v1'
const GLOBAL_OPTION_ORDER_KEY = 'eco-roof-global-option-order-v1'

const {
  loading,
  systems,
  savedPresets,
  selectedSystem,
  loadSystems,
  selectSystem,
  loadSavedPresets,
  savePresetConfig,
  deletePresetConfig
} = usePresets()

const selectedOptionKeys = ref([])
const selectedOptionOrder = ref([])
const selectedParamValues = ref({})
const isOptionsOpen = ref(false)
const isParamsOpen = ref(false)
const isPresetNameOpen = ref(false)
const editingPresetId = ref(null)
const presetDraftTitle = ref('')

onMounted(async () => {
  await loadSystems()
  await loadSavedPresets()

  const initialSystemCode = `${route.query.system || ''}`
  if (initialSystemCode) {
    const system = systems.value.find((item) => `${item.код || item.code || ''}` === initialSystemCode)
    if (system) {
      await router.replace({ path: '/systems', query: {} })
      await openSystem(system)
    }
  }
})

function showActionError(message, error) {
  console.error(error)
  window.alert(message)
}

async function openSystem(system) {
  try {
    const fullSystem = await selectSystem(system.код || system.code)
    if (!fullSystem) return

    const lastSelection = loadLastSystemSelection(fullSystem.код || fullSystem.code)

    editingPresetId.value = null
    presetDraftTitle.value = ''
    selectedOptionKeys.value = Array.isArray(lastSelection?.selectedKeys)
      ? [...lastSelection.selectedKeys]
      : (fullSystem.опции || [])
        .filter((option) => option.default)
        .map((option) => option.key)
    selectedOptionOrder.value = Array.isArray(lastSelection?.optionOrder)
      ? [...lastSelection.optionOrder]
      : loadGlobalOptionOrder()
    selectedParamValues.value = { ...(lastSelection?.paramValues || {}) }
    isOptionsOpen.value = true
  } catch (error) {
    showActionError('Не удалось открыть систему для расчёта.', error)
  }
}

async function editPreset(preset) {
  try {
    const fullSystem = await selectSystem(preset.system_code)
    if (!fullSystem) return

    editingPresetId.value = preset.id
    presetDraftTitle.value = preset.title || ''
    selectedOptionKeys.value = Array.isArray(preset.selectedKeys) ? [...preset.selectedKeys] : []
    selectedOptionOrder.value = Array.isArray(preset.optionOrder)
      ? [...preset.optionOrder]
      : loadGlobalOptionOrder()
    selectedParamValues.value = { ...(preset.params || {}) }
    isOptionsOpen.value = true
  } catch (error) {
    showActionError('Не удалось открыть сохранённую конфигурацию.', error)
  }
}

async function openPresetForEstimate(preset) {
  try {
    const fullSystem = await selectSystem(preset.system_code)
    if (!fullSystem) return

    const selectedKeys = Array.isArray(preset.selectedKeys) ? [...preset.selectedKeys] : []
    const optionOrder = Array.isArray(preset.optionOrder) ? [...preset.optionOrder] : []
    const paramValues = sanitizeParamValues(fullSystem, selectedKeys, preset.params || {})

    const estimate = await buildEstimateFromSystem(fullSystem, selectedKeys, paramValues, { optionOrder })
    storePendingGeneratedEstimate(estimate)
    router.push('/calculator')
  } catch (error) {
    showActionError('Не удалось передать конфигурацию в смету.', error)
  }
}

async function removePreset(preset) {
  try {
    await deletePresetConfig(preset.id)
  } catch (error) {
    showActionError('Не удалось удалить сохранённую конфигурацию.', error)
  }
}

function closeOptions() {
  saveLastSystemSelection()
  isOptionsOpen.value = false
}

function closeParams() {
  isParamsOpen.value = false
}

function backToOptions() {
  isParamsOpen.value = false
  isOptionsOpen.value = true
}

function closePresetNameModal() {
  isPresetNameOpen.value = false
}

function handleOptionsOrderChange(order) {
  selectedOptionOrder.value = Array.isArray(order) ? [...order] : []
  saveGlobalOptionOrder(selectedOptionOrder.value)
  saveLastSystemSelection()
}

function handleOptionsContinue(keys, order = []) {
  if (Array.isArray(order) && order.length) {
    handleOptionsOrderChange(order)
  }
  selectedOptionKeys.value = [...keys]
  selectedParamValues.value = sanitizeParamValues(selectedSystem.value, selectedOptionKeys.value, selectedParamValues.value)
  saveLastSystemSelection()
  isOptionsOpen.value = false
  isParamsOpen.value = true
}

async function handleParamsSubmit(values) {
  try {
    if (!selectedSystem.value) return

    selectedParamValues.value = sanitizeParamValues(selectedSystem.value, selectedOptionKeys.value, values)
    saveLastSystemSelection()

    const estimate = await buildEstimateFromSystem(
      selectedSystem.value,
      selectedOptionKeys.value,
      selectedParamValues.value,
      { optionOrder: selectedOptionOrder.value }
    )

    storePendingGeneratedEstimate(estimate)
    isParamsOpen.value = false
    router.push('/calculator')
  } catch (error) {
    showActionError('Не удалось создать смету по выбранной системе.', error)
  }
}

function handleSavePreset(values) {
  selectedParamValues.value = sanitizeParamValues(selectedSystem.value, selectedOptionKeys.value, values)
  saveLastSystemSelection()
  isPresetNameOpen.value = true
}

function readLastSelectionsMap() {
  try {
    return JSON.parse(localStorage.getItem(LAST_SELECTIONS_KEY) || '{}')
  } catch {
    return {}
  }
}

function loadGlobalOptionOrder() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GLOBAL_OPTION_ORDER_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveGlobalOptionOrder(order = []) {
  if (!Array.isArray(order) || !order.length) return
  localStorage.setItem(GLOBAL_OPTION_ORDER_KEY, JSON.stringify(order))
}

function loadLastSystemSelection(systemCode) {
  const key = `${systemCode || ''}`
  if (!key) return null
  return readLastSelectionsMap()[key] || null
}

function saveLastSystemSelection() {
  const systemCode = selectedSystem.value?.код || selectedSystem.value?.code || ''
  if (!systemCode) return

  const selections = readLastSelectionsMap()
  selections[systemCode] = {
    selectedKeys: [...selectedOptionKeys.value],
    optionOrder: [...selectedOptionOrder.value],
    paramValues: { ...selectedParamValues.value }
  }
  localStorage.setItem(LAST_SELECTIONS_KEY, JSON.stringify(selections))
}

async function submitPresetName(title) {
  try {
    if (!selectedSystem.value) return

    const normalizedTitle = title || `${selectedSystem.value.название} ${new Date().toLocaleDateString('ru-RU')}`

    await savePresetConfig({
      id: editingPresetId.value,
      systemCode: selectedSystem.value.код || selectedSystem.value.code,
      title: normalizedTitle,
      params: selectedParamValues.value,
      features: {
        selectedKeys: [...selectedOptionKeys.value],
        optionOrder: [...selectedOptionOrder.value]
      }
    })

    presetDraftTitle.value = normalizedTitle
    isPresetNameOpen.value = false
  } catch (error) {
    showActionError('Не удалось сохранить конфигурацию.', error)
  }
}

function resolveSystemName(code) {
  return systems.value.find((item) => item.код === code)?.название || code || 'Система'
}

function editSystemBase(system) {
  router.push({ path: '/templates', query: { system: system.код || system.code } })
}

function getGradient(index) {
  const gradients = [
    'linear-gradient(135deg, #d9d9d9 0%, #f3f3f3 100%)',
    'linear-gradient(135deg, #e7e7e7 0%, #fafafa 100%)',
    'linear-gradient(135deg, #dedede 0%, #f4f4f4 100%)',
    'linear-gradient(135deg, #e3e3e3 0%, #ffffff 100%)'
  ]
  return gradients[index % gradients.length]
}

function getIcon(name) {
  if (`${name}`.toLowerCase().includes('pir')) return '🧱'
  if (`${name}`.toLowerCase().includes('смарт')) return '🏭'
  if (`${name}`.toLowerCase().includes('проф')) return '🏢'
  if (`${name}`.toLowerCase().includes('фикс')) return '🛠️'
  return '🏠'
}

function getBaseLabel(value) {
  const text = `${value || ''}`.toLowerCase()
  if (text.includes('prof') || text.includes('лист')) return 'Профлист'
  if (text.includes('proflist')) return 'Профлист'
  return 'Бетон / ЖБ'
}

function getHydroLabel(value) {
  const text = `${value || ''}`.toLowerCase()
  if (text.includes('pvc') || text.includes('пвх')) return 'ПВХ-мембрана'
  if (text.includes('brm') || text.includes('брм') || text.includes('битум')) return 'БРМ'
  return value || 'Не указано'
}
</script>

<style scoped>
.presets-page {
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

.page-step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.page-subtitle {
  color: var(--text-soft);
  margin: 0;
  max-width: 780px;
  text-align: center;
}

.saved-section {
  padding: 20px;
}

.saved-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.section-title {
  margin: 0;
}

.section-subtitle {
  margin: 6px 0 0;
  color: var(--text-soft);
}

.saved-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 420px));
  gap: 18px;
}

.systems-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
}

.saved-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.saved-title {
  font-weight: 700;
  color: var(--text-main);
}

.saved-meta {
  color: var(--text-soft);
  font-size: 14px;
}

.saved-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.loading-block {
  padding: 20px;
  text-align: center;
}

.system-card {
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), border-color var(--transition-fast);
}

.system-card:hover {
  transform: translateY(-8px);
  border-color: var(--accent);
  box-shadow: 0 12px 24px var(--shadow-color);
}

.card-image-placeholder {
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--border-color);
  overflow: hidden;
}

.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.icon {
  font-size: 72px;
  line-height: 1;
}

.card-content {
  padding: 20px;
  flex-grow: 1;
}

.system-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 12px;
  color: var(--text-main);
}

.system-desc {
  font-size: 14px;
  color: var(--text-soft);
  min-height: 44px;
  line-height: 1.45;
  margin: 0;
}

.system-features {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
}

.badge-accent {
  background: rgba(37, 99, 235, 0.1);
  color: var(--accent);
}

.card-footer {
  padding: 0 20px 20px;
}

.card-footer-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.calculate-btn,
.edit-system-btn,
.mini-btn {
  cursor: pointer;
}

.calculate-btn {
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 12px 14px;
  font-weight: 700;
  background: var(--accent);
  color: #fff;
}

.edit-system-btn {
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 10px 14px;
  font-weight: 700;
  background: var(--surface-soft);
  color: var(--text-main);
}
</style>
