import { CatalogRepository } from '@/core/repositories/CatalogRepository'
import { EstimateRepository } from '@/core/repositories/EstimateRepository'
import { SystemRepository } from '@/core/repositories/SystemRepository'

const catalogRepository = new CatalogRepository()
const estimateRepository = new EstimateRepository()
const systemRepository = new SystemRepository()

export async function getCatalogData() {
  const [materials, works, coefficients, formulas] = await Promise.all([
    catalogRepository.listMaterials(),
    catalogRepository.listWorks(),
    catalogRepository.listCoefficients(),
    catalogRepository.listFormulas()
  ])

  return {
    materials,
    works,
    coefficients,
    formulas
  }
}

export async function saveMaterial(material) {
  return catalogRepository.saveMaterial(material)
}

export async function deleteMaterial(id) {
  return catalogRepository.deleteMaterial(id)
}

export async function saveWork(work) {
  return catalogRepository.saveWork(work)
}

export async function deleteWork(id) {
  return catalogRepository.deleteWork(id)
}

export async function listSystems() {
  return systemRepository.listSystems()
}

export async function getSystemTemplate(code) {
  return systemRepository.getFullSystemByCode(code)
}

export async function saveEstimate(payload) {
  return estimateRepository.saveEstimate(payload)
}

export async function loadEstimate(id) {
  return estimateRepository.loadEstimate(id)
}

export async function listSavedEstimates() {
  return estimateRepository.listSavedEstimates()
}
