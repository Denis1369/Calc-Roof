<template>
  <div class="tab-content">
    <section class="controls-card form-section work-theme">
      <h3>Добавить новую расценку на работы</h3>
      <form @submit.prevent="dir.addWork" class="form-vertical">
        <div class="row-basic">
          <div class="input-group">
            <label>Категория раздела *</label>
            <input v-model="dir.newWork.категория_работы" type="text" list="category-list" placeholder="Демонтаж, Основание..." required />
            <datalist id="category-list">
              <option v-for="cat in dir.uniqueCategories" :key="cat" :value="cat"></option>
            </datalist>
          </div>
          <div class="input-group name-group">
            <label>Наименование работы *</label>
            <input v-model="dir.newWork.наименование_работы" type="text" placeholder="Например: Монтаж мембраны..." required />
          </div>
          <div class="input-group short-input">
            <label>Ед. изм. *</label>
            <select v-model="dir.newWork.единица_измерения_работы" required>
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
          <div class="price-input"><label>0 - 300</label><input v-model.number="dir.newWork.цена_0_300" type="number" step="0.01" /></div>
          <div class="price-input"><label>300 - 600</label><input v-model.number="dir.newWork.цена_300_600" type="number" step="0.01" /></div>
          <div class="price-input"><label>600 - 1000</label><input v-model.number="dir.newWork.цена_600_1000" type="number" step="0.01" /></div>
          <div class="price-input"><label>1000 - 3000</label><input v-model.number="dir.newWork.цена_1000_3000" type="number" step="0.01" /></div>
          <div class="price-input"><label>3000 - 6000</label><input v-model.number="dir.newWork.цена_3000_6000" type="number" step="0.01" /></div>
          <div class="price-input"><label>6000 - 15000</label><input v-model.number="dir.newWork.цена_6000_15000" type="number" step="0.01" /></div>
          <div class="price-input"><label>15000 - 30000</label><input v-model.number="dir.newWork.цена_15000_30000" type="number" step="0.01" /></div>
          <div class="price-input"><label>> 30000</label><input v-model.number="dir.newWork.цена_более_30000" type="number" step="0.01" /></div>
        </div>

        <div class="button-row mt-3">
          <button type="submit" class="btn-primary">+ Добавить работу</button>
        </div>
      </form>
    </section>

    <section class="result-card">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <h3>Список работ</h3>
          <label class="fav-filter" title="Показать только отмеченные работы">
            <input type="checkbox" v-model="dir.onlyFavWorks" /> ⭐ Только избранное
          </label>
        </div>
        <input v-model="dir.searchWork" placeholder="🔍 Поиск по наименованию или категории..." class="search-input" />
      </div>

      <div class="table-scroll">
        <table class="modern-table wide-table resizable-table">
          <thead>
            <tr>
              <th style="width: 40px; min-width: 40px;">⭐</th>
              <th :style="{ width: workColWidths.name + 'px', minWidth: workColWidths.name + 'px' }">Наименование <div class="resizer" @mousedown.stop="startResize($event, 'name')"></div></th>
              <th :style="{ width: workColWidths.unit + 'px', minWidth: workColWidths.unit + 'px' }">Ед. <div class="resizer" @mousedown.stop="startResize($event, 'unit')"></div></th>
              <th :style="{ width: workColWidths.p1 + 'px', minWidth: workColWidths.p1 + 'px' }">0-300 <div class="resizer" @mousedown.stop="startResize($event, 'p1')"></div></th>
              <th :style="{ width: workColWidths.p2 + 'px', minWidth: workColWidths.p2 + 'px' }">300-600 <div class="resizer" @mousedown.stop="startResize($event, 'p2')"></div></th>
              <th :style="{ width: workColWidths.p3 + 'px', minWidth: workColWidths.p3 + 'px' }">600-1k <div class="resizer" @mousedown.stop="startResize($event, 'p3')"></div></th>
              <th :style="{ width: workColWidths.p4 + 'px', minWidth: workColWidths.p4 + 'px' }">1k-3k <div class="resizer" @mousedown.stop="startResize($event, 'p4')"></div></th>
              <th :style="{ width: workColWidths.p5 + 'px', minWidth: workColWidths.p5 + 'px' }">3k-6k <div class="resizer" @mousedown.stop="startResize($event, 'p5')"></div></th>
              <th :style="{ width: workColWidths.p6 + 'px', minWidth: workColWidths.p6 + 'px' }">6k-15k <div class="resizer" @mousedown.stop="startResize($event, 'p6')"></div></th>
              <th :style="{ width: workColWidths.p7 + 'px', minWidth: workColWidths.p7 + 'px' }">15k-30k <div class="resizer" @mousedown.stop="startResize($event, 'p7')"></div></th>
              <th :style="{ width: workColWidths.p8 + 'px', minWidth: workColWidths.p8 + 'px' }">>30k <div class="resizer" @mousedown.stop="startResize($event, 'p8')"></div></th>
              <th :style="{ width: workColWidths.actions + 'px', minWidth: workColWidths.actions + 'px' }"></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(group, category) in dir.groupedWorks" :key="category">
              <tr class="group-header" @click="dir.toggleGroup(category)">
                <td colspan="12"><span class="toggle-icon">{{ dir.collapsedGroups[category] ? '▶' : '▼' }}</span>{{ category }} <span class="group-count">({{ group.length }} позиций)</span></td>
              </tr>
              <tr v-for="work in group" :key="work.идентификатор" v-show="!dir.collapsedGroups[category]" :class="{ 'is-fav': work.избранное }">
                <td class="center"><button @click="dir.toggleFavWork(work)" class="btn-fav">{{ work.избранное ? '⭐' : '☆' }}</button></td>
                <td><input v-model="work.наименование_работы" @change="dir.updateWork(work)" class="cell-input text-left work-name" /></td>
                <td class="center"><input v-model="work.единица_измерения_работы" @change="dir.updateWork(work)" class="cell-input center" /></td>
                <td><input type="number" v-model.number="work.цена_0_300" @change="dir.updateWork(work)" class="cell-input right" step="0.01" /></td>
                <td><input type="number" v-model.number="work.цена_300_600" @change="dir.updateWork(work)" class="cell-input right" step="0.01" /></td>
                <td><input type="number" v-model.number="work.цена_600_1000" @change="dir.updateWork(work)" class="cell-input right" step="0.01" /></td>
                <td><input type="number" v-model.number="work.цена_1000_3000" @change="dir.updateWork(work)" class="cell-input right" step="0.01" /></td>
                <td><input type="number" v-model.number="work.цена_3000_6000" @change="dir.updateWork(work)" class="cell-input right" step="0.01" /></td>
                <td><input type="number" v-model.number="work.цена_6000_15000" @change="dir.updateWork(work)" class="cell-input right" step="0.01" /></td>
                <td><input type="number" v-model.number="work.цена_15000_30000" @change="dir.updateWork(work)" class="cell-input right" step="0.01" /></td>
                <td><input type="number" v-model.number="work.цена_более_30000" @change="dir.updateWork(work)" class="cell-input right" step="0.01" /></td>
                <td class="center"><button @click="dir.deleteWork(work.идентификатор)" class="btn-danger" title="Удалить">🗑️</button></td>
              </tr>
            </template>
            <tr v-if="Object.keys(dir.groupedWorks).length === 0"><td colspan="12" class="center empty-message">По вашему запросу ничего не найдено</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { reactive } from 'vue';

