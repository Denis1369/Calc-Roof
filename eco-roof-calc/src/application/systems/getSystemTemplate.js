import { SystemRepository } from '../../infrastructure/repositories/SystemRepository'

const systemRepository = new SystemRepository()

export async function getSystemTemplate(code) {
  return systemRepository.getFullSystemByCode(code)
}