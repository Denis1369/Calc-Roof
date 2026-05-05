<template>
  <div class="tab-content">
    <section class="controls-card page-card">
      <h3 class="section-title">Добавить новую расценку на работы</h3>

      <form @submit.prevent="dir.addWork" class="form-vertical">
        <div class="row-basic">
          <div class="input-group">
            <label class="ui-label">Категория раздела *</label>
            <input
              v-model="dir.newWork.категория_работы"
              type="text"
              list="category-list"
              placeholder="Демонтаж, Основание..."
              required
              class="ui-input"
            />
            <datalist id="category-list">
              <option v-for="cat in dir.uniqueCategories" :key="cat" :value="cat"></option>
            </datalist>
          </div>

          <div class="input-group name-group">
            <label class="ui-label">Наименование работы *</label>
            <input
              v-model="dir.newWork.наименование_работы"
              type="text"
              placeholder="Например: Монтаж мембраны..."
              required
              class="ui-input"
            />
          </div>

          <div class="input-group short-input">
            <label class="ui-label">Ед. изм. *</label>
            <select v-model="dir.newWork.единица_измерения_работы" required class="ui-select">
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

        <div class="prices-grid ui-card-soft">
          <div class="price-input">
            <label class="price-label">0 - 300</label>
            <input v-model.number="dir.newWork.цена_0_300" type="number" step="0.01" class="ui-input price-field" />
          </div>
          <div class="price-input">
            <label class="price-label">300 - 600</label>
            <input v-model.number="dir.newWork.цена_300_600" type="number" step="0.01" class="ui-input price-field" />
          </div>
          <div class="price-input">
            <label class="price-label">600 - 1000</label>
            <input v-model.number="dir.newWork.цена_600_1000" type="number" step="0.01" class="ui-input price-field" />
          </div>
          <div class="price-input">
            <label class="price-label">1000 - 3000</label>
            <input v-model.number="dir.newWork.цена_1000_3000" type="number" step="0.01" class="ui-input price-field" />
          </div>
          <div class="price-input">
            <label class="price-label">3000 - 6000</label>
            <input v-model.number="dir.newWork.цена_3000_6000" type="number" step="0.01" class="ui-input price-field" />
          </div>
          <div class="price-input">
            <label class="price-label">6000 - 15000</label>
            <input v-model.number="dir.newWork.цена_6000_15000" type="number" step="0.01" class="ui-input price-field" />
          </div>
          <div class="price-input">
            <label class="price-label">15000 - 30000</label>
            <input v-model.number="dir.newWork.цена_15000_30000" type="number" step="0.01" class="ui-input price-field" />
          </div>
          <div class="price-input">
            <label class="price-label">> 30000</label>
            <input v-model.number="dir.newWork.цена_более_30000" type="number" step="0.01" class="ui-input price-field" />
          </div>
        </div>

        <div class="button-row mt-3">
          <button type="submit" class="ui-btn ui-btn-primary">+ Добавить работу</button>
        </div>
      </form>
    </section>

    <section class="result-card page-card">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <h3 class="section-title no-margin">Список работ</h3>

          <label class="fav-filter" title="Показать только отмеченные работы">
            <input type="checkbox" v-model="dir.onlyFavWorks" />
            <span>⭐ Только избранное</span>
          </label>
        </div>

        <input
          v-model="dir.searchWork"
          placeholder="🔍 Поиск по наименованию или категории..."
          class="ui-input search-input"
        />
      </div>

      <div class="table-scroll">
        <table class="modern-table wide-table resizable-table">
          <thead>
            <tr>
              <th style="width: 40px; min-width: 40px;">⭐</th>
              <th :style="{ width: workColWidths.name + 'px', minWidth: workColWidths.name + 'px' }">
                Наименование
                <div class="resizer" @mousedown.stop="startResize($event, 'name')"></div>
              </th>
              <th :style="{ width: workColWidths.unit + 'px', minWidth: workColWidths.unit + 'px' }">
                Ед.
                <div class="resizer" @mousedown.stop="startResize($event, 'unit')"></div>
              </th>
              <th :style="{ width: workColWidths.p1 + 'px', minWidth: workColWidths.p1 + 'px' }">
                0-300
                <div class="resizer" @mousedown.stop="startResize($event, 'p1')"></div>
              </th>
              <th :style="{ width: workColWidths.p2 + 'px', minWidth: workColWidths.p2 + 'px' }">
                300-600
                <div class="resizer" @mousedown.stop="startResize($event, 'p2')"></div>
              </th>
              <th :style="{ width: workColWidths.p3 + 'px', minWidth: workColWidths.p3 + 'px' }">
                600-1k
                <div class="resizer" @mousedown.stop="startResize($event, 'p3')"></div>
              </th>
              <th :style="{ width: workColWidths.p4 + 'px', minWidth: workColWidths.p4 + 'px' }">
                1k-3k
                <div class="resizer" @mousedown.stop="startResize($event, 'p4')"></div>
              </th>
              <th :style="{ width: workColWidths.p5 + 'px', minWidth: workColWidths.p5 + 'px' }">
                3k-6k
                <div class="resizer" @mousedown.stop="startResize($event, 'p5')"></div>
              </th>
              <th :style="{ width: workColWidths.p6 + 'px', minWidth: workColWidths.p6 + 'px' }">
                6k-15k
                <div class="resizer" @mousedown.stop="startResize($event, 'p6')"></div>
              </th>
              <th :style="{ width: workColWidths.p7 + 'px', minWidth: workColWidths.p7 + 'px' }">
                15k-30k
                <div class="resizer" @mousedown.stop="startResize($event, 'p7')"></div>
              </th>
              <th :style="{ width: workColWidths.p8 + 'px', minWidth: workColWidths.p8 + 'px' }">
                >30k
                <div class="resizer" @mousedown.stop="startResize($event, 'p8')"></div>
              </th>
              <th :style="{ width: workColWidths.actions + 'px', minWidth: workColWidths.actions + 'px' }"></th>
            </tr>
          </thead>

          <tbody>
            <template v-for="(group, category) in dir.groupedWorks" :key="category">
              <tr class="group-header" @click="dir.toggleGroup(category)">
                <td colspan="12">
                  <span class="toggle-icon">{{ dir.collapsedGroups[category] ? '▶' : '▼' }}</span>
                  {{ category }}
                  <span class="group-count">({{ group.length }} позиций)</span>
                </td>
              </tr>

              <tr
                v-for="work in group"
                :key="work.идентификатор"
                v-show="!dir.collapsedGroups[category]"
                :class="{ 'is-fav': work.избранное }"
              >
                <td class="center">
                  <button @click="dir.toggleFavWork(work)" class="btn-fav">
                    {{ work.избранное ? '⭐' : '☆' }}
                  </button>
                </td>

                <td>
                  <input
                    v-model="work.наименование_работы"
                    class="cell-input text-left work-name"
                  />
                </td>

                <td class="center">
                  <input
                    v-model="work.единица_измерения_работы"
                    class="cell-input center"
                  />
                </td>

                <td>
                  <input
                    type="number"
                    v-model.number="work.цена_0_300"
                    class="cell-input right"
                    step="0.01"
                  />
                </td>

                <td>
                  <input
                    type="number"
                    v-model.number="work.цена_300_600"
                    class="cell-input right"
                    step="0.01"
                  />
                </td>

                <td>
                  <input
                    type="number"
                    v-model.number="work.цена_600_1000"
                    class="cell-input right"
                    step="0.01"
                  />
                </td>

                <td>
                  <input
                    type="number"
                    v-model.number="work.цена_1000_3000"
                    class="cell-input right"
                    step="0.01"
                  />
                </td>

                <td>
                  <input
                    type="number"
                    v-model.number="work.цена_3000_6000"
                    class="cell-input right"
                    step="0.01"
                  />
                </td>

                <td>
                  <input
                    type="number"
                    v-model.number="work.цена_6000_15000"
                    class="cell-input right"
                    step="0.01"
                  />
                </td>

                <td>
                  <input
                    type="number"
                    v-model.number="work.цена_15000_30000"
                    class="cell-input right"
                    step="0.01"
                  />
                </td>

                <td>
                  <input
                    type="number"
                    v-model.number="work.цена_более_30000"
                    class="cell-input right"
                    step="0.01"
                  />
                </td>

                <td class="center">
                  <button @click="dir.updateWork(work)" class="btn-save" title="Сохранить строку">💾</button>
                  <button @click="dir.deleteWork(work.идентификатор)" class="btn-delete" title="Удалить">🗑️</button>
                </td>
              </tr>
            </template>

            <tr v-if="Object.keys(dir.groupedWorks).length === 0">
              <td colspan="12" class="center empty-message">По вашему запросу ничего не найдено</td>
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

