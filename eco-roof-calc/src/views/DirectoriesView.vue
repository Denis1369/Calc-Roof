<template>
  <div class="eco-container">
    <header class="header">
      <h1>Управление справочниками</h1>
      <p>База материалов и расценок на работы</p>
    </header>

    <div class="tabs">
      <button :class="{ active: activeTab === 'materials' }" @click="activeTab = 'materials'">Материалы (Каталог)</button>
      <button :class="{ active: activeTab === 'works' }" @click="activeTab = 'works'">Работы (Сгруппированные)</button>
    </div>

    <div v-if="activeTab === 'materials'" class="tab-content">
      <section class="controls-card form-section">
        <h3>Добавить новый материал</h3>
        <form @submit.prevent="addMaterial" class="form-vertical">
          <div class="row-basic">
            <div class="input-group">
              <label>Главная категория *</label>
              <input v-model="newMaterial.главная_категория" type="text" placeholder="Например: Комплектация" required />
            </div>
            <div class="input-group">
              <label>Подкатегория</label>
              <input v-model="newMaterial.подкатегория" type="text" placeholder="Например: Крепеж" />
            </div>
            <div class="input-group">
              <label>Артикул товара *</label>
              <input v-model="newMaterial.артикул_товара" type="text" required />
            </div>
          </div>
          <div class="row-basic">
            <div class="input-group name-group">
              <label>Полное наименование материала *</label>
              <input v-model="newMaterial.полное_наименование_материала" type="text" required />
            </div>
            <div class="input-group short-input">
              <label>Ед. изм. *</label>
              <select v-model="newMaterial.единица_измерения" required>
                <option value="м2">м²</option>
                <option value="м3">м³</option>
                <option value="шт">шт</option>
                <option value="м/п">м/п</option>
                <option value="л">л</option>
                <option value="кг">кг</option>
              </select>
            </div>
            <div class="input-group short-input">
              <label>Базовая цена (₽)</label>
              <input v-model.number="newMaterial.базовая_цена" type="number" step="0.01" />
            </div>
            <div class="button-group">
              <button type="submit" class="btn-success">+ Добавить материал</button>
            </div>
          </div>
        </form>
      </section>

      <section class="result-card">
        <div class="table-toolbar">
          <div class="toolbar-left">
            <h3>Каталог материалов</h3>
            <label class="fav-filter" title="Показать только отмеченные материалы">
              <input type="checkbox" v-model="onlyFavMaterials" /> 
              ⭐ Только избранное
            </label>
          </div>
          <input v-model="searchMaterial" placeholder="🔍 Поиск по названию или категории..." class="search-input" />
        </div>

        <div class="table-scroll">
          <table class="modern-table wide-table resizable-table">
            <thead>
              <tr>
                <th style="width: 40px; min-width: 40px;">⭐</th>
                <th :style="{ width: matColWidths.id + 'px', minWidth: matColWidths.id + 'px' }">
                  ID <div class="resizer" @mousedown.stop="startResize($event, 'id', matColWidths)"></div>
                </th>
                <th :style="{ width: matColWidths.article + 'px', minWidth: matColWidths.article + 'px' }">
                  Артикул <div class="resizer" @mousedown.stop="startResize($event, 'article', matColWidths)"></div>
                </th>
                <th :style="{ width: matColWidths.name + 'px', minWidth: matColWidths.name + 'px' }">
                  Наименование <div class="resizer" @mousedown.stop="startResize($event, 'name', matColWidths)"></div>
                </th>
                <th :style="{ width: matColWidths.unit + 'px', minWidth: matColWidths.unit + 'px' }">
                  Ед. изм. <div class="resizer" @mousedown.stop="startResize($event, 'unit', matColWidths)"></div>
                </th>
                <th :style="{ width: matColWidths.price + 'px', minWidth: matColWidths.price + 'px' }">
                  Цена (₽) <div class="resizer" @mousedown.stop="startResize($event, 'price', matColWidths)"></div>
                </th>
                <th :style="{ width: matColWidths.actions + 'px', minWidth: matColWidths.actions + 'px' }"></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(subGroups, mainCat) in groupedMaterials" :key="mainCat">
                
                <tr class="group-header mat-main-header" @click="toggleMatMain(mainCat)">
                  <td colspan="7">
                    <span class="toggle-icon">{{ collapsedMatMain[mainCat] ? '▶' : '▼' }}</span> {{ mainCat }}
                  </td>
                </tr>

                <template v-if="!collapsedMatMain[mainCat]">
                  <template v-for="(items, subCat) in subGroups" :key="mainCat + subCat">
                    
                    <tr class="group-header mat-sub-header" @click="toggleMatSub(mainCat, subCat)">
                      <td colspan="7">
                        <span class="toggle-icon">{{ collapsedMatSub[mainCat + '_' + subCat] ? '▶' : '▼' }}</span> 
                        {{ subCat }} <span class="group-count">({{ items.length }} шт)</span>
                      </td>
                    </tr>

                    <template v-if="!collapsedMatSub[mainCat + '_' + subCat]">
                      <tr v-for="mat in items" :key="mat.идентификатор" :class="{ 'is-fav': mat.избранное }">
                        <td class="center">
                          <button @click="toggleFavMaterial(mat)" class="btn-fav" :title="mat.избранное ? 'Убрать из избранного' : 'В избранное'">
                            {{ mat.избранное ? '⭐' : '☆' }}
                          </button>
                        </td>
                        <td class="center text-muted">{{ mat.идентификатор }}</td>
                        <td><input v-model="mat.артикул_товара" @change="updateMaterial(mat)" class="cell-input article" /></td>
                        <td><input v-model="mat.полное_наименование_материала" @change="updateMaterial(mat)" class="cell-input text-left" /></td>
                        <td class="center"><input v-model="mat.единица_измерения" @change="updateMaterial(mat)" class="cell-input center" /></td>
                        <td><input type="number" v-model.number="mat.базовая_цена" @change="updateMaterial(mat)" class="cell-input right bold" step="0.01" /></td>
                        <td class="center"><button @click="deleteMaterial(mat.идентификатор)" class="btn-danger" title="Удалить">🗑️</button></td>
                      </tr>
                    </template>

                  </template>
                </template>

              </template>
              <tr v-if="Object.keys(groupedMaterials).length === 0">
                <td colspan="7" class="center empty-message">По вашему запросу ничего не найдено</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div v-if="activeTab === 'works'" class="tab-content">
      <section class="controls-card form-section work-theme">
        <h3>Добавить новую расценку на работы</h3>
        <form @submit.prevent="addWork" class="form-vertical">
          <div class="row-basic">
            <div class="input-group">
              <label>Категория раздела *</label>
              <input v-model="newWork.категория_работы" type="text" list="category-list" placeholder="Демонтаж, Основание..." required />
              <datalist id="category-list">
                <option v-for="cat in uniqueCategories" :key="cat" :value="cat"></option>
              </datalist>
            </div>
            <div class="input-group name-group">
              <label>Наименование работы *</label>
              <input v-model="newWork.наименование_работы" type="text" placeholder="Например: Монтаж мембраны..." required />
            </div>
            <div class="input-group short-input">
              <label>Ед. изм. *</label>
              <select v-model="newWork.единица_измерения_работы" required>
                <option value="м2">м²</option>
                <option value="м/п">м/п</option>
                <option value="шт">шт</option>
                <option value="ед">ед</option>
                <option value="компл">компл</option>
                <option value="рейс">рейс</option>
                <option value="смена">смена</option>
              </select>
            </div>
          </div>

          <label class="section-label">Цены в зависимости от объема (₽):</label>
          <div class="prices-grid">
            <div class="price-input"><label>0 - 300</label><input v-model.number="newWork.цена_0_300" type="number" step="0.01" /></div>
            <div class="price-input"><label>300 - 600</label><input v-model.number="newWork.цена_300_600" type="number" step="0.01" /></div>
            <div class="price-input"><label>600 - 1000</label><input v-model.number="newWork.цена_600_1000" type="number" step="0.01" /></div>
            <div class="price-input"><label>1000 - 3000</label><input v-model.number="newWork.цена_1000_3000" type="number" step="0.01" /></div>
            <div class="price-input"><label>3000 - 6000</label><input v-model.number="newWork.цена_3000_6000" type="number" step="0.01" /></div>
            <div class="price-input"><label>6000 - 15000</label><input v-model.number="newWork.цена_6000_15000" type="number" step="0.01" /></div>
            <div class="price-input"><label>15000 - 30000</label><input v-model.number="newWork.цена_15000_30000" type="number" step="0.01" /></div>
            <div class="price-input"><label>> 30000</label><input v-model.number="newWork.цена_более_30000" type="number" step="0.01" /></div>
          </div>

          <div class="button-row">
            <button type="submit" class="btn-primary">+ Добавить работу</button>
          </div>
        </form>
      </section>

      <section class="result-card">
        <div class="table-toolbar">
          <div class="toolbar-left">
            <h3>Список работ</h3>
            <label class="fav-filter" title="Показать только отмеченные работы">
              <input type="checkbox" v-model="onlyFavWorks" /> 
              ⭐ Только избранное
            </label>
          </div>
          <input v-model="searchWork" placeholder="🔍 Поиск по наименованию или категории..." class="search-input" />
        </div>

        <div class="table-scroll">
          <table class="modern-table wide-table resizable-table">
            <thead>
              <tr>
                <th style="width: 40px; min-width: 40px;">⭐</th>
                <th :style="{ width: workColWidths.name + 'px', minWidth: workColWidths.name + 'px' }">
                  Наименование <div class="resizer" @mousedown.stop="startResize($event, 'name', workColWidths)"></div>
                </th>
                <th :style="{ width: workColWidths.unit + 'px', minWidth: workColWidths.unit + 'px' }">
                  Ед. <div class="resizer" @mousedown.stop="startResize($event, 'unit', workColWidths)"></div>
                </th>
                <th :style="{ width: workColWidths.p1 + 'px', minWidth: workColWidths.p1 + 'px' }">0-300 <div class="resizer" @mousedown.stop="startResize($event, 'p1', workColWidths)"></div></th>
                <th :style="{ width: workColWidths.p2 + 'px', minWidth: workColWidths.p2 + 'px' }">300-600 <div class="resizer" @mousedown.stop="startResize($event, 'p2', workColWidths)"></div></th>
                <th :style="{ width: workColWidths.p3 + 'px', minWidth: workColWidths.p3 + 'px' }">600-1k <div class="resizer" @mousedown.stop="startResize($event, 'p3', workColWidths)"></div></th>
                <th :style="{ width: workColWidths.p4 + 'px', minWidth: workColWidths.p4 + 'px' }">1k-3k <div class="resizer" @mousedown.stop="startResize($event, 'p4', workColWidths)"></div></th>
                <th :style="{ width: workColWidths.p5 + 'px', minWidth: workColWidths.p5 + 'px' }">3k-6k <div class="resizer" @mousedown.stop="startResize($event, 'p5', workColWidths)"></div></th>
                <th :style="{ width: workColWidths.p6 + 'px', minWidth: workColWidths.p6 + 'px' }">6k-15k <div class="resizer" @mousedown.stop="startResize($event, 'p6', workColWidths)"></div></th>
                <th :style="{ width: workColWidths.p7 + 'px', minWidth: workColWidths.p7 + 'px' }">15k-30k <div class="resizer" @mousedown.stop="startResize($event, 'p7', workColWidths)"></div></th>
                <th :style="{ width: workColWidths.p8 + 'px', minWidth: workColWidths.p8 + 'px' }">>30k <div class="resizer" @mousedown.stop="startResize($event, 'p8', workColWidths)"></div></th>
                <th :style="{ width: workColWidths.actions + 'px', minWidth: workColWidths.actions + 'px' }"></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(group, category) in groupedWorks" :key="category">
                
                <tr class="group-header" @click="toggleGroup(category)" title="Нажмите, чтобы свернуть/развернуть">
                  <td colspan="12">
                    <span class="toggle-icon">{{ collapsedGroups[category] ? '▶' : '▼' }}</span>
                    {{ category }} <span class="group-count">({{ group.length }} позиций)</span>
                  </td>
                </tr>
                
                <tr v-for="work in group" :key="work.идентификатор" v-show="!collapsedGroups[category]" :class="{ 'is-fav': work.избранное }">
                  <td class="center">
                    <button @click="toggleFavWork(work)" class="btn-fav" :title="work.избранное ? 'Убрать из избранного' : 'В избранное'">
                      {{ work.избранное ? '⭐' : '☆' }}
                    </button>
                  </td>
                  <td><input v-model="work.наименование_работы" @change="updateWork(work)" class="cell-input text-left work-name" /></td>
                  <td class="center"><input v-model="work.единица_измерения_работы" @change="updateWork(work)" class="cell-input center" /></td>
                  <td><input type="number" v-model.number="work.цена_0_300" @change="updateWork(work)" class="cell-input right" step="0.01" /></td>
                  <td><input type="number" v-model.number="work.цена_300_600" @change="updateWork(work)" class="cell-input right" step="0.01" /></td>
                  <td><input type="number" v-model.number="work.цена_600_1000" @change="updateWork(work)" class="cell-input right" step="0.01" /></td>
                  <td><input type="number" v-model.number="work.цена_1000_3000" @change="updateWork(work)" class="cell-input right" step="0.01" /></td>
                  <td><input type="number" v-model.number="work.цена_3000_6000" @change="updateWork(work)" class="cell-input right" step="0.01" /></td>
                  <td><input type="number" v-model.number="work.цена_6000_15000" @change="updateWork(work)" class="cell-input right" step="0.01" /></td>
                  <td><input type="number" v-model.number="work.цена_15000_30000" @change="updateWork(work)" class="cell-input right" step="0.01" /></td>
                  <td><input type="number" v-model.number="work.цена_более_30000" @change="updateWork(work)" class="cell-input right" step="0.01" /></td>
                  <td class="center">
                    <button @click="deleteWork(work.идентификатор)" class="btn-danger" title="Удалить">🗑️</button>
                  </td>
                </tr>

              </template>
              <tr v-if="Object.keys(groupedWorks).length === 0">
                <td colspan="12" class="center empty-message">По вашему запросу ничего не найдено</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { getDb } from '../database.js';

