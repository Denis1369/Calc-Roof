<template>
  <div class="presets-page">
    <header class="page-header">
      <h1 class="ui-title">Выбор кровельной системы</h1>
      <p class="page-subtitle">Выберите готовую систему и сформируйте смету в несколько шагов</p>
    </header>

    <div v-if="loading" class="loading-block ui-card-soft">Загрузка систем...</div>

    <div v-else class="systems-grid">
      <div
        v-for="(system, index) in systems"
        :key="system.идентификатор"
        class="system-card ui-card"
        @click="openSystem(system)"
      >
        <div class="card-image-placeholder" :style="{ background: getGradient(index) }">
          <img
            v-if="system.превью"
            :src="system.превью"
            class="card-image"
            alt=""
          />
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

const router = useRouter()

const {
  loading,
  systems,
  selectedSystem,
  loadSystems,
  selectSystem
} = usePresetsFacade()

const selectedOptionKeys = ref([])
const selectedParamValues = ref({})

const isOptionsOpen = ref(false)
const isParamsOpen = ref(false)

onMounted(loadSystems)

async function openSystem(system) {
  const fullSystem = await selectSystem(system.код || system.code)
  if (!fullSystem) return

  selectedOptionKeys.value = (fullSystem.опции || [])
    .filter((option) => option.default)
    .map((option) => option.key)

  selectedParamValues.value = {}
  isOptionsOpen.value = true
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

function handleOptionsContinue(keys) {
  selectedOptionKeys.value = [...keys]
  isOptionsOpen.value = false
  isParamsOpen.value = true
}

async function handleParamsSubmit(values) {
  if (!selectedSystem.value) return

  selectedParamValues.value = { ...values }

  const estimate = await buildEstimateFromSystem(
    selectedSystem.value,
    selectedOptionKeys.value,
    selectedParamValues.value
  )

  storePendingGeneratedEstimate(estimate)
  isParamsOpen.value = false
  router.push('/calculator')
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
  if (text.includes('brm') || text.includes('бит')) return 'БРМ'
  return 'ПВХ'
}
</script>

<style scoped>
.presets-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  text-align: center;
  margin-bottom: 32px;
}

.page-subtitle {
  margin: 10px 0 0;
  color: var(--text-soft);
  font-size: 15px;
}

.loading-block {
  padding: 24px;
  text-align: center;
  color: var(--text-soft);
}

.systems-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
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
  font-size: 12px;
  font-weight: 700;
  padding: 7px 10px;
  border-radius: 8px;
  display: inline-block;
  width: fit-content;
}

.badge-accent {
  background: var(--accent-soft);
  color: var(--accent);
  border: 1px solid var(--accent);
}

.card-footer {
  padding: 14px 20px;
  background: var(--bg-card-soft);
  border-top: 1px solid var(--border-color);
}

.calculate-btn {
  width: 100%;
  background: none;
  border: none;
  color: var(--accent);
  font-weight: 700;
  cursor: pointer;
  text-align: right;
  transition: color var(--transition-fast);
  font-size: 15px;
}

.system-card:hover .calculate-btn {
  color: var(--accent-hover);
}

@media (max-width: 700px) {
  .presets-page {
    padding: 16px;
  }

  .systems-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .card-content {
    padding: 16px;
  }

  .card-footer {
    padding: 12px 16px;
  }
}
</style>