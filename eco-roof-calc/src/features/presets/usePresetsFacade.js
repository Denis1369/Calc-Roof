import { ref } from 'vue'
import { listSystems } from '../../application/systems/listSystems'
import { getSystemTemplate } from '../../application/systems/getSystemTemplate'
import {
  toSystemListItem,
  toSystemTemplateView
} from '../../shared/adapters/systemViewAdapter'

export function usePresetsFacade() {
  const loading = ref(false)
  const error = ref('')

  const systems = ref([])
  const selectedSystem = ref(null)

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

  return {
    loading,
    error,
    systems,
    selectedSystem,
    loadSystems,
    selectSystem
  }
}