const activeTab = ref('materials');
const materials = ref([]);
const works = ref([]);


const searchMaterial = ref('');
const searchWork = ref('');
const onlyFavMaterials = ref(false); 
const onlyFavWorks = ref(false); 


const collapsedGroups = ref({});
const collapsedMatMain = ref({});
const collapsedMatSub = ref({});

const newMaterial = ref({ 
  главная_категория: '', подкатегория: '', артикул_товара: '', 
  полное_наименование_материала: '', единица_измерения: 'м2', базовая_цена: 0 
});

const newWork = ref({
  категория_работы: '', наименование_работы: '', единица_измерения_работы: 'м2',
  цена_0_300: 0, цена_300_600: 0, цена_600_1000: 0, цена_1000_3000: 0,
  цена_3000_6000: 0, цена_6000_15000: 0, цена_15000_30000: 0, цена_более_30000: 0
});




const matColWidths = reactive({ id: 60, article: 150, name: 400, unit: 100, price: 120, actions: 60 });
const workColWidths = reactive({ name: 300, unit: 70, p1: 90, p2: 90, p3: 90, p4: 90, p5: 90, p6: 90, p7: 90, p8: 90, actions: 60 });

let isResizing = false;
let currentHeader = null;
let startX = 0;
let startWidth = 0;

