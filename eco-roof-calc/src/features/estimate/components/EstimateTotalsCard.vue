<template>
  <section class="grand-totals page-card">
    <div class="summary-line">
      <span>Сумма по разделам (монтажные работы):</span>
      <span class="bold">{{ formatMoney(grandTotalWorks) }}</span>
    </div>

    <div class="summary-line">
      <span>Сумма по разделам (материалы):</span>
      <span class="bold">{{ formatMoney(grandTotalMaterials) }}</span>
    </div>

    <div class="expenses-block mt-4">
      <h3 class="expenses-title">Накладные, транспортные и утилизационные расходы:</h3>

      <table class="expenses-table">
        <tbody>
          <tr v-for="(exp, eIdx) in overheadExpenses" :key="eIdx">
            <td>
              <input
                v-model="exp.name"
                list="overhead-expenses-list"
                class="expense-input text-left"
                placeholder="Название расхода"
                autocomplete="off"
                @change="applyExpenseWork(exp)"
              />
            </td>
            <td class="col-unit center">
              <input v-model="exp.unit" class="expense-input center" />
            </td>
            <td class="col-qty right">
              <input type="number" v-model.number="exp.qty" class="expense-input right" />
            </td>
            <td class="col-price right">
              <input type="number" v-model.number="exp.price" class="expense-input right" />
            </td>
            <td class="col-sum right bold">
              {{ formatMoney(exp.qty * exp.price) }}
            </td>
            <td class="col-action center hide-on-print">
              <button @click="$emit('removeExpense', eIdx)" class="btn-icon">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>

      <datalist id="overhead-expenses-list">
        <option
          v-for="work in overheadWorkOptions"
          :key="work.идентификатор || work.id || work.наименование_работы || work.name"
          :value="workName(work)"
        ></option>
      </datalist>

      <button @click="$emit('addExpense')" class="btn-text-dashed hide-on-print mt-2">
        + Добавить накладной расход
      </button>

      <div class="subtotal-row mt-2">
        <span class="subtotal-label">Сумма накладных расходов:</span>
        <span class="subtotal-value">{{ formatMoney(totalExpenses) }}</span>
      </div>
    </div>

    <div class="totals-summary-block">
      <div class="summary-line highlight-line">
        <span>ИТОГО БЕЗ НДС:</span>
        <span class="bold">{{ formatMoney(subTotalWithoutVat) }}</span>
      </div>

      <div class="summary-line muted-line">
        <span>В том числе НДС ({{ vatRate }}%):</span>
        <span>{{ formatMoney(vatAmount) }}</span>
      </div>

      <div class="final-grand-total">
        <span>ВСЕГО К ОПЛАТЕ (С НДС):</span>
        <span>{{ formatMoney(finalGrandTotalWithVat) }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  overheadExpenses: { type: Array, required: true },
  worksDb: { type: Array, default: () => [] },
  pricingArea: { type: Number, default: 0 },
  grandTotalWorks: { type: Number, required: true },
  grandTotalMaterials: { type: Number, required: true },
  totalExpenses: { type: Number, required: true },
  subTotalWithoutVat: { type: Number, required: true },
  vatAmount: { type: Number, required: true },
  finalGrandTotalWithVat: { type: Number, required: true },
  vatRate: { type: Number, required: true }
})

defineEmits(['addExpense', 'removeExpense'])

const OVERHEAD_KEYWORDS = [
  'наклад',
  'транспорт',
  'организац',
  'подъем',
  'подъём',
  'механизм',
  'утилизац',
  'вывоз',
  'мусор',
  'доставка',
  'разгруз',
  'погруз',
  'логист',
  'кран',
  'манипулятор',
  'склад'
]

const overheadWorkOptions = computed(() => {
  return (props.worksDb || [])
    .filter(isOverheadWork)
    .sort((left, right) => workName(left).localeCompare(workName(right), 'ru'))
})

function normalize(value) {
  return `${value || ''}`.toLowerCase().replace(/\s+/g, ' ').trim()
}

function workName(work) {
  return work?.наименование_работы || work?.name || ''
}

function isOverheadWork(work) {
  const text = normalize(`${work?.категория_работы || work?.category || ''} ${workName(work)}`)
  return OVERHEAD_KEYWORDS.some((keyword) => text.includes(keyword))
}

