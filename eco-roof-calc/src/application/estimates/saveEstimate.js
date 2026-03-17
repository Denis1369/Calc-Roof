import { EstimateRepository } from '../../infrastructure/repositories/EstimateRepository'

const estimateRepository = new EstimateRepository()

export async function saveEstimate(payload) {
  return estimateRepository.saveEstimate(payload)
}