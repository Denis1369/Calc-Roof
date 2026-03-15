<template>
  <div class="tab-content">
    <section class="controls-card page-card">
      <h3 class="section-title">Добавить новый материал</h3>

      <form @submit.prevent="dir.addMaterial" class="form-vertical">
        <div class="row-basic">
          <div class="input-group">
            <label class="ui-label">Главная категория *</label>
            <input
              v-model="dir.newMaterial.главная_категория"
              type="text"
              placeholder="Например: Комплектация"
              required
              class="ui-input"
            />
          </div>

          <div class="input-group">
            <label class="ui-label">Подкатегория</label>
            <input
              v-model="dir.newMaterial.подкатегория"
              type="text"
              placeholder="Например: Крепеж"
              class="ui-input"
            />
          </div>

          <div class="input-group">
            <label class="ui-label">Артикул товара *</label>
            <input
              v-model="dir.newMaterial.артикул_товара"
              type="text"
              required
              class="ui-input"
            />
          </div>
        </div>

        <div class="row-basic">
          <div class="input-group name-group">
            <label class="ui-label">Полное наименование материала *</label>
            <input
              v-model="dir.newMaterial.полное_наименование_материала"
              type="text"
              required
              class="ui-input"
            />
          </div>

          <div class="input-group short-input">
            <label class="ui-label">Ед. изм. *</label>
            <select v-model="dir.newMaterial.единица_измерения" required class="ui-select">
              <option value="м2">м²</option>
              <option value="м3">м³</option>
              <option value="шт">шт</option>
              <option value="м/п">м/п</option>
              <option value="л">л</option>
              <option value="кг">кг</option>
            </select>
          </div>

          <div class="input-group short-input">
            <label class="ui-label">Базовая цена (₽)</label>
            <input
              v-model.number="dir.newMaterial.базовая_цена"
              type="number"
              step="0.01"
              class="ui-input"
            />
          </div>
        </div>

        <div class="row-basic">
          <div class="input-group link-group">
            <label class="ui-label">Ссылка на сайт (URL)</label>
            <input
              v-model="dir.newMaterial.ссылка"
              type="url"
              placeholder="https://..."
              class="ui-input"
            />
          </div>

          <div class="button-group">
            <button type="submit" class="ui-btn ui-btn-success w-100">+ Добавить материал</button>
          </div>
        </div>
      </form>
    </section>

    <section class="result-card page-card">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <h3 class="section-title no-margin">Каталог материалов</h3>

          <label class="fav-filter" title="Показать только отмеченные материалы">
            <input type="checkbox" v-model="dir.onlyFavMaterials" />
            <span>⭐ Только избранное</span>
          </label>
        </div>

        <input
          v-model="dir.searchMaterial"
          placeholder="🔍 Поиск по названию или категории..."
          class="ui-input search-input"
        />
      </div>

      <div class="table-scroll">
        <table class="modern-table wide-table resizable-table">
          <thead>
            <tr>
              <th style="width: 40px; min-width: 40px;">⭐</th>
              <th :style="{ width: matColWidths.id + 'px', minWidth: matColWidths.id + 'px' }">
                ID
                <div class="resizer" @mousedown.stop="startResize($event, 'id')"></div>
              </th>
              <th :style="{ width: matColWidths.article + 'px', minWidth: matColWidths.article + 'px' }">
                Артикул
                <div class="resizer" @mousedown.stop="startResize($event, 'article')"></div>
              </th>
              <th :style="{ width: matColWidths.name + 'px', minWidth: matColWidths.name + 'px' }">
                Наименование
                <div class="resizer" @mousedown.stop="startResize($event, 'name')"></div>
              </th>
              <th :style="{ width: matColWidths.unit + 'px', minWidth: matColWidths.unit + 'px' }">
                Ед.
                <div class="resizer" @mousedown.stop="startResize($event, 'unit')"></div>
              </th>
              <th :style="{ width: matColWidths.price + 'px', minWidth: matColWidths.price + 'px' }">
                Цена
                <div class="resizer" @mousedown.stop="startResize($event, 'price')"></div>
              </th>
              <th :style="{ width: matColWidths.actions + 'px', minWidth: matColWidths.actions + 'px' }"></th>
            </tr>
          </thead>

          <tbody>
            <template v-for="(subGroups, mainCat) in dir.groupedMaterials" :key="mainCat">
              <tr class="group-header mat-main-header" @click="dir.toggleMatMain(mainCat)">
                <td colspan="8">
                  <span class="toggle-icon">{{ dir.collapsedMatMain[mainCat] ? '▶' : '▼' }}</span>
                  {{ mainCat }}
                </td>
              </tr>

              <template v-if="!dir.collapsedMatMain[mainCat]">
                <template v-for="(items, subCat) in subGroups" :key="mainCat + subCat">
                  <tr class="group-header mat-sub-header" @click="dir.toggleMatSub(mainCat, subCat)">
                    <td colspan="8">
                      <span class="toggle-icon">{{ dir.collapsedMatSub[mainCat + '_' + subCat] ? '▶' : '▼' }}</span>
                      {{ subCat }}
                      <span class="group-count">({{ items.length }} шт)</span>
                    </td>
                  </tr>

                  <template v-if="!dir.collapsedMatSub[mainCat + '_' + subCat]">
                    <tr v-for="mat in items" :key="mat.идентификатор" :class="{ 'is-fav': mat.избранное }">
                      <td class="center">
                        <button @click="dir.toggleFavMaterial(mat)" class="btn-fav">
                          {{ mat.избранное ? '⭐' : '☆' }}
                        </button>
                      </td>

                      <td class="center text-muted">{{ mat.идентификатор }}</td>

                      <td>
                        <input
                          v-model="mat.артикул_товара"
                          @change="dir.updateMaterial(mat)"
                          class="cell-input article"
                        />
                      </td>

                      <td>
                        <input
                          v-model="mat.полное_наименование_материала"
                          @change="dir.updateMaterial(mat)"
                          class="cell-input text-left"
                        />
                      </td>

                      <td class="center">
                        <input
                          v-model="mat.единица_измерения"
                          @change="dir.updateMaterial(mat)"
                          class="cell-input center"
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          v-model.number="mat.базовая_цена"
                          @change="dir.updateMaterial(mat)"
                          class="cell-input right bold"
                          step="0.01"
                        />
                      </td>

                      <td class="center">
                        <button @click="dir.deleteMaterial(mat.идентификатор)" class="btn-delete" title="Удалить">
                          🗑️
                        </button>
                      </td>
                    </tr>
                  </template>
                </template>
              </template>
            </template>

            <tr v-if="Object.keys(dir.groupedMaterials).length === 0">
              <td colspan="8" class="center empty-message">По вашему запросу ничего не найдено</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { reactive } from 'vue'