function startResize(e, headerKey, colWidthsObj) {
  isResizing = true;
  currentHeader = { key: headerKey, obj: colWidthsObj };
  startX = e.clientX;
  startWidth = colWidthsObj[headerKey];
  
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e) {
  if (!isResizing) return;
  const deltaX = e.clientX - startX;
  currentHeader.obj[currentHeader.key] = Math.max(50, startWidth + deltaX);
}

function onMouseUp() {
  isResizing = false;
  currentHeader = null;
  document.body.style.userSelect = '';
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
}




async function toggleFavMaterial(mat) {
  mat.избранное = mat.избранное ? 0 : 1;
  try {
    const db = await getDb();
    await db.execute("UPDATE Справочник_материалов SET избранное = $1 WHERE идентификатор = $2", [mat.избранное, mat.идентификатор]);
  } catch(e) { console.error('Ошибка сохранения избранного', e); }
}

async function toggleFavWork(work) {
  work.избранное = work.избранное ? 0 : 1;
  try {
    const db = await getDb();
    await db.execute("UPDATE Справочник_видов_работ SET избранное = $1 WHERE идентификатор = $2", [work.избранное, work.идентификатор]);
  } catch(e) { console.error('Ошибка сохранения избранного', e); }
}




const filteredWorks = computed(() => {
  let list = works.value;
  if (onlyFavWorks.value) {
    list = list.filter(w => w.избранное);
  }
  if (!searchWork.value) return list;
  const query = searchWork.value.toLowerCase();
  return list.filter(w => 
    (w.наименование_работы && w.наименование_работы.toLowerCase().includes(query)) ||
    (w.категория_работы && w.категория_работы.toLowerCase().includes(query))
  );
});

