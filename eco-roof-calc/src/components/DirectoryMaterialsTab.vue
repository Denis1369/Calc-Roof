<template>
  <div class="tab-content">
    <section class="controls-card form-section">
      <h3>Добавить новый материал</h3>
      <form @submit.prevent="dir.addMaterial" class="form-vertical">
        <div class="row-basic">
          <div class="input-group">
            <label>Главная категория *</label>
            <input v-model="dir.newMaterial.главная_категория" type="text" placeholder="Например: Комплектация" required />
          </div>
          <div class="input-group">
            <label>Подкатегория</label>
            <input v-model="dir.newMaterial.подкатегория" type="text" placeholder="Например: Крепеж" />
          </div>
          <div class="input-group">
            <label>Артикул товара *</label>
            <input v-model="dir.newMaterial.артикул_товара" type="text" required />
          </div>
        </div>
        <div class="row-basic">
          <div class="input-group name-group">
            <label>Полное наименование материала *</label>
            <input v-model="dir.newMaterial.полное_наименование_материала" type="text" required />
          </div>
          <div class="input-group short-input">
            <label>Ед. изм. *</label>
            <select v-model="dir.newMaterial.единица_измерения" required>
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
            <input v-model.number="dir.newMaterial.базовая_цена" type="number" step="0.01" />
          </div>
        </div>
        <div class="row-basic">
          <div class="input-group" style="flex: 3;">
            <label>Ссылка на сайт (URL)</label>
            <input v-model="dir.newMaterial.ссылка" type="url" placeholder="https://..." />
          </div>
          <div class="button-group" style="flex: 1;">
            <button type="submit" class="btn-success w-100">+ Добавить материал</button>
          </div>
        </div>
      </form>
    </section>

    <section class="result-card">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <h3>Каталог материалов</h3>
          <label class="fav-filter" title="Показать только отмеченные материалы">
            <input type="checkbox" v-model="dir.onlyFavMaterials" /> ⭐ Только избранное
          </label>
        </div>
        <input v-model="dir.searchMaterial" placeholder="🔍 Поиск по названию или категории..." class="search-input" />
      </div>

      <div class="table-scroll">
        <table class="modern-table wide-table resizable-table">
          <thead>
            <tr>
              <th style="width: 40px; min-width: 40px;">⭐</th>
              <th :style="{ width: matColWidths.id + 'px', minWidth: matColWidths.id + 'px' }">ID <div class="resizer" @mousedown.stop="startResize($event, 'id')"></div></th>
              <th :style="{ width: matColWidths.article + 'px', minWidth: matColWidths.article + 'px' }">Артикул <div class="resizer" @mousedown.stop="startResize($event, 'article')"></div></th>
              <th :style="{ width: matColWidths.name + 'px', minWidth: matColWidths.name + 'px' }">Наименование <div class="resizer" @mousedown.stop="startResize($event, 'name')"></div></th>
              <th :style="{ width: matColWidths.unit + 'px', minWidth: matColWidths.unit + 'px' }">Ед. <div class="resizer" @mousedown.stop="startResize($event, 'unit')"></div></th>
              <th :style="{ width: matColWidths.price + 'px', minWidth: matColWidths.price + 'px' }">Цена <div class="resizer" @mousedown.stop="startResize($event, 'price')"></div></th>
              <th :style="{ width: matColWidths.actions + 'px', minWidth: matColWidths.actions + 'px' }"></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(subGroups, mainCat) in dir.groupedMaterials" :key="mainCat">
              <tr class="group-header mat-main-header" @click="dir.toggleMatMain(mainCat)">
                <td colspan="8"><span class="toggle-icon">{{ dir.collapsedMatMain[mainCat] ? '▶' : '▼' }}</span> {{ mainCat }}</td>
              </tr>
              <template v-if="!dir.collapsedMatMain[mainCat]">
                <template v-for="(items, subCat) in subGroups" :key="mainCat + subCat">
                  <tr class="group-header mat-sub-header" @click="dir.toggleMatSub(mainCat, subCat)">
                    <td colspan="8"><span class="toggle-icon">{{ dir.collapsedMatSub[mainCat + '_' + subCat] ? '▶' : '▼' }}</span> {{ subCat }} <span class="group-count">({{ items.length }} шт)</span></td>
                  </tr>
                  <template v-if="!dir.collapsedMatSub[mainCat + '_' + subCat]">
                    <tr v-for="mat in items" :key="mat.идентификатор" :class="{ 'is-fav': mat.избранное }">
                      <td class="center"><button @click="dir.toggleFavMaterial(mat)" class="btn-fav">{{ mat.избранное ? '⭐' : '☆' }}</button></td>
                      <td class="center text-muted">{{ mat.идентификатор }}</td>
                      <td><input v-model="mat.артикул_товара" @change="dir.updateMaterial(mat)" class="cell-input article" /></td>
                      <td><input v-model="mat.полное_наименование_материала" @change="dir.updateMaterial(mat)" class="cell-input text-left" /></td>
                      <td class="center"><input v-model="mat.единица_измерения" @change="dir.updateMaterial(mat)" class="cell-input center" /></td>
                      <td><input type="number" v-model.number="mat.базовая_цена" @change="dir.updateMaterial(mat)" class="cell-input right bold" step="0.01" /></td>
                      <td class="center"><button @click="dir.deleteMaterial(mat.идентификатор)" class="btn-danger" title="Удалить">🗑️</button></td>
                    </tr>
                  </template>
                </template>
              </template>
            </template>
            <tr v-if="Object.keys(dir.groupedMaterials).length === 0"><td colspan="8" class="center empty-message">По вашему запросу ничего не найдено</td></tr>
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


