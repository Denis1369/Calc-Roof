import { buildEstimate as buildEstimateDomain } from '../../domain/services/EstimateBuilder'

export async function buildEstimate(input) {
  return buildEstimateDomain(input)
}
