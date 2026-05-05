<template>
  <div class="tab-content">
    <section class="controls-card page-card">
      <h3 class="section-title">Добавить новый материал</h3>

      <form @submit.prevent="dir.addMaterial" class="form-vertical">
        <div class="row-basic">
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
            <label class="ui-label">Базовое наименование *</label>
            <input
              v-model="dir.newMaterial.базовое_наименование"
              type="text"
              placeholder="Например: ПВХ-мембрана"
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

        <div class="variant-card ui-card-soft">
          <div class="variant-card-header">
            <h4 class="variant-title">Первый вариант материала</h4>
            <span class="variant-hint">Необязательно, но рекомендуется заполнить сразу</span>
          </div>

          <div class="row-basic">
            <div class="input-group">
              <label class="ui-label">Название варианта</label>
              <input
                v-model="dir.newMaterial.вариант"
                type="text"
                placeholder="Например: 1.2 мм / серый"
                class="ui-input"
              />
            </div>

            <div class="input-group">
              <label class="ui-label">Артикул</label>
              <input
                v-model="dir.newMaterial.артикул_товара"
                type="text"
                placeholder="SKU / артикул"
                class="ui-input"
              />
            </div>

            <div class="input-group short-input">
              <label class="ui-label">Толщина, мм</label>
              <input
                v-model.number="dir.newMaterial.толщина_мм"
                type="number"
                step="0.01"
                class="ui-input"
              />
            </div>

            <div class="input-group short-input">
              <label class="ui-label">Ширина, мм</label>
              <input
                v-model.number="dir.newMaterial.ширина_мм"
                type="number"
                step="0.01"
                class="ui-input"
              />
            </div>
          </div>

          <div class="row-basic">
            <div class="input-group short-input">
              <label class="ui-label">Высота, мм</label>
              <input
                v-model.number="dir.newMaterial.высота_мм"
                type="number"
                step="0.01"
                class="ui-input"
              />
            </div>

            <div class="input-group short-input">
              <label class="ui-label">Плотность</label>
              <input
                v-model.number="dir.newMaterial.плотность"
                type="number"
                step="0.01"
                class="ui-input"
              />
            </div>

            <div class="input-group">
              <label class="ui-label">Профиль</label>
              <input
                v-model="dir.newMaterial.профиль"
                type="text"
                placeholder="Например: профлист / гладкий"
                class="ui-input"
              />
            </div>

            <div class="button-group">
              <button type="submit" class="ui-btn ui-btn-success w-100">+ Добавить материал</button>
            </div>
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

          <div class="catalog-actions">
            <button class="ui-btn ui-btn-primary" type="button" @click="exportMaterials">
              Выгрузить XLSX
            </button>
            <button class="ui-btn ui-btn-secondary" type="button" @click="openImportDialog">
              Загрузить цены XLSX
            </button>
            <input
              ref="materialImportInput"
              type="file"
              accept=".xlsx"
              class="hidden-file-input"
              @change="handleImportFile"
            />
          </div>
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

              <th :style="{ width: matColWidths.subcategory + 'px', minWidth: matColWidths.subcategory + 'px' }">
                Подкатегория
                <div class="resizer" @mousedown.stop="startResize($event, 'subcategory')"></div>
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
                Баз. цена
                <div class="resizer" @mousedown.stop="startResize($event, 'price')"></div>
              </th>

              <th :style="{ width: matColWidths.variants + 'px', minWidth: matColWidths.variants + 'px' }">
                Варианты
                <div class="resizer" @mousedown.stop="startResize($event, 'variants')"></div>
              </th>

              <th class="actions-head" :style="{ width: matColWidths.actions + 'px', minWidth: matColWidths.actions + 'px' }">
                Действия
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="mat in filteredMaterials"
              :key="mat.идентификатор"
              :class="{ 'is-fav': mat.избранное }"
            >
              <td class="center">
                <button @click="dir.toggleFavMaterial(mat)" class="btn-fav" type="button">
                  {{ mat.избранное ? '⭐' : '☆' }}
                </button>
              </td>

              <td>
                <input
                  v-model="mat.подкатегория"
                  class="cell-input"
                />
              </td>

              <td>
                <input
                  v-model="mat.полное_наименование_материала"
                  class="cell-input text-left"
                />
              </td>

              <td class="center">
                <input
                  v-model="mat.единица_измерения"
                  class="cell-input center"
                />
              </td>

              <td>
                <input
                  type="number"
                  v-model.number="mat.базовая_цена"
                  class="cell-input right bold"
                  step="0.01"
                />
              </td>

              <td class="center">
                <button
                  @click="openVariantsModal(mat)"
                  class="ui-btn ui-btn-soft btn-variants"
                  type="button"
                >
                  Открыть ({{ mat.количество_вариантов || 0 }})
                </button>
              </td>

              <td class="center row-actions">
                <button
                  @click="dir.updateMaterial(mat)"
                  class="btn-save"
                  title="Сохранить строку"
                  type="button"
                >
                  Сохр.
                </button>
                <button
                  @click="dir.deleteMaterial(mat.идентификатор)"
                  class="btn-delete"
                  title="Удалить"
                  type="button"
                >
                  Удалить
                </button>
              </td>
            </tr>

            <tr v-if="filteredMaterials.length === 0">
              <td colspan="7" class="center empty-message">По вашему запросу ничего не найдено</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div
      v-if="selectedMaterial"
      class="modal-overlay"
      @click.self="closeVariantsModal"
    >
      <div class="modal-window">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">Варианты материала</h3>
            <p class="modal-subtitle">
              {{ selectedMaterial.полное_наименование_материала }}
            </p>
          </div>

          <button class="modal-close" type="button" @click="closeVariantsModal">✕</button>
        </div>

        <div class="modal-meta">
          <span class="meta-chip">
            Подкатегория: {{ selectedMaterial.подкатегория || '—' }}
          </span>
          <span class="meta-chip">
            Всего вариантов: {{ selectedMaterial.варианты?.length || 0 }}
          </span>
        </div>

        <div class="modal-table-scroll">
          <table class="modern-table modal-table">
            <thead>
              <tr>
                <th>Вариант</th>
                <th>Артикул</th>
                <th>Толщина, мм</th>
                <th>Ширина, мм</th>
                <th>Высота, мм</th>
                <th>Плотность</th>
                <th>Профиль</th>
                <th>Цена</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="variant in selectedMaterial.варианты" :key="variant.id">
                <td>
                  <input
                    v-model="variant.variant_label"
                    class="cell-input"
                  />
                </td>

                <td>
                  <input
                    v-model="variant.sku"
                    class="cell-input article"
                  />
                </td>

                <td>
                  <input
                    v-model.number="variant.thickness_mm"
                    type="number"
                    step="0.01"
                    class="cell-input right"
                  />
                </td>

                <td>
                  <input
                    v-model.number="variant.width_mm"
                    type="number"
                    step="0.01"
                    class="cell-input right"
                  />
                </td>

                <td>
                  <input
                    v-model.number="variant.height_mm"
                    type="number"
                    step="0.01"
                    class="cell-input right"
                  />
                </td>

                <td>
                  <input
                    v-model.number="variant.density"
                    type="number"
                    step="0.01"
                    class="cell-input right"
                  />
                </td>

                <td>
                  <input
                    v-model="variant.profile_name"
                    class="cell-input"
                  />
                </td>

                <td>
                  <input
                    v-model.number="variant.price"
                    type="number"
                    step="0.01"
                    class="cell-input right bold"
                  />
                </td>

                <td class="center row-actions">
                  <button
                    @click="dir.updateVariant(selectedMaterial, variant)"
                    class="btn-save"
                    title="Сохранить вариант"
                    type="button"
                  >
                    Сохр.
                  </button>
                  <button
                    @click="dir.deleteVariant(selectedMaterial, variant.id)"
                    class="btn-delete"
                    type="button"
                  >
                    Удалить
                  </button>
                </td>
              </tr>

              <tr class="new-variant-row">
                <td>
                  <input
                    v-model="variantDraft.variant_label"
                    class="cell-input"
                    placeholder="Новый вариант"
                  />
                </td>

                <td>
                  <input
                    v-model="variantDraft.sku"
                    class="cell-input article"
                    placeholder="Артикул"
                  />
                </td>

                <td>
                  <input
                    v-model.number="variantDraft.thickness_mm"
                    type="number"
                    step="0.01"
                    class="cell-input right"
                  />
                </td>

                <td>
                  <input
                    v-model.number="variantDraft.width_mm"
                    type="number"
                    step="0.01"
                    class="cell-input right"
                  />
                </td>

                <td>
                  <input
                    v-model.number="variantDraft.height_mm"
                    type="number"
                    step="0.01"
                    class="cell-input right"
                  />
                </td>

                <td>
                  <input
                    v-model.number="variantDraft.density"
                    type="number"
                    step="0.01"
                    class="cell-input right"
                  />
                </td>

                <td>
                  <input
                    v-model="variantDraft.profile_name"
                    class="cell-input"
                  />
                </td>

                <td>
                  <input
                    v-model.number="variantDraft.price"
                    type="number"
                    step="0.01"
                    class="cell-input right bold"
                  />
                </td>

                <td class="center">
                  <button
                    @click="dir.addVariant(selectedMaterial)"
                    class="ui-btn ui-btn-success btn-add-variant"
                    type="button"
                  >
                    +
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="modal-footer">
          <button class="ui-btn ui-btn-secondary" type="button" @click="closeVariantsModal">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps({
  dir: { type: Object, required: true }
})