const groupedWorks = computed(() => {
  const groups = {};
  filteredWorks.value.forEach(work => {
    const cat = work.категория_работы || 'Общие работы';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(work);
  });
  return groups;
});

const uniqueCategories = computed(() => {
  const cats = new Set(works.value.map(w => w.категория_работы || 'Общие работы'));
  return Array.from(cats);
});

function toggleGroup(category) {
  collapsedGroups.value[category] = !collapsedGroups.value[category];
}

watch([searchWork, onlyFavWorks], () => {
  if (searchWork.value.trim().length > 0 || onlyFavWorks.value) {
    for (const cat in groupedWorks.value) collapsedGroups.value[cat] = false;
  }
});




const filteredMaterials = computed(() => {
  let list = materials.value;
  if (onlyFavMaterials.value) {
    list = list.filter(m => m.избранное);
  }
  if (!searchMaterial.value) return list;
  const query = searchMaterial.value.toLowerCase();
  return list.filter(m => 
    (m.полное_наименование_материала && m.полное_наименование_материала.toLowerCase().includes(query)) ||
    (m.артикул_товара && String(m.артикул_товара).toLowerCase().includes(query)) ||
    (m.главная_категория && m.главная_категория.toLowerCase().includes(query)) ||
    (m.подкатегория && m.подкатегория.toLowerCase().includes(query))
  );
});