const matColWidths = reactive({ id: 60, article: 150, name: 350, unit: 80, price: 100, link: 150, actions: 60 });
let isResizing = false;
let currentHeader = null;
let startX = 0;
let startWidth = 0;

function startResize(e, headerKey) {
  isResizing = true;
  currentHeader = headerKey;
  startX = e.clientX;
  startWidth = matColWidths[headerKey];
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e) {
  if (!isResizing) return;
  matColWidths[currentHeader] = Math.max(50, startWidth + (e.clientX - startX));
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
.table-toolbar h3 { margin: 0; color: var(--text-main, #FFFFFF); }

.fav-filter { display: flex; align-items: center; gap: 8px; font-weight: bold; color: var(--accent, #F29A2E); cursor: pointer; user-select: none; padding: 5px 10px; border-radius: 6px; background: rgba(242, 154, 46, 0.1); border: 1px solid var(--accent, #F29A2E); transition: background 0.2s; }
.fav-filter:hover { background: rgba(242, 154, 46, 0.2); }

.search-input { width: 350px; padding: 0.6rem 1rem; border: 1px solid var(--border-color, #4A5A63); background-color: #21292E; color: var(--text-main, #FFFFFF); border-radius: 6px; font-size: 0.95rem; outline: none; transition: all 0.2s ease-in-out; }
.search-input:focus { border-color: var(--accent, #F29A2E); box-shadow: 0 0 0 2px rgba(242, 154, 46, 0.2); }

.empty-message { padding: 2rem !important; color: var(--text-muted, #A0B1BA); font-style: italic; font-size: 1rem; text-align: center; }

.btn-fav { background: none; border: none; font-size: 1.3rem; cursor: pointer; transition: transform 0.1s; color: var(--text-muted, #A0B1BA); }
.btn-fav:hover { transform: scale(1.2); color: var(--accent, #F29A2E); }
.is-fav { background-color: rgba(242, 154, 46, 0.08) !important; }

.group-header { cursor: pointer; transition: background-color 0.2s; }
.group-header td { background-color: #21292E; color: var(--accent, #F29A2E); font-weight: bold; font-size: 1.05rem; padding: 0.8rem 1rem !important; border: none !important; user-select: none; border-left: 4px solid var(--accent, #F29A2E) !important; }
.toggle-icon { display: inline-block; width: 20px; font-size: 0.9rem; color: var(--text-muted, #A0B1BA); }
.group-count { font-size: 0.85rem; color: var(--text-muted, #A0B1BA); margin-left: 10px; font-weight: normal; }

.mat-main-header td { background-color: #2A3439 !important; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent, #F29A2E); font-weight: 600; border-bottom: 1px solid var(--border-color, #4A5A63) !important; }
.mat-main-header:hover td { background-color: #37444B !important; }
.mat-sub-header td { background-color: #21292E !important; padding-left: 2.5rem !important; color: var(--text-main, #FFFFFF); font-weight: 500; }
.mat-sub-header:hover td { background-color: #2A3439 !important; }

.cell-input { width: 100%; height: 100%; box-sizing: border-box; padding: 0.6rem; border: 1px solid transparent; background: transparent; font-family: inherit; font-size: 0.9rem; color: var(--text-main, #FFFFFF); transition: all 0.2s; }
.cell-input:hover { background-color: rgba(255, 255, 255, 0.05); border-radius: 4px; }
.cell-input:focus { background-color: #21292E; border: 1px solid var(--accent, #F29A2E); outline: none; border-radius: 4px; box-shadow: 0 0 0 2px rgba(242, 154, 46, 0.2); }

.link-cell { position: relative; display: flex; align-items: center; }
.link-icon { text-decoration: none; position: absolute; right: 10px; font-size: 1.2rem; transition: transform 0.2s; color: var(--accent, #F29A2E); }
.link-icon:hover { transform: scale(1.2); }

.controls-card { background: var(--bg-panel, #37444B); padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin-bottom: 2rem; border-top: 4px solid var(--accent, #F29A2E); }
.result-card { background: var(--bg-panel, #37444B); padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }

.form-vertical { display: flex; flex-direction: column; gap: 1.2rem; }
.row-basic { display: flex; gap: 1rem; align-items: end; }
.name-group { flex: 3; }
.short-input { flex: 1; }
.input-group { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
.input-group label { font-size: 0.85rem; font-weight: 600; color: var(--text-muted, #A0B1BA); }
.input-group input, .input-group select { background-color: #21292E; color: var(--text-main, #FFFFFF); padding: 0.6rem; border: 1px solid var(--border-color, #4A5A63); border-radius: 6px; font-size: 0.95rem; outline: none; transition: 0.2s;}
.input-group input:focus, .input-group select:focus { border-color: var(--accent, #F29A2E); }
.w-100 { width: 100%; }

.button-group { display: flex; align-items: flex-end; }
.btn-success { background: var(--accent, #F29A2E); color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 6px; cursor: pointer; font-weight: 600; transition: 0.2s; white-space: nowrap; }
.btn-success:hover { background: var(--accent-hover, #D98826); }
.btn-danger { background: none; border: none; font-size: 1.2rem; cursor: pointer; opacity: 0.6; color: var(--text-muted, #A0B1BA); } 
.btn-danger:hover { opacity: 1; color: #ff4d4f; }

.table-scroll { overflow-x: auto; max-height: 75vh; }
.resizable-table { table-layout: fixed; width: max-content; min-width: 100%; }
.modern-table { border-collapse: collapse; text-align: left; }
.modern-table th { position: sticky; top: 0; z-index: 2; background-color: #21292E; color: var(--text-muted, #A0B1BA); padding: 0.8rem; font-size: 0.85rem; text-align: center; border-bottom: 2px solid var(--accent, #F29A2E); border-right: 1px solid var(--border-color, #4A5A63); white-space: nowrap; }
.modern-table td { padding: 0; border-bottom: 1px solid var(--border-color, #4A5A63); font-size: 0.9rem; border-right: 1px solid rgba(255,255,255,0.05); color: var(--text-main, #FFFFFF); }
.modern-table td > button { margin: 0.6rem; }

.resizer { position: absolute; right: 0; top: 0; bottom: 0; width: 6px; cursor: col-resize; background-color: transparent; z-index: 10; }
.resizer:hover, .resizer:active { background-color: var(--accent, #F29A2E); }

.article { font-family: monospace; font-weight: bold; color: var(--accent, #F29A2E); } 
.center { text-align: center; }
.right { text-align: right; }
.bold { font-weight: bold; }
.text-muted { color: var(--text-muted, #A0B1BA); }

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