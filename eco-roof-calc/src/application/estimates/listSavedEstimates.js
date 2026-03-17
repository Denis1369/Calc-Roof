import { EstimateRepository } from '../../infrastructure/repositories/EstimateRepository'

const estimateRepository = new EstimateRepository()

export async function listSavedEstimates() {
  return estimateRepository.listSavedEstimates()
}