defineProps({
  dir: { type: Object, required: true }
})

const matColWidths = reactive({
  id: 60,
  article: 150,
  name: 350,
  unit: 80,
  price: 100,
  link: 150,
  actions: 60
})

let isResizing = false
let currentHeader = null
let startX = 0
let startWidth = 0

function startResize(e, headerKey) {
  isResizing = true
  currentHeader = headerKey
  startX = e.clientX
  startWidth = matColWidths[headerKey]
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e) {
  if (!isResizing) return
  matColWidths[currentHeader] = Math.max(50, startWidth + (e.clientX - startX))
}

function onMouseUp() {
  isResizing = false
  currentHeader = null
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}
</script>

<style scoped>
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.controls-card,
.result-card {
  padding: 20px;
}

.section-title {
  margin: 0 0 16px;
  color: var(--text-main);
}

.no-margin {
  margin: 0;
}

.form-vertical {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.row-basic {
  display: flex;
  gap: 16px;
  align-items: end;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.name-group {
  flex: 3;
}

.short-input {
  flex: 1;
}

.link-group {
  flex: 3;
}

.button-group {
  display: flex;
  align-items: flex-end;
  flex: 1;
}

.w-100 {
  width: 100%;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  gap: 16px;
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.fav-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: var(--accent);
  cursor: pointer;
  user-select: none;
  padding: 7px 12px;
  border-radius: 10px;
  background: var(--accent-soft);
  border: 1px solid var(--accent);
  transition: background var(--transition-fast);
}

.fav-filter:hover {
  background: var(--bg-hover);
}

.search-input {
  width: 350px;
  max-width: 100%;
}

.table-scroll {
  overflow-x: auto;
  max-height: 75vh;
}

.resizable-table {
  table-layout: fixed;
  width: max-content;
  min-width: 100%;
}

.modern-table {
  border-collapse: collapse;
  text-align: left;
}

.modern-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--bg-card-soft);
  color: var(--text-soft);
  padding: 0.8rem;
  font-size: 0.85rem;
  text-align: center;
  border-bottom: 2px solid var(--accent);
  border-right: 1px solid var(--border-color);
  white-space: nowrap;
}