const groupedMaterials = computed(() => {
  const groups = {};
  filteredMaterials.value.forEach(mat => {
    const main = mat.главная_категория || 'Без категории';
    const sub = mat.подкатегория || 'Без подкатегории';
    
    if (!groups[main]) groups[main] = {};
    if (!groups[main][sub]) groups[main][sub] = [];
    
    groups[main][sub].push(mat);
  });
  return groups;
});

function toggleMatMain(mainCat) { collapsedMatMain.value[mainCat] = !collapsedMatMain.value[mainCat]; }
function toggleMatSub(mainCat, subCat) {
  const key = `${mainCat}_${subCat}`;
  collapsedMatSub.value[key] = !collapsedMatSub.value[key];
}

watch([searchMaterial, onlyFavMaterials], () => {
  if (searchMaterial.value.trim().length > 0 || onlyFavMaterials.value) {
    for (const mainCat in groupedMaterials.value) {
      collapsedMatMain.value[mainCat] = false;
      for (const subCat in groupedMaterials.value[mainCat]) {
        collapsedMatSub.value[`${mainCat}_${subCat}`] = false;
      }
    }
  }
});




async function loadData() {
  const db = await getDb();
  
  materials.value = await db.select('SELECT * FROM Справочник_материалов ORDER BY избранное DESC, главная_категория, подкатегория, полное_наименование_материала ASC');
  works.value = await db.select('SELECT * FROM Справочник_видов_работ ORDER BY избранное DESC, идентификатор ASC');
  
  if (!searchMaterial.value && !onlyFavMaterials.value) {
    for (const mainCat in groupedMaterials.value) {
      collapsedMatMain.value[mainCat] = true;
      for (const subCat in groupedMaterials.value[mainCat]) {
        collapsedMatSub.value[`${mainCat}_${subCat}`] = true;
      }
    }
  }
  if (!searchWork.value && !onlyFavWorks.value) {
    for (const cat in groupedWorks.value) {
      collapsedGroups.value[cat] = true;
    }
  }
}




