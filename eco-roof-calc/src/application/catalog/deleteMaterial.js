import { CatalogRepository } from '../../infrastructure/repositories/CatalogRepository'

const catalogRepository = new CatalogRepository()

export async function deleteMaterial(id) {
  return catalogRepository.deleteMaterial(id)
}