.modern-table td {
  padding: 0;
  border-bottom: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
  font-size: 0.9rem;
  color: var(--text-main);
  background: var(--bg-card);
}

.group-header {
  cursor: pointer;
  transition: background var(--transition-fast);
}

.group-header td {
  font-weight: 700;
  font-size: 1.02rem;
  padding: 0.85rem 1rem !important;
  border: none !important;
  user-select: none;
  border-left: 4px solid var(--accent) !important;
}

.mat-main-header td {
  background: var(--bg-card-soft) !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--accent);
  border-bottom: 1px solid var(--border-color) !important;
}

.mat-main-header:hover td {
  background: var(--bg-hover) !important;
}

.mat-sub-header td {
  background: color-mix(in srgb, var(--bg-card-soft) 75%, var(--bg-card) 25%) !important;
  padding-left: 2.5rem !important;
  color: var(--text-main);
  font-weight: 500;
}

.mat-sub-header:hover td {
  background: var(--bg-hover) !important;
}

.toggle-icon {
  display: inline-block;
  width: 20px;
  font-size: 0.9rem;
  color: var(--text-soft);
}

.group-count {
  font-size: 0.85rem;
  color: var(--text-soft);
  margin-left: 10px;
  font-weight: 400;
}

.cell-input {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 0.65rem;
  border: 1px solid transparent;
  background: transparent;
  font-family: inherit;
  font-size: 0.9rem;
  color: var(--text-main);
  transition: background var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.cell-input:hover {
  background: var(--bg-hover);
}

.cell-input:focus {
  background: var(--bg-hover);
  border: 1px solid var(--accent);
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
}

.article {
  font-family: monospace;
  font-weight: 700;
  color: var(--accent);
}

.btn-fav {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  transition: transform var(--transition-fast), color var(--transition-fast);
  color: var(--text-soft);
}

.btn-fav:hover {
  transform: scale(1.15);
  color: var(--accent);
}

.is-fav td {
  background: var(--accent-soft);
}

.btn-delete {
  background: none;
  border: none;
  font-size: 1.15rem;
  cursor: pointer;
  opacity: 0.75;
  color: var(--text-soft);
  transition: transform var(--transition-fast), opacity var(--transition-fast), color var(--transition-fast);
}

.btn-delete:hover {
  opacity: 1;
  color: var(--danger);
  transform: scale(1.12);
}

.empty-message {
  padding: 2rem !important;
  color: var(--text-soft);
  font-style: italic;
  font-size: 1rem;
  text-align: center;
}

.resizer {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  background: transparent;
  z-index: 10;
}

.resizer:hover,
.resizer:active {
  background: var(--accent);
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

.text-left {
  text-align: left;
}

.text-muted {
  color: var(--text-soft);
}

input[type='number']::-webkit-outer-spin-button,
input[type='number']::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
  text-align: right;
}

@media (max-width: 900px) {
  .row-basic {
    flex-direction: column;
    align-items: stretch;
  }

  .table-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-left {
    justify-content: space-between;
  }

  .search-input {
    width: 100%;
  }

  .button-group,
  .link-group,
  .name-group,
  .short-input {
    flex: none;
  }
}
</style>