const workColWidths = reactive({
  name: 300,
  unit: 70,
  p1: 90,
  p2: 90,
  p3: 90,
  p4: 90,
  p5: 90,
  p6: 90,
  p7: 90,
  p8: 90,
  actions: 90
})

let isResizing = false
let currentHeader = null
let startX = 0
let startWidth = 0

function startResize(e, headerKey) {
  isResizing = true
  currentHeader = headerKey
  startX = e.clientX
  startWidth = workColWidths[headerKey]
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e) {
  if (!isResizing) return
  workColWidths[currentHeader] = Math.max(50, startWidth + (e.clientX - startX))
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

.section-label {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-soft);
  display: block;
}

.prices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
  padding: 16px;
}

.price-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.price-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-soft);
  text-align: center;
  white-space: nowrap;
}

.price-field {
  text-align: center;
}

.button-row {
  display: flex;
  justify-content: flex-end;
}

.mt-3 {
  margin-top: 1.5rem;
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
  overflow: auto;
  max-height: 75vh;
  padding-bottom: 12px;
  scrollbar-gutter: stable both-edges;
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
  background: var(--bg-card-soft);
  color: var(--accent);
  font-weight: 700;
  font-size: 1.02rem;
  padding: 0.85rem 1rem !important;
  border: none !important;
  user-select: none;
  border-left: 4px solid var(--accent) !important;
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

.work-name {
  font-weight: 600;
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

.btn-save {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  opacity: 0.8;
  color: var(--success);
  transition: transform var(--transition-fast), opacity var(--transition-fast);
}

.btn-save:hover {
  opacity: 1;
  transform: scale(1.12);
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

.text-left {
  text-align: left;
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
}
</style>
