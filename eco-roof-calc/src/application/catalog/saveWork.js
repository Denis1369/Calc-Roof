import { CatalogRepository } from '../../infrastructure/repositories/CatalogRepository'

const catalogRepository = new CatalogRepository()

export async function saveWork(work) {
  return catalogRepository.saveWork(work)
}