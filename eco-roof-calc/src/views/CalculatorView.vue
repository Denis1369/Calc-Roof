<template>
  <div class="estimate-container">
    <header class="header">
      <h1>Коммерческая смета объекта</h1>
      <p class="subtitle">Сводный расчет с разбивкой по участкам и гибридным сохранением</p>
    </header>

    <section class="controls-panel hide-on-print">
      <div class="db-controls-row">
        <div class="input-group">
          <label>Название проекта (для сохранения):</label>
          <input v-model="projectName" placeholder="Например: ТЦ Галактика, кровля" class="project-name-input" />
        </div>
        <div class="action-buttons">
          <button @click="saveProject" class="btn-success">💾 Сохранить в БД</button>
          <button @click="loadProject" class="btn-warning">📂 Загрузить из БД</button>
          <button @click="printEstimate" class="btn-secondary">🖨️ Печать / В PDF</button>
        </div>
      </div>

      <hr class="divider" />

      <div class="global-inputs">
        <h3>Параметры крыши (Выводятся в шапке документа)</h3>
        <textarea 
          v-model="roofDataText" 
          class="roof-data-input" 
          rows="3"
          placeholder="Например: Данные крыши: Суммарная площадь кровель = 16 710 м2..."
        ></textarea>
      </div>
      
      <div class="actions-row">
        <button @click="addZone" class="btn-primary">+ Добавить участок (ось)</button>
      </div>
    </section>

    <div class="estimate-body">
      <div v-if="roofDataText" class="document-header-text">
        {{ roofDataText }}
      </div>

      <div v-for="(zone, zIdx) in estimateZones" :key="zone.id" class="zone-block">
        <div class="zone-header">
          <input v-model="zone.name" class="zone-title-input" placeholder="Название участка (например: Монтаж кровли в осях: 6-22/А-И)" />
          <button @click="removeZone(zIdx)" class="btn-icon text-danger hide-on-print" title="Удалить участок">✕</button>
        </div>

        <div v-for="(section, sIdx) in zone.sections" :key="section.id" class="section-block">
          <div class="section-header">
            <input v-model="section.title" class="section-title-input" placeholder="Название раздела (например: Подготовительные работы)" />
            <button @click="removeSection(zone, sIdx)" class="btn-icon text-danger hide-on-print" title="Удалить раздел">✕</button>
          </div>

          <div v-if="section.works.length > 0" class="table-wrapper">
            <div class="table-subtitle">Работы:</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th class="col-name">Наименование работ</th>
                  <th class="col-unit">Ед.изм.</th>
                  <th class="col-qty">Кол-во</th>
                  <th class="col-price">Цена за ед.</th>
                  <th class="col-sum">Сумма</th>
                  <th class="col-action hide-on-print"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(work, wIdx) in section.works" :key="wIdx">
                  <td><input v-model="work.name" class="cell-input text-left" /></td>
                  <td class="center"><input v-model="work.unit" class="cell-input center" /></td>
                  <td><input type="number" v-model.number="work.qty" class="cell-input right" step="0.01"></td>
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

          <div v-if="section.materials.length > 0" class="table-wrapper mt-3">
            <div class="table-subtitle">Материалы:</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th class="col-name">Наименование материалов</th>
                  <th class="col-unit">Ед.изм.</th>
                  <th class="col-qty">Кол-во</th>
                  <th class="col-price">Цена за ед.</th>
                  <th class="col-sum">Сумма</th>
                  <th class="col-action hide-on-print"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(mat, mIdx) in section.materials" :key="mIdx">
                  <td><input v-model="mat.name" class="cell-input text-left" /></td>
                  <td class="center"><input v-model="mat.unit" class="cell-input center" /></td>
                  <td><input type="number" v-model.number="mat.qty" class="cell-input right" step="0.01"></td>
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

          <div class="section-total-row">
            <span class="section-total-label">ИТОГО по Разделу:</span>
            <span class="section-total-value">{{ getSectionTotal(section).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
          </div>
          
          <div class="add-buttons-row hide-on-print">
             <button @click="addWork(section)" class="btn-text">+ Добавить работу</button>
             <button @click="addMaterial(section)" class="btn-text">+ Добавить материал</button>
          </div>
        </div>

        <div class="add-section-row hide-on-print">
          <button @click="addSection(zone)" class="btn-outline">+ Добавить раздел в этот участок</button>
        </div>
      </div>

      <section class="grand-totals">
        <div class="summary-line">
          <span>ИТОГО по Разделам монтажные работы:</span>
          <span class="bold">{{ grandTotalWorks.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
        </div>
        <div class="summary-line">
          <span>ИТОГО по Разделам материалы:</span>
          <span class="bold">{{ grandTotalMaterials.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
        </div>
        <div class="summary-line highlight-line">
          <span>Общая сумма по разделам:</span>
          <span class="bold">{{ (grandTotalWorks + grandTotalMaterials).toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
        </div>

        <div class="expenses-block mt-4">
          <h3 class="expenses-title">Накладные, транспортные, организационные и утилизационные расходы:</h3>
          <table class="data-table">
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
            <span class="subtotal-label">ИТОГО накладные расходы:</span>
            <span class="subtotal-value">{{ totalExpenses.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
          </div>
        </div>

        <div class="final-grand-total">
          <span>Итого общая сумма по всем разделам (с НДС-20%):</span>
          <span>{{ finalGrandTotal.toLocaleString('ru-RU', { minimumFractionDigits: 2 }) }} ₽</span>
        </div>
      </section>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { getDb } from '../database.js'; 

const projectName = ref('');
const roofDataText = ref("Данные крыши: Суммарная площадь кровель = 163 м2,\nПримыкания к парапету и вертикальным конструкциям = 55 пог.м.,\nВодоотведение парапетное = 4 шт.,\nАэраторы = 3 шт.");


const estimateZones = ref([
  {
    id: 1,
    name: 'Монтаж кровли в осях: 6-22/А-И',
    sections: [
      {
        id: 101,
        title: 'Подготовительные работы.',
        works: [
          { name: 'Подготовка поверхности (очистка поверхности)', unit: 'м2', qty: 2906, price: 50 },
          { name: 'Устройство L-образного профиля и профилей усиления', unit: 'м/п', qty: 852, price: 252 }
        ],
        materials: []
      },
      {
        id: 102,
        title: 'Устройство наплавляемой пароизоляции - Изоспан В.',
        works: [
          { name: 'Монтаж пароизоляции (плоскость + заведение на парапет)', unit: 'м2', qty: 2930.45, price: 231 }
        ],
        materials: []
      }
    ]
  }
]);


const overheadExpenses = ref([
  { name: 'Организационные расходы (доставка + накладные)', unit: 'ед', qty: 1, price: 900000 },
  { name: 'Утилизация строительного мусора', unit: 'ед', qty: 1, price: 200000 }
]);





async function saveProject() {
  if (!projectName.value) {
    alert('Пожалуйста, укажите название проекта перед сохранением!');
    return;
  }
  try {
    const db = await getDb();
    
    const projectSnapshot = {
      roofDataText: roofDataText.value,
      estimateZones: estimateZones.value,
      overheadExpenses: overheadExpenses.value
    };
    const jsonString = JSON.stringify(projectSnapshot);
    
    
    await db.execute(
      'INSERT INTO Сохраненные_сметы (название_объекта, данные_сметы_json) VALUES ($1, $2)',
      [projectName.value, jsonString]
    );
    alert('Смета успешно сохранена в базу данных!');
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    alert('Произошла ошибка при сохранении проекта.');
  }
}

async function loadProject() {
  const projectId = prompt('Введите ID сохраненной сметы (например, 1):');
  if (!projectId) return;
  
  try {
    const db = await getDb();
    const result = await db.select(
      'SELECT данные_сметы_json, название_объекта FROM Сохраненные_сметы WHERE идентификатор = $1', 
      [Number(projectId)]
    );
    
    if (result.length > 0) {
      const loadedData = JSON.parse(result[0].данные_сметы_json);
      
      roofDataText.value = loadedData.roofDataText || '';
      estimateZones.value = loadedData.estimateZones || [];
      overheadExpenses.value = loadedData.overheadExpenses || [];
      projectName.value = result[0].название_объекта;
      
      alert(`Смета "${projectName.value}" успешно загружена!`);
    } else {
      alert('Смета с таким ID не найдена в базе.');
    }
  } catch (error) {
    console.error('Ошибка загрузки:', error);
    alert('Произошла ошибка при чтении из базы данных.');
  }
}




let nextId = 1000;
function addZone() { estimateZones.value.push({ id: nextId++, name: 'Новый участок (ось)', sections: [] }); }
function removeZone(index) { if (confirm('Удалить весь участок со всеми расчетами?')) estimateZones.value.splice(index, 1); }
function addSection(zone) { zone.sections.push({ id: nextId++, title: 'Новый раздел', works: [], materials: [] }); }
function removeSection(zone, sIdx) { if (confirm('Удалить раздел?')) zone.sections.splice(sIdx, 1); }
function addWork(section) { section.works.push({ name: 'Новая работа', unit: 'м2', qty: 1, price: 0 }); }
function addMaterial(section) { section.materials.push({ name: 'Новый материал', unit: 'шт', qty: 1, price: 0 }); }
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
const finalGrandTotal = computed(() => grandTotalWorks.value + grandTotalMaterials.value + totalExpenses.value);


function printEstimate() { window.print(); }
</script>

<style scoped>
.estimate-container { max-width: 1300px; margin: 0 auto; padding: 2rem; font-family: 'Arial', sans-serif; color: #000; background: #fff; }
.header h1 { font-size: 1.8rem; text-align: center; margin-bottom: 0.5rem; text-transform: uppercase; }
.subtitle { text-align: center; color: #555; margin-bottom: 2rem; }


.controls-panel { background: #f8f9fa; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; border: 1px solid #dee2e6; display: flex; flex-direction: column; gap: 1rem; }
.db-controls-row { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1rem; }
.input-group { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; min-width: 250px; }
.input-group label { font-weight: bold; font-size: 0.9rem; color: #333; }
.project-name-input { padding: 0.7rem; border: 1px solid #ced4da; border-radius: 4px; font-size: 1rem; }
.action-buttons { display: flex; gap: 0.8rem; }
.divider { border: 0; border-top: 1px solid #dee2e6; margin: 1rem 0; }
.roof-data-input { width: 100%; padding: 0.8rem; border: 1px solid #ced4da; border-radius: 4px; font-family: inherit; resize: vertical; box-sizing: border-box; }

.btn-primary, .btn-secondary, .btn-success, .btn-warning, .btn-outline { padding: 0.6rem 1.2rem; border-radius: 4px; cursor: pointer; font-weight: bold; border: none; transition: 0.2s; }
.btn-primary { background: #0d6efd; color: white; }
.btn-secondary { background: #6c757d; color: white; }
.btn-success { background: #198754; color: white; }
.btn-warning { background: #ffc107; color: #000; }
.btn-outline { background: transparent; border: 2px dashed #0d6efd; color: #0d6efd; width: 100%; margin-top: 1rem; }
.btn-text { background: none; border: none; color: #198754; font-weight: bold; cursor: pointer; padding: 0.5rem 0; font-size: 0.9rem; }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 1.1rem; opacity: 0.5; }
.btn-icon:hover { opacity: 1; }
.text-danger { color: #dc3545; }

.document-header-text { white-space: pre-wrap; margin-bottom: 2rem; font-style: italic; font-size: 1.05rem; }


.zone-block { margin-bottom: 3rem; border: 2px solid #343a40; padding: 1.5rem; border-radius: 8px; }
.zone-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; background: #343a40; padding: 0.5rem 1rem; border-radius: 4px; }
.zone-title-input { background: transparent; border: none; color: white; font-size: 1.3rem; font-weight: bold; width: 100%; outline: none; }
.zone-title-input::placeholder { color: #adb5bd; }

.section-block { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px dashed #ced4da; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.section-title-input { font-size: 1.1rem; font-weight: bold; width: 100%; border: 1px solid transparent; padding: 0.3rem; outline: none; color: #000; border-bottom: 1px solid #000; }
.section-title-input:focus { border: 1px solid #86b7fe; background: #f8f9fa; }

.table-subtitle { font-weight: bold; margin-bottom: 0.5rem; font-style: italic; }
.data-table { width: 100%; border-collapse: collapse; margin-bottom: 0.5rem; font-size: 0.95rem; }
.data-table th, .data-table td { border: 1px solid #000; padding: 0; }
.data-table th { background-color: #f2f2f2; text-align: center; font-weight: bold; padding: 0.5rem; }


.cell-input { width: 100%; height: 100%; box-sizing: border-box; padding: 0.5rem; border: none; background: transparent; font-family: inherit; font-size: 0.95rem; }
.cell-input:focus { background-color: #e9ecef; outline: none; }
.text-left { text-align: left; }
.center { text-align: center; }
.right { text-align: right; }

.col-name { width: 45%; }
.col-unit { width: 8%; }
.col-qty { width: 10%; }
.col-price { width: 12%; }
.col-sum { width: 20%; }
.col-action { width: 5%; border: none !important; }

.bold { font-weight: bold; }
.mt-3 { margin-top: 1.5rem; }
.mt-4 { margin-top: 2.5rem; }
.mt-2 { margin-top: 1rem; }

.subtotal-row { text-align: right; padding: 0.5rem 0; font-size: 0.95rem; }
.subtotal-label { margin-right: 1rem; }
.subtotal-value { font-weight: bold; min-width: 150px; display: inline-block; }

.section-total-row { text-align: right; padding: 0.8rem 0; font-size: 1.1rem; font-weight: bold; border-top: 2px solid #000; margin-top: 0.5rem; }
.section-total-label { margin-right: 1rem; text-transform: uppercase; }
.section-total-value { min-width: 150px; display: inline-block; }


.grand-totals { margin-top: 2rem; border: 3px double #000; padding: 2rem; background-color: #fafafa; }
.summary-line { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; font-size: 1.1rem; }
.highlight-line { border-top: 1px solid #000; padding-top: 1rem; margin-top: 0.5rem; }
.expenses-title { font-size: 1.1rem; border-bottom: 1px solid #000; padding-bottom: 0.5rem; margin-bottom: 1rem; }
.final-grand-total { display: flex; justify-content: space-between; align-items: center; padding-top: 1.5rem; margin-top: 1.5rem; border-top: 2px solid #000; font-size: 1.3rem; font-weight: bold; color: #d32f2f; }


@media print {
  .hide-on-print { display: none !important; }
  .estimate-container { padding: 0; max-width: 1000px; }
  .cell-input { padding: 0.3rem; }
  .zone-block { border: none; padding: 0; margin-bottom: 1.5rem; }
  .zone-header { background: transparent; padding: 0; border-bottom: 2px solid #000; }
  .zone-title-input { color: #000; padding: 0; }
  .section-block { border-bottom: none; }
  .section-title-input { border: none; padding: 0; }
}
</style>