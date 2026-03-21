<template>
  <div class="presets-page">
    <header class="page-header">
      <h1 class="ui-title">Выбор кровельной системы</h1>
      <p class="page-subtitle">Выберите готовую систему, отредактируйте параметры и при необходимости сохраните пресет</p>
    </header>

    <section v-if="savedPresets.length" class="saved-section page-card">
      <div class="saved-header">
        <div>
          <h2 class="section-title">Сохранённые пресеты</h2>
          <p class="section-subtitle">Их можно открыть, изменить и сразу отправить в смету</p>
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
        @click="openSystem(system)"
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
          <button class="calculate-btn">Выбрать систему ➔</button>
        </div>
      </div>
    </div>

    <TemplateOptionsModal
      :is-open="isOptionsOpen"
      :system="selectedSystem"
      :selected-keys="selectedOptionKeys"
      @close="closeOptions"
      @continue="handleOptionsContinue"
    />

    <TemplateParamsModal
      :is-open="isParamsOpen"
      :system="selectedSystem"
      :selected-keys="selectedOptionKeys"
      :initial-values="selectedParamValues"
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
import { useRouter } from 'vue-router'
import { usePresetsFacade } from '../features/presets/usePresetsFacade'
import { buildEstimateFromSystem, storePendingGeneratedEstimate } from '../utils/templateEstimateBuilder'
import TemplateOptionsModal from '../components/TemplateOptionsModal.vue'
import TemplateParamsModal from '../components/TemplateParamsModal.vue'
import PresetNameModal from '../components/PresetNameModal.vue'
import * as templateEnhancements from '../shared/templateSystemEnhancements'

const sanitizeParamValues = templateEnhancements.sanitizeParamValues || templateEnhancements.sanitizeTemplateParamValues || ((_system = {}, _selectedKeys = [], values = {}) => ({ ...(values || {}) }))

const router = useRouter()

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
} = usePresetsFacade()

const selectedOptionKeys = ref([])
const selectedParamValues = ref({})
const isOptionsOpen = ref(false)
const isParamsOpen = ref(false)
const isPresetNameOpen = ref(false)
const editingPresetId = ref(null)
const presetDraftTitle = ref('')

onMounted(async () => {
  await loadSystems()
  await loadSavedPresets()
})

async function openSystem(system) {
  const fullSystem = await selectSystem(system.код || system.code)
  if (!fullSystem) return

  editingPresetId.value = null
  presetDraftTitle.value = ''
  selectedOptionKeys.value = (fullSystem.опции || [])
    .filter((option) => option.default)
    .map((option) => option.key)
  selectedParamValues.value = {}
  isOptionsOpen.value = true
}

async function editPreset(preset) {
  const fullSystem = await selectSystem(preset.system_code)
  if (!fullSystem) return

  editingPresetId.value = preset.id
  presetDraftTitle.value = preset.title || ''
  selectedOptionKeys.value = Array.isArray(preset.selectedKeys) ? [...preset.selectedKeys] : []
  selectedParamValues.value = { ...(preset.params || {}) }
  isOptionsOpen.value = true
}

async function openPresetForEstimate(preset) {
  const fullSystem = await selectSystem(preset.system_code)
  if (!fullSystem) return

  const selectedKeys = Array.isArray(preset.selectedKeys) ? [...preset.selectedKeys] : []
  const paramValues = sanitizeParamValues(fullSystem, selectedKeys, preset.params || {})

  const estimate = await buildEstimateFromSystem(fullSystem, selectedKeys, paramValues)
  storePendingGeneratedEstimate(estimate)
  router.push('/calculator')
}

async function removePreset(preset) {
  await deletePresetConfig(preset.id)
}

function closeOptions() {
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

function handleOptionsContinue(keys) {
  selectedOptionKeys.value = [...keys]
  selectedParamValues.value = sanitizeParamValues(selectedSystem.value, selectedOptionKeys.value, selectedParamValues.value)
  isOptionsOpen.value = false
  isParamsOpen.value = true
}

async function handleParamsSubmit(values) {
  if (!selectedSystem.value) return

  selectedParamValues.value = sanitizeParamValues(selectedSystem.value, selectedOptionKeys.value, values)

  const estimate = await buildEstimateFromSystem(
    selectedSystem.value,
    selectedOptionKeys.value,
    selectedParamValues.value
  )

  storePendingGeneratedEstimate(estimate)
  isParamsOpen.value = false
  router.push('/calculator')
}

function handleSavePreset(values) {
  selectedParamValues.value = sanitizeParamValues(selectedSystem.value, selectedOptionKeys.value, values)
  isPresetNameOpen.value = true
}

async function submitPresetName(title) {
  if (!selectedSystem.value) return

  const normalizedTitle = title || `${selectedSystem.value.название} ${new Date().toLocaleDateString('ru-RU')}`

  await savePresetConfig({
    id: editingPresetId.value,
    systemCode: selectedSystem.value.код || selectedSystem.value.code,
    title: normalizedTitle,
    params: selectedParamValues.value,
    features: {
      selectedKeys: [...selectedOptionKeys.value]
    }
  })

  presetDraftTitle.value = normalizedTitle
  isPresetNameOpen.value = false
}

function resolveSystemName(code) {
  return systems.value.find((item) => item.код === code)?.название || code || 'Система'
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

.page-subtitle {
  color: var(--text-soft);
  margin: 0;
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

.saved-grid,
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

.calculate-btn,
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
</style>