const dir = props.dir

const selectedMaterial = ref(null)
const materialImportInput = ref(null)

const variantDraft = computed(() => {
  if (!selectedMaterial.value) return null
  return dir.ensureVariantDraft(selectedMaterial.value.идентификатор)
})

const filteredMaterials = computed(() => {
  const search = `${dir.searchMaterial || ''}`.toLowerCase().trim()

  return [...(dir.materialsDb || [])]
    .filter((item) => {
      if (dir.onlyFavMaterials && !item.избранное) {
        return false
      }

      if (!search) {
        return true
      }

      return [
        item.главная_категория,
        item.подкатегория,
        item.полное_наименование_материала,
        item.базовое_наименование
      ]
        .join(' ')
        .toLowerCase()
        .includes(search)
    })
    .sort((a, b) => {
      const aKey = [
        a.подкатегория || '',
        a.полное_наименование_материала || ''
      ].join('|')

      const bKey = [
        b.подкатегория || '',
        b.полное_наименование_материала || ''
      ].join('|')

      return aKey.localeCompare(bKey, 'ru')
    })
})

watch(
  () => dir.materialsDb,
  (rows) => {
    if (!selectedMaterial.value) return

    const updated = (rows || []).find(
      (item) => Number(item.идентификатор) === Number(selectedMaterial.value.идентификатор)
    )

    if (updated) {
      selectedMaterial.value = updated
    } else {
      selectedMaterial.value = null
    }
  },
  { deep: true }
)

