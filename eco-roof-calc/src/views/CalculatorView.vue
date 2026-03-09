<template>
  <div class="estimate-container">
    <header class="header hide-on-print">
      <h1>Коммерческая смета объекта</h1>
      <p class="subtitle">Сводный расчет с разбивкой по участкам и авто-подтягиванием цен из БД</p>
    </header>

    <section class="controls-panel hide-on-print">
      <div class="db-controls-row">
        <div class="input-group">
          <label>Название проекта (для сохранения):</label>
          <input v-model="projectName" placeholder="Например: ТЦ Галактика, кровля" class="project-name-input" />
        </div>
        <div class="action-buttons">
          <button @click="saveProject" class="btn-success">💾 Сохранить</button>
          <button @click="loadProject" class="btn-warning">📂 Загрузить</button>
          <button @click="printEstimate" class="btn-secondary">🖨️ Печать</button>
        </div>
      </div>

      <hr class="divider" />

      <div class="roof-params-block">
        <h3>Ввод параметров крыши (влияют на расчет объемов)</h3>
        <div class="params-grid">
          <div class="input-group">
            <label>Общая площадь кровли (м²)</label>
            <input type="number" v-model.number="roofParams.area" @input="recalculateVolumes" placeholder="Например: 603" min="0" step="0.1" />
          </div>
          <div class="input-group">
            <label>Периметр парапетов (пог.м)</label>
            <input type="number" v-model.number="roofParams.perimeter" @input="recalculateVolumes" placeholder="Например: 108.7" min="0" step="0.1" />
          </div>
          <div class="input-group">
            <label>Водоотведение парапетное (шт)</label>
            <input type="number" v-model.number="roofParams.parapetDrains" @input="recalculateVolumes" placeholder="Например: 7" min="0" />
          </div>
          <div class="input-group">
            <label>Водоотведение внутреннее (шт)</label>
            <input type="number" v-model.number="roofParams.innerDrains" @input="recalculateVolumes" placeholder="Например: 2" min="0" />
          </div>
          <div class="input-group">
            <label>Аэраторы (шт)</label>
            <input type="number" v-model.number="roofParams.aerators" @input="recalculateVolumes" placeholder="Например: 4" min="0" />
          </div>
        </div>
      </div>
      
      <div class="actions-row mt-3">
        <button @click="addZone" class="btn-primary">+ Добавить участок (ось)</button>
      </div>
    </section>

    <div class="estimate-body">
      
      <div class="document-header-text">
        <strong>Данные крыши:</strong><br/>
        Суммарная площадь кровель = {{ roofParams.area }} м2,<br/>
        Примыкания к парапету и вертикальным конструкциям = {{ roofParams.perimeter }} пог.м.,<br/>
        Водоотведение парапетное = {{ roofParams.parapetDrains }} шт.,<br/>
        Водоотведение внутреннее = {{ roofParams.innerDrains }} шт.,<br/>
        Аэраторы = {{ roofParams.aerators }} шт.
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

          <div class="works-group mt-3">
            <div class="table-subtitle">Работы:</div>
            <div v-if="section.works.length > 0" class="table-wrapper">
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
                    <td>
                      <input 
                        v-model="work.name" 
                        list="works-list"
                        @change="updateWorkPrice(work)"
                        class="cell-input text-left" 
                        placeholder="Начните вводить для поиска..." 
                      />
                    </td>
                    <td class="center"><input v-model="work.unit" class="cell-input center" /></td>
                    <td><input type="number" v-model.number="work.qty" @input="updateWorkPrice(work)" class="cell-input right" step="0.01"></td>
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
                    <td>
                      <input 
                        v-model="mat.name" 
                        list="materials-list"
                        @change="updateMaterialPrice(mat)"
                        class="cell-input text-left" 
                        placeholder="Начните вводить для поиска..." 
                      />
                    </td>
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

    <datalist id="works-list">
      <option v-for="w in worksDb" :key="w.идентификатор" :value="w.наименование_работы"></option>
    </datalist>
    <datalist id="materials-list">
      <option v-for="m in materialsDb" :key="m.идентификатор" :value="m.полное_наименование_материала"></option>
    </datalist>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router'; 
import { getDb } from '../database.js';

const route = useRoute(); 
const projectName = ref('');


const worksDb = ref([]);
const materialsDb = ref([]);

const roofParams = ref({
  area: 0,
  perimeter: 0,
  parapetDrains: 0,
  innerDrains: 0,
  aerators: 0
});

const estimateZones = ref([]);

const overheadExpenses = ref([
  { name: 'Организационные расходы (доставка + накладные)', unit: 'ед', qty: 1, price: 0 },
  { name: 'Утилизация строительного мусора', unit: 'ед', qty: 1, price: 0 }
]);

let nextId = 1000;




