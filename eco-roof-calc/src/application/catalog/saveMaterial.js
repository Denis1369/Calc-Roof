import { CatalogRepository } from '../../infrastructure/repositories/CatalogRepository'

const catalogRepository = new CatalogRepository()

export async function saveMaterial(material) {
  return catalogRepository.saveMaterial(material)
}