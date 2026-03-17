import { EstimateRepository } from '../../infrastructure/repositories/EstimateRepository'

const estimateRepository = new EstimateRepository()

export async function loadEstimate(id) {
  return estimateRepository.loadEstimate(id)
}