onMounted(async () => {
  
  try {
    const db = await getDb();
    worksDb.value = await db.select('SELECT * FROM Справочник_видов_работ');
    materialsDb.value = await db.select('SELECT * FROM Справочник_материалов');
  } catch (error) {
    console.error('Ошибка при загрузке справочников:', error);
  }

  
  if (route.query.preset) {
    loadPresetTemplate(route.query.preset);
  } else if (estimateZones.value.length === 0) {
    addZone(); 
  }
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




function recalculateVolumes() {
  estimateZones.value.forEach(zone => {
    zone.sections.forEach(section => {
      
      section.works.forEach(work => {
        if (work.baseParam === 'area') work.qty = +(roofParams.value.area * (work.coef || 1)).toFixed(2);
        if (work.baseParam === 'perimeter') work.qty = +(roofParams.value.perimeter * (work.coef || 1)).toFixed(2);
        if (work.baseParam === 'parapetDrains') work.qty = roofParams.value.parapetDrains;
        if (work.baseParam === 'innerDrains') work.qty = roofParams.value.innerDrains;
        if (work.baseParam === 'aerators') work.qty = roofParams.value.aerators;
        
        
        updateWorkPrice(work); 
      });

      section.materials.forEach(mat => {
        if (mat.baseParam === 'area') mat.qty = +(roofParams.value.area * (mat.coef || 1)).toFixed(2);
        if (mat.baseParam === 'perimeter') mat.qty = +(roofParams.value.perimeter * (mat.coef || 1)).toFixed(2);
        if (mat.baseParam === 'parapetDrains') mat.qty = roofParams.value.parapetDrains;
        if (mat.baseParam === 'innerDrains') mat.qty = roofParams.value.innerDrains;
        if (mat.baseParam === 'aerators') mat.qty = roofParams.value.aerators;
      });

    });
  });
}




function loadPresetTemplate(presetId) {
  const templates = {
    'tn-krovlya-smart': {
      name: 'Монтаж ТН-КРОВЛЯ Смарт (Профлист + ПВХ)',
      sections: [
        {
          id: nextId++, title: '1. Устройство пароизоляции',
          works: [ { name: 'Укладка пароизоляционной пленки (плоскость)', unit: 'м2', qty: 0, price: 0, baseParam: 'area', coef: 1 } ],
          materials: [ { name: 'Паробарьер С (А500 или С1000)', unit: 'м2', qty: 0, price: 0, baseParam: 'area', coef: 1.1 } ]
        },
        {
          id: nextId++, title: '2. Устройство теплоизоляции',
          works: [ { name: 'Монтаж плит утеплителя в 2 слоя', unit: 'м2', qty: 0, price: 0, baseParam: 'area', coef: 1 } ],
          materials: [ 
            { name: 'Утеплитель ТЕХНОРУФ Н Проф (нижний слой, 100мм)', unit: 'м3', qty: 0, price: 0, baseParam: 'area', coef: 0.105 },
            { name: 'Утеплитель ТЕХНОРУФ В Оптима (верхний слой, 50мм)', unit: 'м3', qty: 0, price: 0, baseParam: 'area', coef: 0.052 }
          ]
        },
        {
          id: nextId++, title: '3. Устройство гидроизоляции',
          works: [ 
            { name: 'Монтаж ПВХ мембраны с механическим креплением', unit: 'м2', qty: 0, price: 0, baseParam: 'area', coef: 1 },
            { name: 'Монтаж примыканий ПВХ мембраны к парапету', unit: 'м/п', qty: 0, price: 0, baseParam: 'perimeter', coef: 1 },
            { name: 'Установка аэраторов', unit: 'шт', qty: 0, price: 0, baseParam: 'aerators', coef: 1 }
          ],
          materials: [ 
            { name: 'Мембрана полимерная LOGICROOF V-RP 1.5мм', unit: 'м2', qty: 0, price: 0, baseParam: 'area', coef: 1.15 },
            { name: 'Телескопический крепеж ТехноНИКОЛЬ', unit: 'шт', qty: 0, price: 0, baseParam: 'area', coef: 5 },
            { name: 'Аэратор кровельный', unit: 'шт', qty: 0, price: 0, baseParam: 'aerators', coef: 1 }
          ]
        }
      ]
    },
    'tn-krovlya-classic': {
      name: 'Монтаж ТН-КРОВЛЯ Классик (Бетон + Битум)',
      sections: [
        {
          id: nextId++, title: '1. Подготовка основания и пароизоляция',
          works: [ 
            { name: 'Огрунтовка праймером', unit: 'м2', qty: 0, price: 0, baseParam: 'area', coef: 1 },
            { name: 'Наплавление пароизоляции', unit: 'м2', qty: 0, price: 0, baseParam: 'area', coef: 1 }
          ],
          materials: [ 
            { name: 'Праймер битумный ТЕХНОНИКОЛЬ №01', unit: 'л', qty: 0, price: 0, baseParam: 'area', coef: 0.35 }, 
            { name: 'Биполь ЭПП (пароизоляция)', unit: 'м2', qty: 0, price: 0, baseParam: 'area', coef: 1.1 }
          ]
        },
        {
          id: nextId++, title: '2. Гидроизоляция',
          works: [ 
            { name: 'Наплавление рулонной гидроизоляции в 2 слоя', unit: 'м2', qty: 0, price: 0, baseParam: 'area', coef: 1 },
            { name: 'Установка воронок', unit: 'шт', qty: 0, price: 0, baseParam: 'innerDrains', coef: 1 }
          ],
          materials: [ 
            { name: 'Унифлекс ЭПП (нижний слой)', unit: 'м2', qty: 0, price: 0, baseParam: 'area', coef: 1.15 },
            { name: 'Техноэласт ЭКП (верхний слой с посыпкой)', unit: 'м2', qty: 0, price: 0, baseParam: 'area', coef: 1.15 },
            { name: 'Воронка внутреннего водостока', unit: 'шт', qty: 0, price: 0, baseParam: 'innerDrains', coef: 1 }
          ]
        }
      ]
    }
  };

  const selectedPreset = templates[presetId] || templates['tn-krovlya-smart']; 
  
  projectName.value = `Проект: ${selectedPreset.name}`;
  estimateZones.value = [{
    id: nextId++,
    name: selectedPreset.name,
    sections: selectedPreset.sections
  }];
  
  
  setTimeout(() => {
    estimateZones.value.forEach(zone => {
      zone.sections.forEach(sec => {
        sec.works.forEach(w => updateWorkPrice(w));
        sec.materials.forEach(m => updateMaterialPrice(m));
      });
    });
  }, 300);

  recalculateVolumes();
}





async function saveProject() {
  if (!projectName.value) {
    alert('Пожалуйста, укажите название проекта перед сохранением!');
    return;
  }
  try {
    const db = await getDb();
    const projectSnapshot = {
      roofParams: roofParams.value,
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
      roofParams.value = loadedData.roofParams || { area: 0, perimeter: 0, parapetDrains: 0, innerDrains: 0, aerators: 0 };
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




function addZone() { estimateZones.value.push({ id: nextId++, name: 'Новый участок (ось)', sections: [] }); }
function removeZone(index) { if (confirm('Удалить весь участок со всеми расчетами?')) estimateZones.value.splice(index, 1); }
function addSection(zone) { zone.sections.push({ id: nextId++, title: 'Новый раздел', works: [], materials: [] }); }
function removeSection(zone, sIdx) { if (confirm('Удалить раздел?')) zone.sections.splice(sIdx, 1); }
function addWork(section) { section.works.push({ name: '', unit: 'м2', qty: 1, price: 0, baseParam: 'none', coef: 1 }); }
function addMaterial(section) { section.materials.push({ name: '', unit: 'шт', qty: 1, price: 0, baseParam: 'none', coef: 1 }); }
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
.input-group { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; min-width: 200px; }
.input-group label { font-weight: bold; font-size: 0.85rem; color: #333; }
.project-name-input { padding: 0.7rem; border: 1px solid #ced4da; border-radius: 4px; font-size: 1rem; }
.action-buttons { display: flex; gap: 0.8rem; }
.divider { border: 0; border-top: 1px solid #dee2e6; margin: 1rem 0; }


.roof-params-block h3 { margin-top: 0; font-size: 1.1rem; color: #2e7d32; }
.params-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
.params-grid input { padding: 0.6rem; border: 1px solid #0d6efd; border-radius: 4px; font-size: 1rem; font-weight: bold; background: #f0f8ff; }

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

.document-header-text { margin-bottom: 2rem; padding: 1rem; border-left: 4px solid #0d6efd; background: #f8f9fa; font-size: 1.05rem; line-height: 1.6; }


.zone-block { margin-bottom: 3rem; border: 2px solid #343a40; padding: 1.5rem; border-radius: 8px; }
.zone-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; background: #343a40; padding: 0.5rem 1rem; border-radius: 4px; }
.zone-title-input { background: transparent; border: none; color: white; font-size: 1.3rem; font-weight: bold; width: 100%; outline: none; }
.zone-title-input::placeholder { color: #adb5bd; }

.section-block { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px dashed #ced4da; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.section-title-input { font-size: 1.1rem; font-weight: bold; width: 100%; border: 1px solid transparent; padding: 0.3rem; outline: none; color: #000; border-bottom: 1px solid #000; }
.section-title-input:focus { border: 1px solid #86b7fe; background: #f8f9fa; }

.works-group, .materials-group { margin-bottom: 1rem; }
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
.mt-1 { margin-top: 0.5rem; }

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
  .document-header-text { border-left: none; background: transparent; padding: 0; border-bottom: 1px solid #000; padding-bottom: 1rem; }
}
</style>