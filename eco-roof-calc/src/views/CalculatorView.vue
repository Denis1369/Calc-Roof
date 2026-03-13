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
          <input v-model="projectName" placeholder="Например: ТЦ Галактика, кровля" class="project-name-input" />
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
        Примыкания к парапету и вертикальным конструкциям = <span class="bold text-blue">{{ globalRoofParams.perimeter.toFixed(2) }}</span> пог.м.,<br/>
        Водоотведение парапетное = {{ globalRoofParams.parapetDrains }} шт.,<br/>
        Водоотведение внутреннее = {{ globalRoofParams.innerDrains }} шт.,<br/>
        Аэраторы = {{ globalRoofParams.aerators }} шт.
      </div>

      <div v-for="(zone, zIdx) in estimateZones" :key="zone.id" class="zone-block">
        <div class="zone-header">
          <input v-model="zone.name" class="zone-title-input" placeholder="Название участка (например: Монтаж кровли в осях: 6-22/А-И)" />
          <button @click="removeZone(zIdx)" class="btn-icon text-danger hide-on-print" title="Удалить участок">✕</button>
        </div>

        <div class="zone-params-block hide-on-print">
          <div class="zone-params-title">Ввод параметров для этого участка (для формул):</div>
          <div class="params-grid">
            <div class="calc-group">
              <label>Площадь (S, м²)</label>
              <input type="number" v-model.number="zone.roofParams.area" @input="recalculateVolumes" placeholder="0" min="0" step="0.1" />
            </div>
            <div class="calc-group">
              <label>Периметр (P, пог.м)</label>
              <input type="number" v-model.number="zone.roofParams.perimeter" @input="recalculateVolumes" placeholder="0" min="0" step="0.1" />
            </div>
            <div class="calc-group">
              <label>Водоотвод парапет. (шт)</label>
              <input type="number" v-model.number="zone.roofParams.parapetDrains" @input="recalculateVolumes" placeholder="0" min="0" />
            </div>
            <div class="calc-group">
              <label>Воронки (ID, шт)</label>
              <input type="number" v-model.number="zone.roofParams.innerDrains" @input="recalculateVolumes" placeholder="0" min="0" />
            </div>
            <div class="calc-group">
              <label>Аэраторы (A, шт)</label>
              <input type="number" v-model.number="zone.roofParams.aerators" @input="recalculateVolumes" placeholder="0" min="0" />
            </div>
          </div>
        </div>

        <div v-for="(section, sIdx) in zone.sections" :key="section.id" class="section-block">
          <div class="section-header">
            <input v-model="section.title" class="section-title-input" placeholder="Название раздела (например: Подготовительные работы)" />
            <button @click="removeSection(zone, sIdx)" class="btn-icon text-danger hide-on-print" title="Удалить раздел">✕</button>
          </div>

          <div class="works-group mt-3">
            <div class="table-subtitle">Работы:</div>
            <div v-if="section.works.length > 0" class="table-wrapper">
              <table class="data-table works-table">
                <thead>
                  <tr>
                    <th class="col-code">Код</th>
                    <th class="col-name">Наименование работ</th>
                    <th class="col-unit">Ед.изм.</th>
                    <th class="col-formula">Формула расчета</th>
                    <th class="col-qty">Кол-во</th>
                    <th class="col-price">Цена за ед.</th>
                    <th class="col-sum">Сумма</th>
                    <th class="col-action hide-on-print"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(work, wIdx) in section.works" :key="wIdx">
                    <td class="center bold text-blue" title="Используйте этот код в формулах, например: [Р1]">{{ work.code }}</td>
                    <td>
                      <input 
                        v-model="work.name" 
                        list="works-list"
                        @change="onWorkNameChange(work, section)"
                        class="cell-input text-left" 
                        placeholder="Начните вводить для поиска..." 
                      />
                    </td>
                    <td class="center"><input v-model="work.unit" class="cell-input center" /></td>
                    <td>
                      <input 
                        v-model="work.expression" 
                        @change="applyFormula(work)"
                        @input="recalculateVolumes" 
                        list="formulas-list"
                        class="cell-input formula-input center" 
                        placeholder="Напр: [Р1] * 1.1" 
                      />
                    </td>
                    <td class="center bold qty-display">{{ work.qty }}</td>
                    <td><input type="number" v-model.number="work.price" class="cell-input right"></td>
                    <td class="right bold">{{ (work.qty * work.price).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</td>
                    <td class="center hide-on-print"><button @click="section.works.splice(wIdx, 1)" class="btn-icon">🗑️</button></td>
                  </tr>
                </tbody>
              </table>
              <div class="subtotal-row">
                <span class="subtotal-label">Итого за работы:</span>
                <span class="subtotal-value">{{ getWorksTotal(section).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
              </div>
            </div>
            <button @click="addWork(section)" class="btn-text hide-on-print mt-1">+ Добавить работу</button>
          </div>

          <div class="materials-group mt-3">
            <div class="table-subtitle">Материалы:</div>
            <div v-if="section.materials.length > 0" class="table-wrapper">
              <table class="data-table mat-table">
                <thead>
                  <tr>
                    <th class="col-code">Код</th>
                    <th class="col-name">Наименование материалов</th>
                    <th class="col-supplier">Тип / Поставщик</th>
                    <th class="col-unit">Ед.изм.</th>
                    <th class="col-formula">Формула расчета</th>
                    <th class="col-qty">Кол-во</th>
                    <th class="col-price">Цена за ед.</th>
                    <th class="col-sum">Сумма</th>
                    <th class="col-action hide-on-print"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(mat, mIdx) in section.materials" :key="mIdx">
                    <td class="center bold text-blue" title="Используйте этот код в формулах, например: [М1]">{{ mat.code }}</td>
                    <td>
                      <input 
                        v-model="mat.name" 
                        list="materials-list"
                        @change="onMaterialNameChange(mat, section)"
                        class="cell-input text-left" 
                        placeholder="Начните вводить для поиска..." 
                      />
                    </td>
                    <td class="center">
                      <select v-model="mat.supplier" class="cell-input center supplier-select">
                        <option value="ТехноНИКОЛЬ">ТехноНИКОЛЬ</option>
                        <option value="Аналог">Аналог</option>
                      </select>
                    </td>
                    <td class="center"><input v-model="mat.unit" class="cell-input center" /></td>
                    <td>
                      <input 
                        v-model="mat.expression" 
                        @change="applyFormula(mat)"
                        @input="recalculateVolumes" 
                        list="formulas-list"
                        class="cell-input formula-input center" 
                        placeholder="Напр: [Р2] * 0.35" 
                      />
                    </td>
                    <td class="center bold qty-display">{{ mat.qty }}</td>
                    <td><input type="number" v-model.number="mat.price" class="cell-input right"></td>
                    <td class="right bold">{{ (mat.qty * mat.price).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</td>
                    <td class="center hide-on-print"><button @click="section.materials.splice(mIdx, 1)" class="btn-icon">🗑️</button></td>
                  </tr>
                </tbody>
              </table>
              <div class="subtotal-row">
                <span class="subtotal-label">Итого за материалы:</span>
                <span class="subtotal-value">{{ getMaterialsTotal(section).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
              </div>
            </div>
            <button @click="addMaterial(section)" class="btn-text hide-on-print mt-1">+ Добавить материал</button>
          </div>

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
              <div v-if="savedTemplatesDb.length === 0" class="dropdown-empty">
                Шаблоны не найдены
              </div>
              <div 
                v-for="t in savedTemplatesDb" 
                :key="t.идентификатор" 
                class="dropdown-item"
                @click="selectTemplate(t.идентификатор)"
              >
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
          <h3 class="expenses-title">Накладные, транспортные, организационные и утилизационные расходы:</h3>
          <table class="data-table works-table">
            <tbody>
              <tr v-for="(exp, eIdx) in overheadExpenses" :key="eIdx">
                <td><input v-model="exp.name" class="cell-input text-left" placeholder="Название расхода" /></td>
                <td class="col-unit center"><input v-model="exp.unit" class="cell-input center" /></td>
                <td class="col-qty right"><input type="number" v-model.number="exp.qty" class="cell-input right"></td>
                <td class="col-price right"><input type="number" v-model.number="exp.price" class="cell-input right"></td>
                <td class="col-sum right bold">{{ (exp.qty * exp.price).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</td>
                <td class="col-action center hide-on-print"><button @click="overheadExpenses.splice(eIdx, 1)" class="btn-icon">🗑️</button></td>
              </tr>
            </tbody>
          </table>
          <button @click="addExpense" class="btn-text hide-on-print mt-2">+ Добавить накладной расход</button>
          
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

    <datalist id="works-list">
      <option v-for="w in worksDb" :key="w.идентификатор" :value="w.наименование_работы"></option>
    </datalist>
    <datalist id="materials-list">
      <option v-for="m in materialsDb" :key="m.идентификатор" :value="m.полное_наименование_материала"></option>
    </datalist>
    <datalist id="formulas-list">
      <option v-for="f in formulasDb" :key="f.идентификатор" :value="f.название_формулы">{{ f.выражение }}</option>
    </datalist>

  </div>
</template>

<script setup>

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router'; 
import { getDb } from '../database.js';
import { evaluate } from 'mathjs';

const route = useRoute(); 
const projectName = ref('');
const vatRate = ref(22); 

const worksDb = ref([]);
const materialsDb = ref([]);
const formulasDb = ref([]);
const coefficientsDb = ref([]);
const macrosDb = ref([]); 
const savedTemplatesDb = ref([]);

const estimateZones = ref([]);

const overheadExpenses = ref([
  { name: 'Организационные расходы (доставка + накладные)', unit: 'ед', qty: 1, price: 0 },
  { name: 'Утилизация строительного мусора', unit: 'ед', qty: 1, price: 0 }
]);

let nextId = 1000;
const codeCounters = ref({ work: 1, mat: 1 }); 




const isTemplateDropdownOpen = ref(false);
const dropdownRef = ref(null);


const closeDropdown = (e) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    isTemplateDropdownOpen.value = false;
  }
};

const selectTemplate = (id) => {
  addZoneFromTemplate(id);
  isTemplateDropdownOpen.value = false; 
};

const globalRoofParams = computed(() => {
  return estimateZones.value.reduce((acc, zone) => {
    acc.area += (zone.roofParams?.area || 0);
    acc.perimeter += (zone.roofParams?.perimeter || 0);
    acc.parapetDrains += (zone.roofParams?.parapetDrains || 0);
    acc.innerDrains += (zone.roofParams?.innerDrains || 0);
    acc.aerators += (zone.roofParams?.aerators || 0);
    return acc;
  }, { area: 0, perimeter: 0, parapetDrains: 0, innerDrains: 0, aerators: 0 });
});

onMounted(async () => {
  
  document.addEventListener('click', closeDropdown);

  try {
    const db = await getDb();
    worksDb.value = await db.select('SELECT * FROM Справочник_видов_работ');
    materialsDb.value = await db.select('SELECT * FROM Справочник_материалов');
    formulasDb.value = await db.select('SELECT * FROM Справочник_формул');
    coefficientsDb.value = await db.select('SELECT * FROM Справочник_коэффициентов');
    
    try { macrosDb.value = await db.select('SELECT * FROM Справочник_макросов'); } catch (e) {}
    try { savedTemplatesDb.value = await db.select('SELECT * FROM Справочник_шаблонов'); } catch(e) {}

    const presetId = route.query.preset;
    if (presetId) {
      await addZoneFromTemplate(presetId);
    } else if (estimateZones.value.length === 0) {
      addZone(); 
    }
  } catch (error) {
    console.error('Ошибка при загрузке баз данных:', error);
  }
});

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown);
});

function updateWorkPrice(work) {
  if (!work.name) return;
  const dbItem = worksDb.value.find(w => w.наименование_работы === work.name);
  if (dbItem) {
    work.unit = dbItem.единица_измерения_работы;
    let qty = work.qty || 0;
    let p = dbItem.цена_0_300;
    if (qty > 300) p = dbItem.цена_300_600;
    if (qty > 600) p = dbItem.цена_600_1000;
    if (qty > 1000) p = dbItem.цена_1000_3000;
    if (qty > 3000) p = dbItem.цена_3000_6000;
    if (qty > 6000) p = dbItem.цена_6000_15000;
    if (qty > 15000) p = dbItem.цена_15000_30000;
    if (qty > 30000) p = dbItem.цена_более_30000;
    work.price = p; 
  }
}

function updateMaterialPrice(mat) {
  if (!mat.name) return;
  const dbItem = materialsDb.value.find(m => m.полное_наименование_материала === mat.name);
  if (dbItem) {
    mat.unit = dbItem.единица_измерения;
    mat.price = dbItem.базовая_цена;
  }
}

async function onWorkNameChange(work, section) {
  updateWorkPrice(work);
  if (!work.name) return;
  const nameLower = work.name.toLowerCase();

  for (const macro of macrosDb.value) {
    if (!macro.условие) continue;
    const keywords = macro.условие.toLowerCase().split(',').map(k => k.trim()).filter(k => k);
    if (keywords.every(kw => nameLower.includes(kw))) {
      
      if (macro.название_работы && work.name !== macro.название_работы) {
        work.name = macro.название_работы;
        updateWorkPrice(work); 
      }
      if (macro.формула_работы && !work.expression) {
        work.expression = macro.формула_работы;
      }

      const db = await getDb();
      try {
        const linkedMaterials = await db.select(
          'SELECT * FROM Материалы_макроса WHERE идентификатор_макроса = $1', 
          [macro.идентификатор]
        );
        for (const mData of linkedMaterials) {
          const hasMat = section.materials.some(m => m.name === mData.название_материала);
          if (!hasMat) {
            const finalFormula = mData.формула_материала.replace(/\[WORK_CODE\]/g, `[${work.code}]`);
            const newMat = { 
              code: 'М' + codeCounters.value.mat++, 
              name: mData.название_материала, 
              supplier: 'ТехноНИКОЛЬ',
              unit: mData.ед_изм_материала, 
              expression: finalFormula, 
              qty: 0, price: 0 
            };
            updateMaterialPrice(newMat);
            section.materials.push(newMat);
          }
        }
      } catch (e) {}
      break; 
    }
  }
  recalculateVolumes();
}

function onMaterialNameChange(mat, section) {
  updateMaterialPrice(mat);
  recalculateVolumes();
}

function applyFormula(item) {
  if (item.expression) {
    const dbFormula = formulasDb.value.find(f => f.название_формулы === item.expression);
    if (dbFormula) {
      item.expression = dbFormula.выражение;
    }
  }
  recalculateVolumes();
}

function assignMissingCodes() {
  let maxWork = 0;
  let maxMat = 0;
  estimateZones.value.forEach(zone => {
    zone.sections.forEach(sec => {
      sec.works.forEach(w => {
        if (w.code && w.code.startsWith('Р')) {
          const num = parseInt(w.code.substring(1));
          if (!isNaN(num) && num > maxWork) maxWork = num;
        }
      });
      sec.materials.forEach(m => {
        if (m.code && m.code.startsWith('М')) {
          const num = parseInt(m.code.substring(1));
          if (!isNaN(num) && num > maxMat) maxMat = num;
        }
      });
    });
  });
  
  codeCounters.value.work = maxWork + 1;
  codeCounters.value.mat = maxMat + 1;
  
  estimateZones.value.forEach(zone => {
    zone.sections.forEach(sec => {
      sec.works.forEach(w => { if (!w.code) w.code = 'Р' + codeCounters.value.work++; });
      sec.materials.forEach(m => { 
        if (!m.code) m.code = 'М' + codeCounters.value.mat++; 
        if (!m.supplier) m.supplier = 'ТехноНИКОЛЬ'; 
      });
    });
  });
}

function parseAndEvaluate(expr, itemsMap, currentCode, currentName, zoneParams) {
  if (!expr && expr !== 0) return 0;
  let exprStr = String(expr).trim().replace(/,/g, '.');
  if (exprStr === '') return 0;

  try {
    let parsedExpr = exprStr.replace(/\[(.*?)\]/g, (match, paramName) => {
      let cleanName = paramName.trim();
      const codeMatch = cleanName.match(/^([pPрРmMмМ])(\d+)$/);
      if (codeMatch) {
        const letter = codeMatch[1];
        const num = codeMatch[2];
        if (['p', 'P', 'р', 'Р'].includes(letter)) cleanName = 'Р' + num;
        else if (['m', 'M', 'м', 'М'].includes(letter)) cleanName = 'М' + num;
      }
      if (cleanName === currentCode || (currentName && cleanName === currentName.trim())) return 1; 

      const coef = coefficientsDb.value.find(c => c.название === cleanName);
      if (coef) return coef.значение;

      if (itemsMap && itemsMap[cleanName] !== undefined) return itemsMap[cleanName];

      return 1;
    });

    const context = {
      S: zoneParams.area || 0,        s: zoneParams.area || 0,
      P: zoneParams.perimeter || 0,   p: zoneParams.perimeter || 0,
      ID: zoneParams.innerDrains || 0, id: zoneParams.innerDrains || 0,
      A: zoneParams.aerators || 0,    a: zoneParams.aerators || 0
    };
    
    const result = evaluate(parsedExpr, context);
    return Number(result.toFixed(2));
  } catch (e) {
    return 0;
  }
}

function recalculateVolumes() {
  assignMissingCodes();

  const itemsMap = {};
  for (let pass = 0; pass < 3; pass++) {
    estimateZones.value.forEach(zone => {
      if (!zone.roofParams) {
        zone.roofParams = { area: 0, perimeter: 0, parapetDrains: 0, innerDrains: 0, aerators: 0 };
      }
      const zParams = zone.roofParams;

      zone.sections.forEach(section => {
        section.works.forEach(work => {
          let val = parseAndEvaluate(work.expression, itemsMap, work.code, work.name, zParams);
          if (work.code) itemsMap[work.code] = val;
          if (work.name) itemsMap[work.name.trim()] = val;
          if (pass === 2) { work.qty = val; updateWorkPrice(work); }
        });
        
        section.materials.forEach(mat => {
          let val = parseAndEvaluate(mat.expression, itemsMap, mat.code, mat.name, zParams);
          if (mat.code) itemsMap[mat.code] = val;
          if (mat.name) itemsMap[mat.name.trim()] = val;
          if (pass === 2) mat.qty = val;
        });
      });
    });
  }
}

async function saveProject() {
  if (!projectName.value) { alert('Пожалуйста, укажите название проекта перед сохранением!'); return; }
  try {
    const db = await getDb();
    const projectSnapshot = {
      vatRate: vatRate.value, 
      estimateZones: estimateZones.value,
      overheadExpenses: overheadExpenses.value
    };
    const jsonString = JSON.stringify(projectSnapshot);
    await db.execute('INSERT INTO Сохраненные_сметы (название_объекта, данные_сметы_json) VALUES ($1, $2)', [projectName.value, jsonString]);
    alert('Смета успешно сохранена в базу данных!');
  } catch (error) { console.error('Ошибка сохранения:', error); }
}

async function loadProject() {
  const projectId = prompt('Введите ID сохраненной сметы (например, 1):');
  if (!projectId) return;
  try {
    const db = await getDb();
    const result = await db.select('SELECT данные_сметы_json, название_объекта FROM Сохраненные_сметы WHERE идентификатор = $1', [Number(projectId)]);
    if (result.length > 0) {
      const loadedData = JSON.parse(result[0].данные_сметы_json);
      
      vatRate.value = loadedData.vatRate !== undefined ? loadedData.vatRate : 22; 
      
      const fallbackGlobalParams = loadedData.roofParams || { area: 0, perimeter: 0, parapetDrains: 0, innerDrains: 0, aerators: 0 };
      estimateZones.value = loadedData.estimateZones || [];
      estimateZones.value.forEach(zone => {
        if (!zone.roofParams) zone.roofParams = { ...fallbackGlobalParams };
        zone.sections.forEach(sec => {
          sec.works.forEach(w => { if (w.expression === undefined) w.expression = w.qty; });
          sec.materials.forEach(m => { 
            if (m.expression === undefined) m.expression = m.qty; 
            if (!m.supplier) m.supplier = 'ТехноНИКОЛЬ'; 
          });
        });
      });
      overheadExpenses.value = loadedData.overheadExpenses || [];
      projectName.value = result[0].название_объекта;
      recalculateVolumes(); 
      alert(`Смета "${projectName.value}" успешно загружена!`);
    } else {
      alert('Смета с таким ID не найдена в базе.');
    }
  } catch (error) { console.error('Ошибка загрузки:', error); }
}

function addZone() { 
  estimateZones.value.push({ 
    id: nextId++, 
    name: 'Новый участок (ось)', 
    roofParams: { area: 0, perimeter: 0, parapetDrains: 0, innerDrains: 0, aerators: 0 },
    sections: [] 
  }); 
}

async function addZoneFromTemplate(templateId) {
  const tmpl = savedTemplatesDb.value.find(t => t.идентификатор === Number(templateId));
  if (!tmpl) return;

  const parsedSections = JSON.parse(tmpl.данные_json || '[]');
  
  estimateZones.value.push({
    id: nextId++,
    name: `Монтаж системы: ${tmpl.название}`,
    roofParams: { area: 0, perimeter: 0, parapetDrains: 0, innerDrains: 0, aerators: 0 },
    sections: parsedSections.map(sec => ({
      ...sec,
      id: nextId++,
      works: sec.works.map(w => ({ ...w, code: 'Р' + codeCounters.value.work++, qty: 0, price: 0 })),
      materials: sec.materials.map(m => ({ ...m, code: 'М' + codeCounters.value.mat++, supplier: 'ТехноНИКОЛЬ', qty: 0, price: 0 }))
    }))
  });

  setTimeout(() => {
    estimateZones.value.forEach(zone => {
      zone.sections.forEach(sec => {
        sec.works.forEach(w => updateWorkPrice(w));
        sec.materials.forEach(m => updateMaterialPrice(m));
      });
    });
    recalculateVolumes();
  }, 100);
}

function removeZone(index) { if (confirm('Удалить весь участок со всеми расчетами?')) estimateZones.value.splice(index, 1); }
function addSection(zone) { zone.sections.push({ id: nextId++, title: 'Новый раздел', works: [], materials: [] }); }
function removeSection(zone, sIdx) { if (confirm('Удалить раздел?')) zone.sections.splice(sIdx, 1); }

function addWork(section) { section.works.push({ code: 'Р' + codeCounters.value.work++, name: '', unit: 'м2', expression: '', qty: 0, price: 0 }); }
function addMaterial(section) { section.materials.push({ code: 'М' + codeCounters.value.mat++, name: '', supplier: 'ТехноНИКОЛЬ', unit: 'шт', expression: '', qty: 0, price: 0 }); }
function addExpense() { overheadExpenses.value.push({ name: 'Новый расход', unit: 'ед', qty: 1, price: 0 }); }

const getWorksTotal = (section) => section.works.reduce((sum, w) => sum + (w.qty * w.price), 0);
const getMaterialsTotal = (section) => section.materials.reduce((sum, m) => sum + (m.qty * m.price), 0);
const getSectionTotal = (section) => getWorksTotal(section) + getMaterialsTotal(section);

const grandTotalWorks = computed(() => {
  return estimateZones.value.reduce((zoneSum, zone) => {
    return zoneSum + zone.sections.reduce((secSum, sec) => secSum + getWorksTotal(sec), 0);
  }, 0);
});

const grandTotalMaterials = computed(() => {
  return estimateZones.value.reduce((zoneSum, zone) => {
    return zoneSum + zone.sections.reduce((secSum, sec) => secSum + getMaterialsTotal(sec), 0);
  }, 0);
});

const totalExpenses = computed(() => overheadExpenses.value.reduce((sum, e) => sum + (e.qty * e.price), 0));

const subTotalWithoutVat = computed(() => grandTotalWorks.value + grandTotalMaterials.value + totalExpenses.value);
const vatAmount = computed(() => subTotalWithoutVat.value * (vatRate.value / 100));
const finalGrandTotalWithVat = computed(() => subTotalWithoutVat.value + vatAmount.value);

function printEstimate() { window.print(); }
</script>

<style scoped>

.estimate-container { 
  max-width: 1400px; 
  margin: 0 auto; 
  padding: 2rem; 
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
  color: #2c3e50; 
  background: #fff; 
}

.header h1 { font-size: 2rem; text-align: center; margin-bottom: 0.5rem; text-transform: uppercase; color: #1a1a1a; }
.subtitle { text-align: center; color: #666; margin-bottom: 2rem; font-size: 1.1rem; }


.controls-panel { 
  background: #f8f9fa; 
  padding: 1.5rem; 
  border-radius: 10px; 
  margin-bottom: 2rem; 
  border: 1px solid #e9ecef; 
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
.db-controls-row { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1.5rem; }


input[type="text"],
input[type="number"],
select { 
  height: 40px !important; 
  padding: 0 12px !important; 
  margin: 0 !important;
  border: 1px solid #ced4da; 
  border-radius: 6px; 
  font-size: 0.95rem; 
  background: #fff; 
  width: 100%; 
  box-sizing: border-box; 
  line-height: normal !important; 
  color: #333;
}

input:focus, select:focus { 
  border-color: #0d6efd; 
  outline: none; 
  box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.15);
}

.calc-group { 
  display: flex; 
  flex-direction: column; 
  gap: 6px; 
  min-width: 0; 
}

.calc-group label { 
  font-weight: 600; 
  font-size: 0.85rem; 
  color: #495057; 
  white-space: nowrap; 
  overflow: hidden;
  text-overflow: ellipsis; 
  margin: 0; 
  padding: 0;
  line-height: 1.2;
}


.document-header-text { 
  margin-bottom: 2.5rem; 
  padding: 1.5rem; 
  border-left: 5px solid #0d6efd; 
  background: #f1f8ff; 
  font-size: 1.1rem; 
  line-height: 1.7; 
  border-radius: 0 8px 8px 0;
}


.zone-block { 
  margin-bottom: 4rem; 
  border: 1px solid #dee2e6; 
  padding: 0; 
  border-radius: 12px; 
  overflow: hidden; 
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}

.zone-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  background: #343a40; 
  padding: 0.75rem 1.5rem; 
  gap: 15px;
}

.zone-title-input { 
  flex: 1;
  background: rgba(255,255,255,0.1) !important; 
  border: 1px solid rgba(255,255,255,0.2) !important; 
  color: white !important; 
  font-size: 1.2rem !important; 
  font-weight: bold !important; 
  height: 42px !important;
  padding: 0 15px !important;
  border-radius: 4px !important;
}
.zone-title-input:focus {
  background: rgba(255,255,255,0.2) !important;
  border-color: #0d6efd !important;
}


.zone-params-block { 
  background: #f1f3f5; 
  padding: 1.5rem; 
  border-bottom: 1px solid #dee2e6; 
}
.zone-params-title { font-weight: 700; margin-bottom: 1rem; color: #495057; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; }

.params-grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); 
  gap: 1.5rem; 
  align-items: flex-start; 
}


.section-block { padding: 1.5rem; }
.section-header { margin-bottom: 1.5rem; border-bottom: 2px solid #e9ecef; padding-bottom: 0.5rem; }
.section-title-input { 
  font-size: 1.2rem !important; 
  font-weight: 800 !important; 
  border: none !important; 
  border-bottom: 2px solid transparent !important;
  padding: 0 !important;
  background: transparent !important;
  width: 70%;
}
.section-title-input:focus { border-bottom-color: #0d6efd !important; border-radius: 0; }

.table-wrapper {
  width: 100%;
  overflow-x: auto;
  border-radius: 4px;
  border: 1px solid #dee2e6;
  margin-bottom: 1rem;
  background: #fff;
}

.data-table { 
  width: 100%; 
  border-collapse: collapse; 
  table-layout: fixed; 
}
.works-table { min-width: 1050px; }
.mat-table { min-width: 1200px; }

.data-table th { 
  background-color: #f8f9fa; 
  padding: 12px 8px; 
  font-size: 0.75rem; 
  text-transform: uppercase; 
  border: 1px solid #dee2e6;
  color: #6c757d;
  position: sticky;
  top: 0;
  z-index: 2;
}
.data-table td { border: 1px solid #dee2e6; padding: 0; position: relative; height: 45px; vertical-align: middle;}


.col-code { width: 50px; }
.col-name { width: 330px; }
.col-supplier { width: 140px; } 
.col-unit { width: 60px; }
.col-formula { width: 200px; }
.col-qty { width: 90px; }
.col-price { width: 110px; }
.col-sum { width: 130px; }
.col-action { width: 45px; border: none !important; }


.cell-input { 
  width: 100%; 
  height: 44px !important; 
  border: none !important; 
  background: transparent !important; 
  padding: 0 12px !important;
  line-height: 44px !important;
  border-radius: 0 !important;
  margin: 0 !important;
  display: block;
  box-sizing: border-box;
}
.cell-input:focus { background: #fff !important; outline: none !important; box-shadow: inset 0 0 0 2px #0d6efd !important; z-index: 5;}

.supplier-select { font-weight: bold; color: #0f5132; cursor: pointer; }
.supplier-select:focus { background-color: #e8f5e9 !important; }

.formula-input { color: #d81b60; font-family: 'Fira Code', 'Courier New', monospace; font-weight: 700; font-size: 0.9rem; }
.qty-display { background: #f8f9fa; color: #2e7d32; font-weight: 800; font-size: 1rem; }
.text-blue { color: #0d6efd; font-family: monospace; font-weight: 800; }


.subtotal-row { text-align: right; padding: 0.75rem 0; border-top: 1px solid #eee; }
.section-total-row { 
  text-align: right; 
  padding: 1rem 0; 
  font-size: 1.2rem; 
  font-weight: 800; 
  border-top: 2px solid #343a40; 
  margin-top: 1rem; 
}

.btn-text { 
  background: transparent; 
  border: 2px dashed #198754; 
  color: #198754; 
  font-weight: 700; 
  cursor: pointer; 
  padding: 0.6rem 1.2rem; 
  font-size: 0.95rem; 
  border-radius: 6px;
  transition: all 0.2s ease-in-out;
  display: block;
  margin-top: 10px;
  width: 100%; 
  text-align: center;
}
.btn-text:hover { background: #e8f5e9; border-color: #1b5e20; color: #1b5e20; }

.btn-outline { 
  background: transparent; 
  border: 2px dashed #0d6efd; 
  color: #0d6efd; 
  width: 100%; 
  margin-top: 1rem; 
  padding: 0.8rem 1.2rem;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  transition: 0.2s;
  font-size: 1rem;
}
.btn-outline:hover { background: #e3f2fd; border-color: #0b5ed7; }


.add-zone-row { display: flex; justify-content: center; gap: 15px; margin: 3rem 0; align-items: center;}
.btn-large { padding: 1rem 2.5rem; font-size: 1.1rem; border-radius: 50px; box-shadow: 0 10px 20px rgba(13,110,253,0.2); transition: 0.3s; height: auto !important;}
.btn-large:hover { transform: translateY(-3px); box-shadow: 0 15px 25px rgba(13,110,253,0.3); }

.custom-dropdown {
  position: relative;
  width: 380px;
}
.dropdown-toggle {
  width: 100%;
  padding: 1rem 1.5rem;
  border-radius: 15px;
  border: 2px solid #0d6efd;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  background-color: #fff;
  color: #0d6efd;
  box-shadow: 0 4px 6px rgba(13, 110, 253, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s ease;
}
.dropdown-toggle:hover {
  background-color: #e3f2fd;
  box-shadow: 0 6px 12px rgba(13, 110, 253, 0.15);
}
.arrow {
  font-size: 0.8rem;
  transition: transform 0.3s ease;
}
.arrow-up {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  width: 100%;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  border: 1px solid #e9ecef;
  z-index: 100;
  max-height: 350px;
  overflow-y: auto;
  padding: 8px 0;
}
.dropdown-item {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: background 0.2s ease;
  color: #2c3e50;
  font-weight: 600;
  text-align: left;
}
.dropdown-item:hover {
  background: #f1f8ff;
  color: #0d6efd;
}
.item-icon {
  font-size: 1.2rem;
  opacity: 0.8;
}
.dropdown-empty {
  padding: 15px;
  text-align: center;
  color: #6c757d;
  font-style: italic;
}


.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}


.grand-totals { 
  margin-top: 4rem; 
  border: 4px double #343a40; 
  padding: 2.5rem; 
  background-color: #fff; 
  border-radius: 8px;
}
.summary-line { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; font-size: 1.1rem; }
.highlight-line { border-top: 1px solid #000; padding-top: 1.5rem; margin-top: 1rem; font-size: 1.25rem; font-weight: 800; }
.text-muted { color: #6c757d; font-size: 1rem; font-style: italic; }

.totals-summary-block {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-top: 2rem;
  border: 1px solid #dee2e6;
}

.final-grand-total { 
  display: flex; 
  justify-content: space-between; 
  font-size: 1.75rem; 
  font-weight: 900; 
  color: #d32f2f; 
  margin-top: 1.5rem; 
  padding-top: 1.5rem; 
  border-top: 3px solid #343a40; 
}


.btn-success { background: #198754; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s;}
.btn-success:hover { background: #157347; }
.btn-primary { background: #0d6efd; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s;}
.btn-primary:hover { background: #0b5ed7; }
.btn-secondary { background: #6c757d; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s;}
.btn-secondary:hover { background: #5c636a; }
.btn-warning { background: #ffc107; color: #000; border: none; padding: 0.6rem 1.2rem; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s;}
.btn-warning:hover { background: #ffca2c; }

.btn-icon { opacity: 0.4; transition: 0.2s; background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 0; }
.btn-icon:hover { opacity: 1; transform: scale(1.2); }
.text-danger { color: #dc3545; opacity: 0.7; }
.text-danger:hover { color: #dc3545; opacity: 1; }

.center { text-align: center; }
.right { text-align: right; }
.bold { font-weight: bold; }
.mt-3 { margin-top: 1.5rem; }


@media print {
  .hide-on-print { display: none !important; }
  .estimate-container { padding: 0; width: 100%; max-width: 100%; }
  .zone-block { border: 2px solid #000; box-shadow: none; margin-bottom: 20px; page-break-inside: avoid; }
  .zone-header { background: #eee; border-bottom: 2px solid #000; }
  .zone-title-input { color: #000 !important; }
  .data-table th, .data-table td { border: 1px solid #000; color: #000; }
  .final-grand-total { color: #000; border-top: 4px solid #000; }
  .document-header-text { border: 1px solid #ccc; background: #fff; }
  .totals-summary-block { background: transparent; border: none; padding: 0; margin-top: 1rem; }
}
</style>