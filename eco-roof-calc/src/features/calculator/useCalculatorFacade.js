import { ref } from 'vue'
import { getCatalogData } from '../../application/catalog/getCatalogData'
import { saveEstimate } from '../../application/estimates/saveEstimate'
import { loadEstimate } from '../../application/estimates/loadEstimate'
import { listSavedEstimates } from '../../application/estimates/listSavedEstimates'
import {
  toLegacyMaterialRow,
  toLegacyWorkRow
} from '../../shared/adapters/catalogViewAdapters'

export function useCalculatorFacade() {
  const loading = ref(false)
  const error = ref('')

  const materialsDb = ref([])
  const worksDb = ref([])
  const coefficientsDb = ref([])
  const formulasDb = ref([])
  const savedProjects = ref([])

  async function loadReferenceData() {
    loading.value = true
    error.value = ''

    try {
      const data = await getCatalogData()

      materialsDb.value = data.materials.map(toLegacyMaterialRow)
      worksDb.value = data.works.map(toLegacyWorkRow)
      coefficientsDb.value = data.coefficients
      formulasDb.value = data.formulas
    } catch (err) {
      console.error(err)
      error.value = err?.message || 'Не удалось загрузить данные калькулятора'
    } finally {
      loading.value = false
    }
  }

  async function saveProject(payload) {
    loading.value = true
    error.value = ''

    try {
      return await saveEstimate(payload)
    } catch (err) {
      console.error(err)
      error.value = err?.message || 'Не удалось сохранить проект'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function loadProject(id) {
    loading.value = true
    error.value = ''

    try {
      return await loadEstimate(id)
    } catch (err) {
      console.error(err)
      error.value = err?.message || 'Не удалось загрузить проект'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function loadSavedProjects() {
    loading.value = true
    error.value = ''

    try {
      savedProjects.value = await listSavedEstimates()
    } catch (err) {
      console.error(err)
      error.value = err?.message || 'Не удалось загрузить список проектов'
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,

    materialsDb,
    worksDb,
    coefficientsDb,
    formulasDb,
    savedProjects,

    loadReferenceData,
    saveProject,
    loadProject,
    loadSavedProjects
  }
}