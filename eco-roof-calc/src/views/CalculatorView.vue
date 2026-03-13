<template>
  <div class="estimate-container">
    <header class="header hide-on-print">
      <h1>Коммерческая смета объекта</h1>
      <p class="subtitle">Сводный расчет с разбивкой по участкам и авто-подтягиванием цен из БД</p>
    </header>

    <section class="controls-panel hide-on-print">
      <div class="db-controls-row">
        <div class="calc-group" style="flex: 3;">
          <label>Название проекта (для сохранения):</label>
          <input v-model="projectName" type="text" placeholder="Например: ТЦ Галактика, кровля" class="project-name-input" />
        </div>
        <div class="calc-group" style="flex: 1; max-width: 150px;">
          <label>НДС (%):</label>
          <input type="number" v-model.number="vatRate" min="0" max="100" />
        </div>
        <div class="action-buttons">
          <button @click="saveProject" class="btn-success">💾 Сохранить</button>
          <button @click="loadProject" class="btn-warning">📂 Загрузить</button>
          <button @click="printEstimate" class="btn-secondary">🖨️ Печать</button>
        </div>
      </div>
    </section>

    <div class="estimate-body">
      <div class="document-header-text">
        <strong>Общие суммарные данные по всем участкам:</strong><br/>
        Суммарная площадь кровель = <span class="bold text-blue">{{ globalRoofParams.area.toFixed(2) }}</span> м2,<br/>
        Примыкания к парапету и верт. конструкциям = <span class="bold text-blue">{{ globalRoofParams.perimeter.toFixed(2) }}</span> пог.м.,<br/>
        Водоотведение парапетное = {{ globalRoofParams.parapetDrains }} шт.,<br/>
        Водоотведение внутреннее = {{ globalRoofParams.innerDrains }} шт.,<br/>
        Аэраторы = {{ globalRoofParams.aerators }} шт.
      </div>

      <div v-for="(zone, zIdx) in estimateZones" :key="zone.id" class="zone-block">
        <div class="zone-header">
          <input v-model="zone.name" class="zone-title-input" placeholder="Название участка" />
          <button @click="removeZone(zIdx)" class="btn-icon text-danger hide-on-print" title="Удалить участок">✕</button>
        </div>

        <div class="zone-params-block hide-on-print">
          <div class="zone-params-title">Ввод параметров для этого участка (для формул):</div>
          
          <div class="params-grid">
            <div class="calc-group">
              <label>Тип материалов</label>
              <select v-model="zone.supplierType" @change="applySupplierToZone(zone)" class="zone-supplier-select">
                <option value="ТехноНИКОЛЬ">ТехноНИКОЛЬ</option>
                <option value="Аналог">Аналог</option>
              </select>
            </div>
            <div class="calc-group"><label>Площадь (S, м²)</label><input type="number" v-model.number="zone.roofParams.area" @input="recalculateVolumes" min="0" step="0.1" /></div>
            <div class="calc-group"><label>Периметр (P, пог.м)</label><input type="number" v-model.number="zone.roofParams.perimeter" @input="recalculateVolumes" min="0" step="0.1" /></div>
            <div class="calc-group"><label>Водоотвод (шт)</label><input type="number" v-model.number="zone.roofParams.parapetDrains" @input="recalculateVolumes" min="0" /></div>
            <div class="calc-group"><label>Воронки (ID, шт)</label><input type="number" v-model.number="zone.roofParams.innerDrains" @input="recalculateVolumes" min="0" /></div>
            <div class="calc-group"><label>Аэраторы (A, шт)</label><input type="number" v-model.number="zone.roofParams.aerators" @input="recalculateVolumes" min="0" /></div>
            
            <div class="calc-group" v-for="(cp, pIdx) in zone.customParams" :key="'cp'+pIdx">
              <label class="custom-param-label">
                <span :title="cp.name">{{ cp.name }} ({{ cp.symbol }})</span>
                <span @click="zone.customParams.splice(pIdx, 1); recalculateVolumes()" class="remove-param" title="Удалить переменную">✕</span>
              </label>
              <input type="number" v-model.number="cp.value" @input="recalculateVolumes" min="0" step="0.1" class="custom-param-input" />
            </div>
          </div>

          <div class="add-param-row">
            <button @click="addCustomParam(zone)" class="btn-link-small">+ Добавить свою переменную для формул</button>
          </div>
        </div>

        <div v-for="(section, sIdx) in zone.sections" :key="section.id" class="section-block">
          <div class="section-header">
            <input v-model="section.title" class="section-title-input" placeholder="Название раздела" />
            <button @click="removeSection(zone, sIdx)" class="btn-icon text-danger hide-on-print">✕</button>
          </div>

          <EstimateTable 
            title="Работы:" 
            type="work" 
            :items="section.works" 
            listId="works-list"
            @changeName="onWorkNameChange($event, section, zone)"
            @changeFormula="applyFormula"
            @recalculate="recalculateVolumes"
            @remove="section.works.splice($event, 1)"
            @add="addWork(section)"
          />

          <EstimateTable 
            title="Материалы:" 
            type="material" 
            :items="section.materials" 
            listId="materials-list"
            @changeName="onMaterialNameChange($event, section)"
            @changeFormula="applyFormula"
            @recalculate="recalculateVolumes"
            @remove="section.materials.splice($event, 1)"
            @add="addMaterial(section, zone)"
          />

          <div class="section-total-row">
            <span class="section-total-label">ИТОГО по Разделу:</span>
            <span class="section-total-value">{{ getSectionTotal(section).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
          </div>
        </div>

        <div class="add-section-row hide-on-print">
          <button @click="addSection(zone)" class="btn-outline">+ Добавить раздел в этот участок</button>
        </div>
      </div>

      <div class="add-zone-row hide-on-print">
        <button @click="addZone" class="btn-primary btn-large">+ Добавить пустой участок</button>
        <div class="custom-dropdown" ref="dropdownRef">
          <button class="dropdown-toggle" @click="isTemplateDropdownOpen = !isTemplateDropdownOpen">
            <span>Или выберите готовую систему...</span>
            <span class="arrow" :class="{ 'arrow-up': isTemplateDropdownOpen }">▼</span>
          </button>
          <transition name="fade">
            <div class="dropdown-menu" v-if="isTemplateDropdownOpen">
              <div v-if="savedTemplatesDb.length === 0" class="dropdown-empty">Шаблоны не найдены</div>
              <div v-for="t in savedTemplatesDb" :key="t.идентификатор" class="dropdown-item" @click="selectTemplate(t.идентификатор)">
                <span class="item-icon">📋</span>
                <span class="item-text">{{ t.название }}</span>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <section class="grand-totals">
        <div class="summary-line">
          <span>Сумма по разделам (Монтажные работы):</span>
          <span class="bold">{{ grandTotalWorks.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
        </div>
        <div class="summary-line">
          <span>Сумма по разделам (Материалы):</span>
          <span class="bold">{{ grandTotalMaterials.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
        </div>

        <div class="expenses-block mt-4">
          <h3 class="expenses-title">Накладные, транспортные и утилизационные расходы:</h3>
          <table class="data-table expenses-table">
            <tbody>
              <tr v-for="(exp, eIdx) in overheadExpenses" :key="eIdx">
                <td><input v-model="exp.name" list="works-list" class="cell-input text-left" placeholder="Название расхода" autocomplete="off" /></td>
                <td class="col-unit center"><input v-model="exp.unit" class="cell-input center" /></td>
                <td class="col-qty right"><input type="number" v-model.number="exp.qty" class="cell-input right"></td>
                <td class="col-price right"><input type="number" v-model.number="exp.price" class="cell-input right"></td>
                <td class="col-sum right bold">{{ (exp.qty * exp.price).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</td>
                <td class="col-action center hide-on-print"><button @click="overheadExpenses.splice(eIdx, 1)" class="btn-icon">🗑️</button></td>
              </tr>
            </tbody>
          </table>
          <button @click="addExpense" class="btn-text-dashed hide-on-print mt-2">+ Добавить накладной расход</button>
          
          <div class="subtotal-row mt-2">
            <span class="subtotal-label">Сумма накладных расходов:</span>
            <span class="subtotal-value">{{ totalExpenses.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
          </div>
        </div>

        <div class="totals-summary-block">
          <div class="summary-line highlight-line">
            <span>ИТОГО БЕЗ НДС:</span>
            <span class="bold">{{ subTotalWithoutVat.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
          </div>
          <div class="summary-line text-muted">
            <span>В том числе НДС ({{ vatRate }}%):</span>
            <span>{{ vatAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
          </div>
          <div class="final-grand-total">
            <span>ВСЕГО К ОПЛАТЕ (С НДС):</span>
            <span>{{ finalGrandTotalWithVat.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
          </div>
        </div>
      </section>
    </div>

    <datalist id="works-list"><option v-for="w in worksDb" :key="w.идентификатор" :value="w.наименование_работы"></option></datalist>
    <datalist id="materials-list"><option v-for="m in materialsDb" :key="m.идентификатор" :value="m.полное_наименование_материала"></option></datalist>
    <datalist id="formulas-list"><option v-for="f in formulasDb" :key="f.идентификатор" :value="f.название_формулы">{{ f.выражение }}</option></datalist>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';
import { useCalculator } from '../composables/useCalculator.js';
import EstimateTable from '../components/EstimateTable.vue';


const {
  projectName, vatRate, estimateZones, overheadExpenses, worksDb, materialsDb, formulasDb, savedTemplatesDb,
  isTemplateDropdownOpen, dropdownRef, selectTemplate, applySupplierToZone,
  globalRoofParams, loadDatabases, unloadDatabases, onWorkNameChange, onMaterialNameChange, applyFormula, recalculateVolumes,
  saveProject, loadProject, addZone, removeZone, addSection, removeSection, addWork, addMaterial, addExpense, addCustomParam,
  getSectionTotal, grandTotalWorks, grandTotalMaterials, totalExpenses, subTotalWithoutVat, vatAmount, finalGrandTotalWithVat, printEstimate
} = useCalculator();

onMounted(() => {
  loadDatabases();
});

onUnmounted(() => {
  unloadDatabases();
});
</script>

<style scoped>
.estimate-container { max-width: 1400px; margin: 0 auto; padding: 2rem; font-family: 'Inter', sans-serif; color: #FFFFFF; background: transparent; }
.header h1 { font-size: 2rem; text-align: center; margin-bottom: 0.5rem; text-transform: uppercase; color: #FFFFFF; }
.subtitle { text-align: center; color: #A0B1BA; margin-bottom: 2rem; font-size: 1.1rem; }

.controls-panel { background: #37444B; padding: 1.5rem; border-radius: 10px; margin-bottom: 2rem; border: 1px solid #4A5A63; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.db-controls-row { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1.5rem; }

input[type="text"], input[type="number"], select { height: 40px !important; padding: 0 12px !important; margin: 0 !important; border: 1px solid #4A5A63; border-radius: 6px; font-size: 0.95rem; background: #21292E; width: 100%; box-sizing: border-box; color: #FFFFFF; }
input:focus, select:focus { border-color: #F29A2E; outline: none; box-shadow: 0 0 0 3px rgba(242, 154, 46, 0.15); }
.calc-group { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.calc-group label { font-weight: 600; font-size: 0.85rem; color: #A0B1BA; margin: 0; line-height: 1.2; }

.document-header-text { margin-bottom: 2.5rem; padding: 1.5rem; border-left: 5px solid #F29A2E; background: #37444B; font-size: 1.1rem; line-height: 1.7; border-radius: 0 8px 8px 0; }
.text-blue { color: #F29A2E; font-family: monospace; font-weight: 800; }

.zone-block { margin-bottom: 4rem; border: 1px solid #4A5A63; padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.15); background: #2A3439; }
.zone-header { display: flex; justify-content: space-between; align-items: center; background: #21292E; padding: 0.75rem 1.5rem; gap: 15px; }
.zone-title-input { flex: 1; background: rgba(255,255,255,0.05) !important; border: 1px solid rgba(255,255,255,0.1) !important; color: #FFFFFF !important; font-size: 1.2rem !important; font-weight: bold !important; height: 42px !important; padding: 0 15px !important; border-radius: 4px !important; }
.zone-title-input:focus { background: rgba(255,255,255,0.1) !important; border-color: #F29A2E !important; }
.zone-params-block { background: #37444B; padding: 1.5rem; border-bottom: 1px solid #4A5A63; }
.zone-params-title { font-weight: 700; margin-bottom: 1rem; color: #A0B1BA; font-size: 0.9rem; text-transform: uppercase; }
.params-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1.5rem; align-items: flex-start; }
.zone-supplier-select { font-weight: bold !important; color: #F29A2E !important; background-color: rgba(242, 154, 46, 0.1) !important; border-color: #F29A2E !important; cursor: pointer; }

.section-block { padding: 1.5rem; }
.section-header { margin-bottom: 1.5rem; border-bottom: 2px solid #4A5A63; padding-bottom: 0.5rem; display: flex; justify-content: space-between;}
.section-title-input { font-size: 1.2rem !important; font-weight: 800 !important; border: none !important; border-bottom: 2px solid transparent !important; padding: 0 !important; background: transparent !important; width: 70%; color: #FFFFFF !important;}
.section-title-input:focus { border-bottom-color: #F29A2E !important; }
.section-total-row { text-align: right; padding: 1rem 0; font-size: 1.2rem; font-weight: 800; border-top: 2px solid #4A5A63; margin-top: 1rem; color: #FFFFFF; }

.data-table { width: 100%; border-collapse: collapse; margin-bottom: 1rem;}
.expenses-table td { border: 1px solid #4A5A63; padding: 0; height: 45px; vertical-align: middle; }
.cell-input { width: 100%; height: 44px !important; border: none !important; background: transparent !important; padding: 0 12px !important; box-sizing: border-box; color: #FFFFFF !important; }
.cell-input:focus { background: #21292E !important; box-shadow: inset 0 0 0 2px #F29A2E !important; }
.col-unit { width: 80px; } .col-qty { width: 100px; } .col-price { width: 130px; } .col-sum { width: 150px; } .col-action { width: 50px; border: none !important; }
.subtotal-row { text-align: right; padding: 0.75rem 0; border-top: 1px solid #4A5A63; }
.subtotal-label { margin-right: 1rem; color: #A0B1BA; } .subtotal-value { font-weight: bold; min-width: 150px; display: inline-block; color: #FFFFFF; }

.btn-text-dashed { background: transparent; border: 2px dashed #A0B1BA; color: #A0B1BA; font-weight: 700; cursor: pointer; padding: 0.6rem 1.2rem; font-size: 0.95rem; border-radius: 6px; display: block; width: 100%; text-align: center; transition: 0.2s; }
.btn-text-dashed:hover { background: rgba(242, 154, 46, 0.05); border-color: #F29A2E; color: #F29A2E; }
.btn-outline { background: transparent; border: 2px dashed #F29A2E; color: #F29A2E; width: 100%; margin-top: 1rem; padding: 0.8rem 1.2rem; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 1rem; }
.btn-outline:hover { background: rgba(242, 154, 46, 0.1); }
.btn-success { background: #F29A2E; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-success:hover { background: #D98826; }
.btn-primary { background: #F29A2E; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-primary:hover { background: #D98826; }
.btn-secondary { background: #4A5A63; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-secondary:hover { background: #A0B1BA; }
.btn-warning { background: #D98826; color: #FFFFFF; border: none; padding: 0.6rem 1.2rem; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-warning:hover { background: #F29A2E; }
.btn-icon { opacity: 0.6; transition: 0.2s; background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 0; color: #A0B1BA; }
.btn-icon:hover { opacity: 1; transform: scale(1.2); color: #ff4d4f; }
.text-danger { color: #ff4d4f; opacity: 0.8; }
.text-danger:hover { opacity: 1; }
.center { text-align: center; } .right { text-align: right; } .bold { font-weight: bold; } .mt-3 { margin-top: 1.5rem; } .mt-4 { margin-top: 2rem; }

.add-zone-row { display: flex; justify-content: center; gap: 15px; margin: 3rem 0; align-items: center;}
.btn-large { padding: 1rem 2.5rem; font-size: 1.1rem; border-radius: 50px; height: auto !important;}
.arrow { font-size: 0.8rem; transition: transform 0.3s ease; } .arrow-up { transform: rotate(180deg); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-10px); }
.custom-dropdown { position: relative; width: 380px; }
.dropdown-toggle { width: 100%; padding: 1rem 1.5rem; border-radius: 50px; border: 2px solid #F29A2E; font-size: 1rem; font-weight: bold; cursor: pointer; background-color: #21292E; color: #F29A2E; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; }
.dropdown-toggle:hover { background-color: rgba(242, 154, 46, 0.1); }
.dropdown-menu { position: absolute; top: calc(100% + 10px); left: 0; width: 100%; background: #2A3439; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #4A5A63; z-index: 100; max-height: 350px; overflow-y: auto; padding: 8px 0; }
.dropdown-item { padding: 12px 20px; display: flex; align-items: center; gap: 12px; cursor: pointer; color: #FFFFFF; font-weight: 600; transition: 0.2s; }
.dropdown-item:hover { background: #37444B; color: #F29A2E; }
.dropdown-empty { padding: 12px 20px; color: #A0B1BA; text-align: center; font-style: italic; }

.grand-totals { margin-top: 4rem; border: 4px double #F29A2E; padding: 2.5rem; background-color: #37444B; border-radius: 8px; }
.summary-line { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; font-size: 1.1rem; }
.highlight-line { border-top: 1px solid #4A5A63; padding-top: 1.5rem; margin-top: 1rem; font-size: 1.25rem; font-weight: 800; }
.text-muted { color: #A0B1BA; font-size: 1rem; font-style: italic; }
.totals-summary-block { background: #21292E; padding: 1.5rem; border-radius: 8px; margin-top: 2rem; border: 1px solid #4A5A63; }
.final-grand-total { display: flex; justify-content: space-between; font-size: 1.75rem; font-weight: 900; color: #F29A2E; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 3px solid #4A5A63; }

.add-param-row { margin-top: 1rem; text-align: right; }
.btn-link-small { background: none; border: none; color: #F29A2E; font-size: 0.85rem; font-weight: bold; cursor: pointer; text-decoration: underline; transition: 0.2s; }
.btn-link-small:hover { color: #D98826; }
.custom-param-label { display: flex; justify-content: space-between; color: #F29A2E !important; }
.remove-param { color: #ff4d4f; cursor: pointer; font-size: 0.9rem; margin-left: 5px; }
.remove-param:hover { font-weight: bold; }
.custom-param-input { border-color: rgba(242, 154, 46, 0.5) !important; background: #21292E !important; }

@media print {
  .hide-on-print { display: none !important; }
  .estimate-container { padding: 0; max-width: 100%; color: #000; background: #fff; }
  .zone-block { border: 2px solid #000; box-shadow: none; margin-bottom: 20px; page-break-inside: avoid; background: #fff; }
  .zone-header { background: #eee; border-bottom: 2px solid #000; }
  .zone-title-input { color: #000 !important; }
  .expenses-table td { border: 1px solid #000; color: #000; }
  .cell-input { color: #000 !important; }
  .final-grand-total { color: #000; border-top: 4px solid #000; }
  .totals-summary-block { background: transparent; border: none; padding: 0; margin-top: 1rem; }
  .section-title-input { color: #000 !important; }
  .text-blue { color: #000; }
  .grand-totals { border-color: #000; background: #fff; }
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