async function addMaterial() {
  try {
    const db = await getDb();
    await db.execute(
      `INSERT INTO Справочник_материалов (главная_категория, подкатегория, артикул_товара, полное_наименование_материала, единица_измерения, базовая_цена, избранное) VALUES ($1, $2, $3, $4, $5, $6, 0)`,
      [newMaterial.value.главная_категория || 'Без категории', newMaterial.value.подкатегория || 'Без подкатегории', newMaterial.value.артикул_товара, newMaterial.value.полное_наименование_материала, newMaterial.value.единица_измерения, newMaterial.value.базовая_цена || 0]
    );
    collapsedMatMain.value[newMaterial.value.главная_категория || 'Без категории'] = false;
    collapsedMatSub.value[`${newMaterial.value.главная_категория || 'Без категории'}_${newMaterial.value.подкатегория || 'Без подкатегории'}`] = false;
    newMaterial.value = { главная_категория: '', подкатегория: '', артикул_товара: '', полное_наименование_материала: '', единица_измерения: 'м2', базовая_цена: 0 };
    await loadData();
  } catch (e) { alert('Ошибка при добавлении материала.'); console.error(e); }
}

async function addWork() {
  try {
    const db = await getDb();
    await db.execute(
      `INSERT INTO Справочник_видов_работ (категория_работы, наименование_работы, единица_измерения_работы, цена_0_300, цена_300_600, цена_600_1000, цена_1000_3000, цена_3000_6000, цена_6000_15000, цена_15000_30000, цена_более_30000, избранное) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)`,
      [newWork.value.категория_работы || 'Общие работы', newWork.value.наименование_работы, newWork.value.единица_измерения_работы, newWork.value.цена_0_300 || 0, newWork.value.цена_300_600 || 0, newWork.value.цена_600_1000 || 0, newWork.value.цена_1000_3000 || 0, newWork.value.цена_3000_6000 || 0, newWork.value.цена_6000_15000 || 0, newWork.value.цена_15000_30000 || 0, newWork.value.цена_более_30000 || 0]
    );
    collapsedGroups.value[newWork.value.категория_работы] = false;
    newWork.value = { категория_работы: '', наименование_работы: '', единица_измерения_работы: 'м2', цена_0_300: 0, цена_300_600: 0, цена_600_1000: 0, цена_1000_3000: 0, цена_3000_6000: 0, цена_6000_15000: 0, цена_15000_30000: 0, цена_более_30000: 0 };
    await loadData();
  } catch (error) { console.error(error); alert('Ошибка добавления работы'); }
}

