import { SystemRepository } from '../../infrastructure/repositories/SystemRepository'

const systemRepository = new SystemRepository()

export async function listSystems() {
  return systemRepository.listSystems()
}