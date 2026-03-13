<template>
  <div class="items-group mt-3">
    <div class="table-subtitle">{{ title }}</div>
    <div v-if="items.length > 0" class="table-wrapper">
      <table class="data-table" :class="type === 'work' ? 'works-table' : 'mat-table'">
        <thead>
          <tr>
            <th class="col-code">Код</th>
            <th class="col-name">Наименование {{ type === 'work' ? 'работ' : 'материалов' }}</th>
            <th v-if="type === 'material'" class="col-supplier">Тип / Поставщик</th>
            <th class="col-unit">Ед.изм.</th>
            <th class="col-formula">Формула расчета</th>
            <th class="col-qty">Кол-во</th>
            <th class="col-price">Цена за ед.</th>
            <th class="col-sum">Сумма</th>
            <th class="col-action hide-on-print"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in items" :key="idx">
            <td class="center bold text-blue" :title="`Код: [${item.code}]`">{{ item.code }}</td>
            <td>
              <input 
                v-model="item.name" 
                :list="listId"
                @change="$emit('changeName', item)"
                class="cell-input text-left" 
                placeholder="Начните вводить для поиска..." 
              />
            </td>
            <td v-if="type === 'material'" class="center">
              <select v-model="item.supplier" class="cell-input center supplier-select">
                <option value="ТехноНИКОЛЬ">ТехноНИКОЛЬ</option>
                <option value="Аналог">Аналог</option>
              </select>
            </td>
            <td class="center"><input v-model="item.unit" class="cell-input center" /></td>
            <td>
              <input 
                v-model="item.expression" 
                @change="$emit('changeFormula', item)"
                @input="$emit('recalculate')" 
                list="formulas-list"
                class="cell-input formula-input center" 
                placeholder="Напр: S * 1.1" 
              />
            </td>
            <td class="center bold qty-display">{{ item.qty }}</td>
            <td><input type="number" v-model.number="item.price" class="cell-input right"></td>
            <td class="right bold">{{ ((item.qty || 0) * (item.price || 0)).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</td>
            <td class="center hide-on-print"><button @click="$emit('remove', idx)" class="btn-icon">🗑️</button></td>
          </tr>
        </tbody>
      </table>
      <div class="subtotal-row">
        <span class="subtotal-label">Итого за {{ type === 'work' ? 'работы' : 'материалы' }}:</span>
        <span class="subtotal-value">{{ totalSum.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
      </div>
    </div>
    <button @click="$emit('add')" class="btn-text hide-on-print mt-1">+ Добавить {{ type === 'work' ? 'работу' : 'материал' }}</button>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: String,
  type: String, 
  items: Array,
  listId: String
});

defineEmits(['changeName', 'changeFormula', 'recalculate', 'remove', 'add']);

const totalSum = computed(() => {
  return props.items.reduce((sum, i) => sum + ((i.qty || 0) * (i.price || 0)), 0);
});
</script>

<style scoped>
.table-subtitle { font-weight: bold; margin-bottom: 0.5rem; font-style: italic; color: #A0B1BA; }
.table-wrapper { width: 100%; overflow-x: auto; border-radius: 4px; border: 1px solid #4A5A63; margin-bottom: 1rem; background: #2A3439; }
.data-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.works-table { min-width: 1050px; }
.mat-table { min-width: 1200px; }
.data-table th { background-color: #21292E; padding: 12px 8px; font-size: 0.75rem; text-transform: uppercase; border: 1px solid #4A5A63; color: #A0B1BA; position: sticky; top: 0; z-index: 2; }
.data-table td { border: 1px solid #4A5A63; padding: 0; position: relative; height: 45px; vertical-align: middle; color: #FFFFFF; }
.col-code { width: 50px; }
.col-name { width: 330px; }
.col-supplier { width: 140px; } 
.col-unit { width: 60px; }
.col-formula { width: 200px; }
.col-qty { width: 90px; }
.col-price { width: 110px; }
.col-sum { width: 130px; }
.col-action { width: 45px; border: none !important; background: transparent; }
.cell-input { width: 100%; height: 44px !important; border: none !important; background: transparent !important; padding: 0 12px !important; line-height: 44px !important; border-radius: 0 !important; margin: 0 !important; display: block; box-sizing: border-box; color: #FFFFFF !important; color-scheme: dark; }
.cell-input:focus { background: #21292E !important; outline: none !important; box-shadow: inset 0 0 0 2px #F29A2E !important; z-index: 5; }
.supplier-select { font-weight: bold; color: #F29A2E; cursor: pointer; }
.supplier-select:focus { background-color: rgba(242, 154, 46, 0.1) !important; }
.formula-input { color: #A0B1BA; font-family: 'Fira Code', monospace; font-weight: 700; font-size: 0.9rem; }
.qty-display { background: #21292E; color: #F29A2E; font-weight: 800; font-size: 1rem; }
.text-blue { color: #F29A2E; font-family: monospace; font-weight: 800; }
.subtotal-row { text-align: right; padding: 0.75rem 0; border-top: 1px solid #4A5A63; color: #FFFFFF; }
.subtotal-label { margin-right: 1rem; color: #A0B1BA; }
.subtotal-value { font-weight: bold; min-width: 150px; display: inline-block; color: #F29A2E; }
.btn-text { background: transparent; border: 2px dashed #A0B1BA; color: #A0B1BA; font-weight: 700; cursor: pointer; padding: 0.6rem 1.2rem; font-size: 0.95rem; border-radius: 6px; transition: all 0.2s ease-in-out; display: block; margin-top: 10px; width: 100%; text-align: center; }
.btn-text:hover { background: rgba(242, 154, 46, 0.05); border-color: #F29A2E; color: #F29A2E; }
.btn-icon { opacity: 0.4; transition: 0.2s; background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 0; }
.btn-icon:hover { opacity: 1; transform: scale(1.2); color: #ff4d4f; }
.center { text-align: center; }
.right { text-align: right; }
.bold { font-weight: bold; }
@media print { 
  .hide-on-print { display: none !important; } 
  .data-table th, .data-table td { border: 1px solid #000; color: #000; background: #fff; } 
  .qty-display { color: #000; background: #fff; }
  .text-blue { color: #000; }
  .subtotal-row { color: #000; }
  .subtotal-label { color: #000; }
  .subtotal-value { color: #000; }
  .formula-input { color: #000; }
}

input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield; 
}

input::-webkit-calendar-picker-indicator {
  display: none !important;
}
input::-webkit-list-button {
  display: none !important;
}

select option {
  background-color: #21292E !important;
  color: #FFFFFF !important;
  font-weight: bold;
}

select option:checked {
  background-color: #37444B !important;
  color: #FFFFFF !important;
}
</style>