async function updateMaterial(mat) {
  try {
    const db = await getDb();
    await db.execute(`UPDATE Справочник_материалов SET артикул_товара = $1, полное_наименование_материала = $2, единица_измерения = $3, базовая_цена = $4 WHERE идентификатор = $5`, [mat.артикул_товара, mat.полное_наименование_материала, mat.единица_измерения, mat.базовая_цена, mat.идентификатор]);
  } catch (e) { console.error("Ошибка обновления материала", e); }
}

async function updateWork(work) {
  try {
    const db = await getDb();
    await db.execute(`UPDATE Справочник_видов_работ SET наименование_работы = $1, единица_измерения_работы = $2, цена_0_300 = $3, цена_300_600 = $4, цена_600_1000 = $5, цена_1000_3000 = $6, цена_3000_6000 = $7, цена_6000_15000 = $8, цена_15000_30000 = $9, цена_более_30000 = $10 WHERE идентификатор = $11`, [work.наименование_работы, work.единица_измерения_работы, work.цена_0_300 || 0, work.цена_300_600 || 0, work.цена_600_1000 || 0, work.цена_1000_3000 || 0, work.цена_3000_6000 || 0, work.цена_6000_15000 || 0, work.цена_15000_30000 || 0, work.цена_более_30000 || 0, work.идентификатор]);
  } catch (e) { console.error("Ошибка обновления расценки", e); }
}

async function deleteMaterial(id) {
  if (confirm('Удалить материал?')) {
    const db = await getDb(); await db.execute('DELETE FROM Справочник_материалов WHERE идентификатор = $1', [id]); await loadData();
  }
}
async function deleteWork(id) {
  if (confirm('Удалить расценку на работу?')) {
    const db = await getDb(); await db.execute('DELETE FROM Справочник_видов_работ WHERE идентификатор = $1', [id]); await loadData();
  }
}
onMounted(() => loadData());
</script>

<style scoped>

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.2rem;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 20px;
}
.table-toolbar h3 {
  margin: 0;
  color: #333;
}
.fav-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
  color: #d97706;
  cursor: pointer;
  user-select: none;
  padding: 5px 10px;
  border-radius: 6px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  transition: background 0.2s;
}
.fav-filter:hover { background: #fef3c7; }

.search-input {
  width: 350px;
  padding: 0.6rem 1rem;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.2s ease-in-out;
}
.search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}
.empty-message {
  padding: 2rem !important;
  color: #6b7280;
  font-style: italic;
  font-size: 1rem;
}


