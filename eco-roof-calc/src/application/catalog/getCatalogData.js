import { CatalogRepository } from '../../infrastructure/repositories/CatalogRepository'

const catalogRepository = new CatalogRepository()

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