const props = defineProps({
  dir: { type: Object, required: true }
});

const workColWidths = reactive({ name: 300, unit: 70, p1: 90, p2: 90, p3: 90, p4: 90, p5: 90, p6: 90, p7: 90, p8: 90, actions: 60 });
let isResizing = false;
let currentHeader = null;
let startX = 0;
let startWidth = 0;

function startResize(e, headerKey) {
  isResizing = true;
  currentHeader = headerKey;
  startX = e.clientX;
  startWidth = workColWidths[headerKey];
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e) {
  if (!isResizing) return;
  workColWidths[currentHeader] = Math.max(50, startWidth + (e.clientX - startX));
}

function onMouseUp() {
  isResizing = false;
  currentHeader = null;
  document.body.style.userSelect = '';
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
}
</script>

<style scoped>
.table-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; }
.toolbar-left { display: flex; align-items: center; gap: 20px; }
.table-toolbar h3 { margin: 0; color: #FFFFFF; }
.fav-filter { display: flex; align-items: center; gap: 8px; font-weight: bold; color: #F29A2E; cursor: pointer; user-select: none; padding: 5px 10px; border-radius: 6px; background: rgba(242, 154, 46, 0.1); border: 1px solid #F29A2E; transition: background 0.2s; }
.fav-filter:hover { background: rgba(242, 154, 46, 0.2); }
.search-input { width: 350px; padding: 0.6rem 1rem; border: 1px solid #4A5A63; background-color: #21292E; color: #FFFFFF; border-radius: 6px; font-size: 0.95rem; outline: none; transition: all 0.2s ease-in-out; }
.search-input:focus { border-color: #F29A2E; box-shadow: 0 0 0 2px rgba(242, 154, 46, 0.2); }
.empty-message { padding: 2rem !important; color: #A0B1BA; font-style: italic; font-size: 1rem; text-align: center; }
.btn-fav { background: none; border: none; font-size: 1.3rem; cursor: pointer; transition: transform 0.1s; color: #A0B1BA; }
.btn-fav:hover { transform: scale(1.2); color: #F29A2E; }
.is-fav { background-color: rgba(242, 154, 46, 0.08) !important; }
.group-header { cursor: pointer; transition: background-color 0.2s; }
.group-header td { background-color: #21292E; color: #F29A2E; font-weight: bold; font-size: 1.05rem; padding: 0.8rem 1rem !important; border: none !important; user-select: none; border-left: 4px solid #F29A2E !important; }
.toggle-icon { display: inline-block; width: 20px; font-size: 0.9rem; color: #A0B1BA; }
.group-count { font-size: 0.85rem; color: #A0B1BA; margin-left: 10px; font-weight: normal; }
.cell-input { width: 100%; height: 100%; box-sizing: border-box; padding: 0.6rem; border: 1px solid transparent; background: transparent; font-family: inherit; font-size: 0.9rem; color: #FFFFFF; transition: all 0.2s; }
.cell-input:hover { background-color: rgba(255, 255, 255, 0.05); border-radius: 4px; }
.cell-input:focus { background-color: #21292E; border: 1px solid #F29A2E; outline: none; border-radius: 4px; box-shadow: 0 0 0 2px rgba(242, 154, 46, 0.2); }
.work-name { font-weight: 600; color: #FFFFFF; }
.controls-card { background: #37444B; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin-bottom: 2rem; border-top: 4px solid #F29A2E; }
.work-theme { border-top-color: #F29A2E; }
.form-vertical { display: flex; flex-direction: column; gap: 1.2rem; }
.row-basic { display: flex; gap: 1rem; align-items: end; }
.name-group { flex: 3; }
.short-input { flex: 1; }
.section-label { font-weight: bold; font-size: 0.9rem; color: #A0B1BA; margin-bottom: -1rem; display: block; }
.prices-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 0.8rem; background: #2A3439; padding: 1rem; border-radius: 8px; border: 1px solid #4A5A63; }
.price-input { display: flex; flex-direction: column; gap: 0.3rem; }
.price-input label { font-size: 0.8rem; font-weight: bold; color: #A0B1BA; text-align: center; white-space: nowrap; }
.price-input input { padding: 0.5rem; border: 1px solid #4A5A63; background-color: #21292E; color: #FFFFFF; border-radius: 4px; text-align: center; font-size: 0.95rem; width: 100%; box-sizing: border-box; outline: none; transition: 0.2s; }
.price-input input:focus { border-color: #F29A2E; }
.input-group { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
.input-group label { font-size: 0.85rem; font-weight: 600; color: #A0B1BA; }
.input-group input, .input-group select { padding: 0.6rem; border: 1px solid #4A5A63; background-color: #21292E; color: #FFFFFF; border-radius: 6px; font-size: 0.95rem; outline: none; transition: 0.2s; }
.input-group input:focus, .input-group select:focus { border-color: #F29A2E; }
.button-row { display: flex; justify-content: flex-end; }
.btn-primary { color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 6px; cursor: pointer; font-weight: 600; transition: 0.2s; white-space: nowrap; background: #F29A2E; }
.btn-primary:hover { background: #D98826; }
.btn-danger { background: none; border: none; font-size: 1.2rem; cursor: pointer; opacity: 0.6; color: #A0B1BA; } 
.btn-danger:hover { opacity: 1; color: #ff4d4f; }
.result-card { background: #37444B; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.table-scroll { overflow-x: auto; max-height: 75vh; }
.resizable-table { table-layout: fixed; width: max-content; min-width: 100%; }
.modern-table { border-collapse: collapse; text-align: left; }
.modern-table th { position: sticky; top: 0; z-index: 2; background-color: #21292E; color: #A0B1BA; padding: 0.8rem; font-size: 0.85rem; text-align: center; border-bottom: 2px solid #F29A2E; border-right: 1px solid #4A5A63; white-space: nowrap; }
.modern-table td { padding: 0; border-bottom: 1px solid #4A5A63; font-size: 0.9rem; border-right: 1px solid rgba(255,255,255,0.05); color: #FFFFFF; }
.modern-table td > button { margin: 0.6rem; }
.resizer { position: absolute; right: 0; top: 0; bottom: 0; width: 6px; cursor: col-resize; background-color: transparent; z-index: 10; }
.resizer:hover, .resizer:active { background-color: #F29A2E; }
.center { text-align: center; } .right { text-align: right; } .mt-3 { margin-top: 1.5rem;}

input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}

input[type="number"] {
  text-align: right;
}
</style>