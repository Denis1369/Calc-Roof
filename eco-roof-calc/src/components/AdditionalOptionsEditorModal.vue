<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay">
      <div class="modal-card page-card additional-options-modal">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">Глобальный редактор опций</h3>
            <div class="modal-subtitle">Настройте, какие работы и материалы автоматически добавляются в смету при выборе опций (например, "Ограждения").</div>
          </div>
          <button class="close-btn" type="button" @click="$emit('close')">✕</button>
        </div>

        <div class="modal-body layout-grid">
          <aside class="options-sidebar ui-card-soft">
            <div class="sidebar-title">Доп. опции</div>
            <div
              v-for="(block, key) in editableBlocks"
              :key="key"
              class="option-item"
              :class="{ active: selectedKey === key }"
              @click="selectedKey = key"
            >
              <div class="option-name">{{ getFriendlyName(key) }}</div>
              <div class="option-code">ID: {{ key }}</div>
            </div>
          </aside>

          <section v-if="selectedBlock" class="option-editor">
            <h4 class="editor-section-title">
              Работы для опции "{{ getFriendlyName(selectedKey) }}"
            </h4>
            <div class="items-list">
              <div v-for="(work, wIdx) in selectedBlock.works" :key="'w'+wIdx" class="item-row ui-card-soft">
                <div class="input-wrapper name-input">
                  <label>Наименование работы</label>
                  <input v-model="work.name" list="modal-works-list" class="ui-input" placeholder="Название работы" />
                </div>
                <div class="input-wrapper expr-input">
                  <label>Формула</label>
                  <input v-model="work.expression" class="ui-input" placeholder="Напр: GR * 2" />
                </div>
                <div class="input-wrapper unit-input">
                  <label>Ед.изм</label>
                  <input v-model="work.unit" class="ui-input" placeholder="м2" />
                </div>
                <button class="btn-icon danger-text" title="Удалить" @click="selectedBlock.works.splice(wIdx, 1)">✕</button>
              </div>
              <button class="btn-outline" @click="selectedBlock.works.push({ name: '', expression: '', unit: '' })">
                + Добавить работу
              </button>
            </div>

            <h4 class="editor-section-title" style="margin-top: 28px;">
              Материалы для опции "{{ getFriendlyName(selectedKey) }}"
            </h4>
            <div class="items-list">
              <div v-for="(mat, mIdx) in selectedBlock.materials" :key="'m'+mIdx" class="item-row ui-card-soft">
                <div class="input-wrapper name-input">
                  <label>Наименование материала</label>
                  <input v-model="mat.name" list="modal-materials-list" class="ui-input" placeholder="Название материала" />
                </div>
                <div class="input-wrapper expr-input">
                  <label>Формула</label>
                  <input v-model="mat.expression" class="ui-input" placeholder="Напр: S * 1.05" />
                </div>
                <div class="input-wrapper unit-input">
                  <label>Ед.изм</label>
                  <input v-model="mat.unit" class="ui-input" placeholder="шт" />
                </div>
                <button class="btn-icon danger-text" title="Удалить" @click="selectedBlock.materials.splice(mIdx, 1)">✕</button>
              </div>
              <button class="btn-outline" @click="selectedBlock.materials.push({ name: '', expression: '', unit: '' })">
                + Добавить материал
              </button>
            </div>
          </section>
        </div>

        <div class="modal-footer">
          <button class="ui-btn ui-btn-danger" style="margin-right: auto;" @click="resetToDefaults">Сбросить до заводских</button>
          <button class="ui-btn ui-btn-secondary" type="button" @click="$emit('close')">Отмена</button>
          <button class="ui-btn ui-btn-primary" type="button" @click="saveAndClose">Сохранить для всех систем</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { getMergedOptionBlocks, saveCustomOptionBlocks } from '@/modules/templates/optionBlocks'

const props = defineProps({
  isOpen: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'updated'])

const editableBlocks = ref({})
const selectedKey = ref(null)

const FRIENDLY_NAMES = {
  guardrails: 'Ограждения и безопасность',
  smoke_hatches: 'Люки дымоудаления',
  vent_shafts: 'Вентиляционные шахты',
  aerators: 'Аэраторы',
  walkways: 'Пешеходные дорожки',
  fachwerks: 'Стойки фахверка',
  rib_fill: 'Заполнение гофр / L-профиль',
  deformation_joints: 'Деформационные швы',
  fire_protection: 'Противопожарные рассечки',
  small_penetrations: 'Проходки малого сечения',
  medium_penetrations: 'Проходки среднего сечения',
  other_penetrations: 'Прочие проходки',
  pedestals: 'Тумбы и подставки',
  ov_vk: 'Узлы ОВ / ВК',
  exhausts: 'Вытяжки и дефлекторы'
}

function getFriendlyName(key) {
  return FRIENDLY_NAMES[key] || editableBlocks.value[key]?.title || key
}

watch(() => props.isOpen, (val) => {
  if (val) {
    editableBlocks.value = getMergedOptionBlocks()
    if (!selectedKey.value || !editableBlocks.value[selectedKey.value]) {
      selectedKey.value = Object.keys(editableBlocks.value)[0]
    }
  }
})

const selectedBlock = computed(() => editableBlocks.value[selectedKey.value])

function saveAndClose() {
  saveCustomOptionBlocks(editableBlocks.value)
  window.alert('Глобальные настройки опций сохранены! При пересчете смет они применятся автоматически.')
  emit('updated')
  emit('close')
}

function resetToDefaults() {
  if (window.confirm('Внимание! Все ваши привязки будут удалены, и вернутся стандартные "заводские" настройки. Продолжить?')) {
    saveCustomOptionBlocks({})
    editableBlocks.value = getMergedOptionBlocks()
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 2000;
}

.additional-options-modal {
  width: 100%;
  max-width: 1100px;
  padding: 24px;
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.modal-title { margin: 0; font-size: 22px; }
.modal-subtitle { margin-top: 6px; color: var(--text-soft); font-size: 14px; }
.close-btn { border: none; background: transparent; font-size: 24px; color: var(--text-soft); cursor: pointer; }

.layout-grid {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 24px;
  flex: 1;
  overflow: hidden;
  min-height: 400px;
}

.options-sidebar {
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sidebar-title {
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--text-soft);
  text-transform: uppercase;
  font-size: 13px;
}

.option-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.option-item:hover { background: var(--surface-hover); }

.option-item.active {
  background: var(--accent);
  color: white;
}

.option-item.active .option-code { color: rgba(255, 255, 255, 0.7); }

.option-name { font-weight: 600; font-size: 14px; }
.option-code { font-size: 12px; color: var(--text-soft); margin-top: 4px; }

.option-editor {
  overflow-y: auto;
  padding-right: 10px;
}

.editor-section-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: var(--text-main);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 8px;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.item-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  padding: 16px;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-wrapper label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-soft);
}

.name-input { flex: 2; }
.expr-input { flex: 1; }
.unit-input { width: 90px; }

.modal-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}
</style>
