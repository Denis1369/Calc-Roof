import { AREA_TIERS } from '../constants/areaTiers'

export function resolveAreaTier(area) {
  const value = Number(area) || 0
  return AREA_TIERS.find((tier) => value >= tier.min && (tier.max === null || value < tier.max)) ?? AREA_TIERS[0]
}

export function getWorkPriceByArea(work, area) {
  if (!work?.priceTiers?.length) return 0

  const value = Number(area) || 0
  const match = work.priceTiers.find((tier) => value >= Number(tier.areaFrom ?? 0) && (tier.areaTo == null || value < Number(tier.areaTo)))

  return Number(match?.price ?? 0)
}