function openVariantsModal(material) {
  selectedMaterial.value = material
  dir.ensureVariantDraft(material.идентификатор)
}

function closeVariantsModal() {
  selectedMaterial.value = null
}

async function exportMaterials() {
  try {
    const savedPath = await dir.exportMaterialsXlsx()
    if (savedPath) {
      window.alert(`Материалы выгружены: ${savedPath}`)
    }
  } catch {
    window.alert('Не удалось выгрузить материалы в XLSX.')
  }
}

function openImportDialog() {
  materialImportInput.value?.click()
}

async function handleImportFile(event) {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const count = await dir.importMaterialsXlsx(file)
    window.alert(`Загружено/обновлено материалов: ${count}`)
  } catch {
    window.alert('Не удалось загрузить материалы из XLSX.')
  } finally {
    event.target.value = ''
  }
}

const matColWidths = reactive({
  subcategory: 240,
  name: 620,
  unit: 90,
  price: 130,
  variants: 160,
  actions: 150
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
  matColWidths[currentHeader] = Math.max(60, startWidth + (e.clientX - startX))
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

.short-input {
  flex: 1;
}

.button-group {
  display: flex;
  align-items: flex-end;
  flex: 1;
}

.w-100 {
  width: 100%;
}

.variant-card {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.variant-card-header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 12px;
  flex-wrap: wrap;
}

.variant-title {
  margin: 0;
  font-size: 16px;
  color: var(--text-main);
}

.variant-hint {
  color: var(--text-soft);
  font-size: 13px;
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

.catalog-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.hidden-file-input {
  display: none;
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
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--bg-card);
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
  min-height: 42px;
  vertical-align: middle;
}

.cell-input {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  min-height: 42px;
  padding: 0.7rem 0.75rem;
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

.row-actions {
  padding: 6px !important;
  white-space: nowrap;
}

.actions-head {
  white-space: nowrap;
}

.btn-save,
.btn-delete {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
}

.row-actions .btn-save {
  margin-right: 6px;
}

.btn-delete {
  background: color-mix(in srgb, var(--danger) 8%, var(--bg-card));
  color: var(--danger);
  transition: transform var(--transition-fast), opacity var(--transition-fast), color var(--transition-fast);
}

.btn-save {
  background: color-mix(in srgb, var(--success) 10%, var(--bg-card));
  color: var(--success);
  transition: transform var(--transition-fast), opacity var(--transition-fast);
}

.btn-save:hover {
  border-color: var(--success);
  transform: scale(1.12);
}

.btn-delete:hover {
  border-color: var(--danger);
  color: var(--danger);
  transform: scale(1.12);
}

.btn-variants {
  white-space: nowrap;
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

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 2000;
}

.modal-window {
  width: min(1400px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 18px;
  box-shadow: 0 20px 50px var(--shadow-color);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 16px;
  padding: 20px 22px 14px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-card-soft);
}

.modal-title {
  margin: 0;
  font-size: 22px;
  color: var(--text-main);
}

.modal-subtitle {
  margin: 6px 0 0;
  color: var(--text-soft);
  font-size: 14px;
}

.modal-close {
  border: none;
  background: transparent;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  color: var(--text-soft);
  transition: color var(--transition-fast), transform var(--transition-fast);
}

.modal-close:hover {
  color: var(--danger);
  transform: scale(1.08);
}

.modal-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding: 14px 22px 0;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  padding: 7px 10px;
  border-radius: 999px;
  background: var(--bg-card-soft);
  border: 1px solid var(--border-color);
  color: var(--text-soft);
  font-size: 13px;
  font-weight: 600;
}

.modal-table-scroll {
  overflow: auto;
  padding: 16px 22px;
}

.modal-table {
  width: max-content;
  min-width: 100%;
  table-layout: fixed;
}

.modal-table th {
  position: sticky;
  top: 0;
  z-index: 1;
}

.new-variant-row td {
  background: color-mix(in srgb, var(--bg-card-soft) 65%, var(--bg-card) 35%);
}

.btn-add-variant {
  min-width: 42px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 22px 20px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-card-soft);
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

@media (max-width: 1200px) {
  .row-basic {
    flex-direction: column;
    align-items: stretch;
  }

  .variant-card-header,
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
  .short-input {
    flex: none;
  }

  .modal-overlay {
    padding: 12px;
  }

  .modal-window {
    max-height: 95vh;
  }
}
</style>