function findOverheadWorkByName(name) {
  const target = normalize(name)
  if (!target) return null
  return overheadWorkOptions.value.find((work) => normalize(workName(work)) === target) || null
}

function applyExpenseWork(expense) {
  const found = findOverheadWorkByName(expense?.name)
  if (!found) return

  expense.name = workName(found)
  expense.unit = found.единица_измерения_работы || found.unit || expense.unit || 'ед'
  expense.price = pickWorkPriceByArea(found, props.pricingArea)
}

function pickWorkPriceByArea(work, area) {
  const value = Number(area) || 0
  if (value <= 300) return Number(work?.цена_0_300 || 0)
  if (value <= 600) return Number(work?.цена_300_600 || 0)
  if (value <= 1000) return Number(work?.цена_600_1000 || 0)
  if (value <= 3000) return Number(work?.цена_1000_3000 || 0)
  if (value <= 6000) return Number(work?.цена_3000_6000 || 0)
  if (value <= 15000) return Number(work?.цена_6000_15000 || 0)
  if (value <= 30000) return Number(work?.цена_15000_30000 || 0)
  return Number(work?.цена_более_30000 || 0)
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('ru-RU', {
    minimumFractionDigits: 2
  }) + ' ₽'
}
</script>

<style scoped>
.grand-totals {
  padding: 28px;
  border: 2px solid var(--accent);
}

.summary-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  font-size: 1.05rem;
  gap: 16px;
}

.summary-line > :last-child,
.final-grand-total > :last-child {
  white-space: nowrap;
}

.expenses-title {
  margin: 0 0 16px;
  color: var(--text-main);
}

.expenses-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
}

.expenses-table td {
  border: 1px solid var(--border-color);
  padding: 0;
  height: 45px;
  vertical-align: middle;
}

.expense-input {
  width: 100%;
  height: 44px;
  border: none;
  background: transparent;
  padding: 0 12px;
  box-sizing: border-box;
  color: var(--text-main);
  outline: none;
}

.expense-input:focus {
  background: var(--bg-hover);
  box-shadow: inset 0 0 0 2px var(--accent);
}

.col-unit {
  width: 80px;
}

.col-qty {
  width: 100px;
}

.col-price {
  width: 130px;
}

.col-sum {
  width: 150px;
  white-space: nowrap;
}

.col-action {
  width: 50px;
  border: none !important;
}

.btn-text-dashed {
  background: transparent;
  border: 2px dashed var(--border-strong);
  color: var(--text-soft);
  font-weight: 700;
  cursor: pointer;
  padding: 10px 14px;
  font-size: 0.95rem;
  border-radius: 10px;
  display: block;
  width: 100%;
  text-align: center;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.btn-text-dashed:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
  color: var(--accent);
}

.subtotal-row {
  text-align: right;
  padding: 12px 0 0;
  border-top: 1px solid var(--border-color);
}

.subtotal-label {
  margin-right: 1rem;
  color: var(--text-soft);
}

.subtotal-value {
  font-weight: 700;
  min-width: 150px;
  display: inline-block;
  color: var(--text-main);
  white-space: nowrap;
}

.totals-summary-block {
  background: var(--bg-card-soft);
  padding: 20px;
  border-radius: 12px;
  margin-top: 24px;
  border: 1px solid var(--border-color);
}

.highlight-line {
  border-top: 1px solid var(--border-color);
  padding-top: 18px;
  margin-top: 10px;
  font-size: 1.2rem;
  font-weight: 800;
}

.muted-line {
  color: var(--text-soft);
  font-size: 1rem;
}

.final-grand-total {
  display: flex;
  justify-content: space-between;
  font-size: 1.6rem;
  font-weight: 900;
  color: var(--accent);
  margin-top: 18px;
  padding-top: 18px;
  border-top: 2px solid var(--border-color);
  gap: 16px;
}

.btn-icon {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 18px;
}

.center {
  text-align: center;
}

.right {
  text-align: right;
}

.bold {
  font-weight: 700;
}

.mt-2 {
  margin-top: 0.5rem;
}

.mt-4 {
  margin-top: 2rem;
}

@media (max-width: 900px) {
  .summary-line,
  .final-grand-total {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
