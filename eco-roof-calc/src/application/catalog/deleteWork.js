import { CatalogRepository } from '../../infrastructure/repositories/CatalogRepository'

const catalogRepository = new CatalogRepository()

export async function deleteWork(id) {
  return catalogRepository.deleteWork(id)
}