.btn-fav {
  background: none;
  border: none;
  font-size: 1.3rem;
  cursor: pointer;
  transition: transform 0.1s;
}
.btn-fav:hover { transform: scale(1.2); }
.is-fav { background-color: #fffbeb !important; }


.group-header {
  cursor: pointer;
  transition: background-color 0.2s;
}
.group-header td {
  background-color: #374151; 
  color: #ffffff; 
  font-weight: bold;
  font-size: 1.05rem;
  padding: 0.8rem 1rem !important;
  border: none !important;
  user-select: none;
}
.toggle-icon { display: inline-block; width: 20px; font-size: 0.9rem; color: #9ca3af; }
.group-count { font-size: 0.85rem; color: #9ca3af; margin-left: 10px; font-weight: normal; }


.mat-main-header td { background-color: #2e7d32 !important; text-transform: uppercase; letter-spacing: 0.05em; }
.mat-main-header:hover td { background-color: #1b5e20 !important; }
.mat-sub-header td { background-color: #4b5563 !important; padding-left: 2.5rem !important; }
.mat-sub-header:hover td { background-color: #374151 !important; }


.cell-input {
  width: 100%; height: 100%; box-sizing: border-box; padding: 0.6rem;
  border: 1px solid transparent; background: transparent;
  font-family: inherit; font-size: 0.9rem; color: inherit; transition: all 0.2s;
}
.cell-input:hover { background-color: #f3f4f6; border-radius: 4px; }
.cell-input:focus { background-color: #ffffff; border: 1px solid #3b82f6; outline: none; border-radius: 4px; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
.work-name { font-weight: 600; color: #1f2937; }


.eco-container { max-width: 1400px; margin: 0 auto; padding: 2rem; font-family: 'Inter', sans-serif; }
.header h1 { color: #2e7d32; margin-bottom: 0.5rem; }
.tabs { display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 2px solid #e0e0e0; padding-bottom: 0.5rem; }
.tabs button { background: none; border: none; font-size: 1.1rem; font-weight: 600; color: #757575; cursor: pointer; padding: 0.5rem 1rem; border-radius: 6px; transition: 0.2s; }
.tabs button:hover { background: #f5f5f5; }
.tabs button.active { color: #2e7d32; background: #e8f5e9; }

.controls-card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 2rem; border-top: 4px solid #4caf50; }
.work-theme { border-top-color: #1976d2; }


.form-vertical { display: flex; flex-direction: column; gap: 1.2rem; }
.row-basic { display: flex; gap: 1rem; align-items: end; }
.name-group { flex: 3; }
.short-input { flex: 1; }

.section-label { font-weight: bold; font-size: 0.9rem; color: #555; margin-bottom: -1rem; display: block; }
.prices-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 0.8rem; background: #f8f9fa; padding: 1rem; border-radius: 8px; border: 1px solid #e0e0e0; }
.price-input { display: flex; flex-direction: column; gap: 0.3rem; }
.price-input label { font-size: 0.8rem; font-weight: bold; color: #4b5563; text-align: center; white-space: nowrap; }
.price-input input { padding: 0.5rem; border: 1px solid #ced4da; border-radius: 4px; text-align: center; font-size: 0.95rem; width: 100%; box-sizing: border-box; }

.input-group { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
.input-group label { font-size: 0.85rem; font-weight: 600; color: #555; }
.input-group input, .input-group select { padding: 0.6rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.95rem; }

.button-group { display: flex; align-items: flex-end; }
.button-row { display: flex; justify-content: flex-end; }
.btn-primary, .btn-success { color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 6px; cursor: pointer; font-weight: 600; transition: 0.2s; white-space: nowrap; }
.btn-success { background: #2e7d32; } .btn-success:hover { background: #1b5e20; }
.btn-primary { background: #1976d2; } .btn-primary:hover { background: #1565c0; }
.btn-danger { background: none; border: none; font-size: 1.2rem; cursor: pointer; opacity: 0.6; } .btn-danger:hover { opacity: 1; color: red; }

.result-card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.table-scroll { overflow-x: auto; max-height: 75vh; }


.resizable-table { table-layout: fixed; width: max-content; min-width: 100%; }
.modern-table { border-collapse: collapse; text-align: left; }
.modern-table th { 
  position: sticky; 
  top: 0; 
  z-index: 2; 
  background-color: #f4f6f8; 
  color: #555; 
  padding: 0.8rem; 
  font-size: 0.85rem; 
  text-align: center; 
  border-bottom: 2px solid #ddd; 
  border-right: 1px solid #ddd;
  white-space: nowrap; 
}
.modern-table td { padding: 0; border-bottom: 1px solid #edf2f7; font-size: 0.9rem; border-right: 1px solid #f1f5f9; }
.modern-table td > button { margin: 0.6rem; }


.resizer {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  background-color: transparent;
  z-index: 10;
}
.resizer:hover, .resizer:active {
  background-color: #3b82f6;
}

.article { font-family: monospace; font-weight: bold; color: #2e7d32; }
.center { text-align: center; }
.right { text-align: right; }
.bold { font-weight: bold; }
.text-muted { color: #888; }
</style>