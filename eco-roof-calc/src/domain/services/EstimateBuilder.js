import { evaluateFormula } from './FormulaEngine'
import { getWorkPriceByArea } from './PricingService'

export function buildEstimate({ system, area, selectedOptions = {}, context = {} }) {
  // TODO: основная логика построения сметы
  // Сейчас только каркас
  return {
    systemCode: system?.code ?? null,
    area: Number(area) || 0,
    selectedOptions,
    context,
    materials: [],
    works: [],
    totals: {
      materials: 0,
      works: 0,
      grandTotal: 0
    },
    debug: {
      formulaSample: evaluateFormula({ expression: 'AREA', context: { area } }),
      priceSample: getWorkPriceByArea({ priceTiers: [] }, area)
    }
  }
}
