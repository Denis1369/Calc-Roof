import { ref } from 'vue'
import { listSystems } from '@/core/services/dataApi'
import { getSystemTemplate } from '@/core/services/dataApi'
import {
  toSystemListItem,
  toSystemTemplateView
} from '@/core/adapters/viewAdapters'
import { SystemRepository } from '@/core/repositories/SystemRepository'

const systemRepository = new SystemRepository()

function normalizePresetRow(row) {
  return {
    ...row,
    selectedKeys: Array.isArray(row?.features?.selectedKeys)
      ? row.features.selectedKeys
      : []
  }
}

export function usePresets() {
  const loading = ref(false)
  const error = ref('')

  const systems = ref([])
  const selectedSystem = ref(null)
  const savedPresets = ref([])

  async function loadSystems() {
    loading.value = true
    error.value = ''

    try {
      const rows = await listSystems()
      systems.value = rows.map(toSystemListItem)
    } catch (err) {
      console.error(err)
      error.value = err?.message || 'Не удалось загрузить системы'
    } finally {
      loading.value = false
    }
  }

  async function selectSystem(systemCode) {
    loading.value = true
    error.value = ''

    try {
      const fullSystem = await getSystemTemplate(systemCode)
      selectedSystem.value = toSystemTemplateView(fullSystem)
      return selectedSystem.value
    } catch (err) {
      console.error(err)
      error.value = err?.message || 'Не удалось загрузить шаблон системы'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function loadSavedPresets() {
    try {
      const rows = await systemRepository.listSavedSystemConfigs()
      savedPresets.value = rows.map(normalizePresetRow)
    } catch (err) {
      console.error(err)
      error.value = err?.message || 'Не удалось загрузить пресеты'
    }
  }

  async function savePresetConfig(payload) {
    const saved = await systemRepository.saveSystemConfig(payload)
    await loadSavedPresets()
    return normalizePresetRow(saved)
  }

  async function deletePresetConfig(id) {
    await systemRepository.deleteSystemConfig(id)
    await loadSavedPresets()
  }

  return {
    loading,
    error,
    systems,
    selectedSystem,
    savedPresets,
    loadSystems,
    selectSystem,
    loadSavedPresets,
    savePresetConfig,
    deletePresetConfig
  }
}
