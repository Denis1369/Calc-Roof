<template>
  <article class="zone-block page-card">
    <div class="zone-header">
      <input v-model="zone.name" class="zone-title-input" placeholder="Название участка" />

      <div class="zone-header-actions hide-on-print">
        <button
          v-if="zone.templateMeta?.systemCode"
          @click="$emit('editPie', zone, zoneIndex)"
          class="ui-btn ui-btn-secondary zone-edit-btn"
          type="button"
        >
          Назад к выбору работ
        </button>

        <button
          v-if="zone.templateMeta?.systemCode"
          @click="$emit('editSystem', zone.templateMeta?.systemCode)"
          class="ui-btn ui-btn-secondary zone-edit-btn"
          type="button"
        >
          Редактор системы
        </button>

        <button
          @click="$emit('removeZone', zoneIndex)"
          class="btn-icon danger-text"
          title="Удалить участок"
          type="button"
        >
          ✕
        </button>
      </div>
    </div>

    <div class="zone-params-block hide-on-print">
      <div class="zone-params-title">Параметры участка для инженерного расчета</div>

      <div class="params-grid">
        <div class="calc-group">
          <label class="ui-label">Площадь (S, м²)</label>
          <input
            type="number"
            v-model.number="zone.roofParams.area"
            @input="$emit('recalculate')"
            min="0"
            step="0.1"
            class="ui-input"
          />
        </div>

        <div class="calc-group">
          <label class="ui-label">Периметр (P, пог.м)</label>
          <input
            type="number"
            v-model.number="zone.roofParams.perimeter"
            @input="$emit('recalculate')"
            min="0"
            step="0.1"
            class="ui-input"
          />
        </div>

        <div class="calc-group">
          <label class="ui-label">Водоотвод (OD, шт)</label>
          <input
            type="number"
            v-model.number="zone.roofParams.parapetDrains"
            @input="$emit('recalculate')"
            min="0"
            class="ui-input"
          />
        </div>

        <div class="calc-group">
          <label class="ui-label">Воронки (ID, шт)</label>
          <input
            type="number"
            v-model.number="zone.roofParams.innerDrains"
            @input="$emit('recalculate')"
            min="0"
            class="ui-input"
          />
        </div>

        <div class="calc-group">
          <label class="ui-label">Аэраторы (A, шт)</label>
          <input
            type="number"
            v-model.number="zone.roofParams.aerators"
            @input="$emit('recalculate')"
            min="0"
            class="ui-input"
          />
        </div>

        <div class="calc-group" v-for="(cp, pIdx) in zone.customParams" :key="'cp' + pIdx">
          <label class="ui-label custom-param-label">
            <span :title="cp.name">{{ cp.name }} ({{ cp.symbol }})</span>
            <span @click="removeCustomParam(pIdx)" class="remove-param" title="Удалить переменную">
              ✕
            </span>
          </label>
          <input
            type="number"
            v-model.number="cp.value"
            @input="$emit('recalculate')"
            min="0"
            step="0.1"
            class="ui-input custom-param-input"
          />
        </div>
      </div>

      <div class="add-param-row">
        <button @click="$emit('addCustomParam', zone)" class="btn-link-small">
          + Добавить свою переменную для формул
        </button>
      </div>
    </div>

    <div v-for="(section, sIdx) in zone.sections" :key="section.id" class="section-block">
      <div class="section-header">
        <input v-model="section.title" class="section-title-input" placeholder="Название раздела" />
        <button @click="$emit('removeSection', zone, sIdx)" class="delete-section-btn hide-on-print" type="button">
          Удалить раздел
        </button>
      </div>

      <EstimateTable
        title="Работы:"
        type="work"
        :items="section.works"
        :highlighted-row-id="highlightedRowId"
        listId="works-list"
        @changeName="$emit('changeWorkName', $event, section, zone)"
        @changeFormula="$emit('changeFormula', $event)"
        @recalculate="$emit('recalculate')"
        @remove="$emit('removeWork', section, $event)"
        @add="$emit('addWork', section, zone)"
      />

      <EstimateTable
        title="Материалы:"
        type="material"
        :items="section.materials"
        :highlighted-row-id="highlightedRowId"
        listId="materials-list"
        @changeName="$emit('changeMaterialName', $event, section)"
        @changeFormula="$emit('changeFormula', $event)"
        @recalculate="$emit('recalculate')"
        @remove="$emit('removeMaterial', section, $event)"
        @add="$emit('addMaterial', section, zone)"
      />

      <div class="section-total-row">
        <span class="section-total-label">ИТОГО по разделу:</span>
        <span class="section-total-value">
          {{ sectionTotal(section) }}
        </span>
      </div>
    </div>

    <div class="add-section-row hide-on-print">
      <button @click="$emit('addSection', zone)" class="btn-outline">
        + Добавить раздел в этот участок
      </button>
    </div>
  </article>
</template>

<script setup>
import EstimateTable from '@/components/EstimateTable.vue'

const props = defineProps({
  zone: { type: Object, required: true },
  zoneIndex: { type: Number, required: true },
  getSectionTotal: { type: Function, required: true },
  highlightedRowId: { type: String, default: '' }
})

const emit = defineEmits([
  'editPie',
  'editSystem',
  'removeZone',
  'recalculate',
  'changeWorkName',
  'changeMaterialName',
  'changeFormula',
  'removeWork',
  'removeMaterial',
  'addWork',
  'addMaterial',
  'removeSection',
  'addSection',
  'addCustomParam'
])

function removeCustomParam(index) {
  props.zone.customParams.splice(index, 1)
  emit('recalculate')
}

function sectionTotal(section) {
  return props.getSectionTotal(section).toLocaleString('ru-RU', {
    minimumFractionDigits: 2
  }) + ' ₽'
}
</script>

<style scoped>
.zone-block {
  overflow: hidden;
}

.zone-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-card-soft);
  padding: 14px 20px;
  gap: 15px;
  border-bottom: 1px solid var(--border-color);
}

.zone-title-input {
  flex: 1;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: #111827;
  font-size: 1.1rem;
  font-weight: 700;
  height: 42px;
  padding: 0 15px;
  border-radius: 8px;
  outline: none;
}

.zone-title-input:focus {
  border-color: var(--accent);
}

.zone-params-block {
  background: var(--bg-card-soft);
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.zone-params-title {
  font-weight: 700;
  margin-bottom: 14px;
  color: var(--text-soft);
  font-size: 0.9rem;
  text-transform: uppercase;
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 18px;
  align-items: flex-start;
}

.calc-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.section-block {
  padding: 20px;
}

.section-header {
  margin-bottom: 18px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 10px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.section-title-input {
  font-size: 1.15rem;
  font-weight: 800;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0;
  background: transparent;
  width: 70%;
  color: var(--text-main);
  outline: none;
}

.section-title-input:focus {
  border-bottom-color: var(--accent);
}

.section-total-row {
  text-align: right;
  padding: 16px 0 0;
  font-size: 1.1rem;
  font-weight: 800;
  border-top: 1px solid var(--border-color);
  margin-top: 16px;
  color: var(--text-main);
}

.add-section-row {
  padding: 0 20px 20px;
}

.btn-outline {
  background: transparent;
  border: 2px dashed var(--accent);
  color: var(--accent);
  width: 100%;
  margin-top: 4px;
  padding: 12px 16px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
  font-size: 1rem;
}

.btn-outline:hover {
  background: var(--accent-soft);
}

.btn-icon {
  opacity: 0.75;
  transition: transform var(--transition-fast), opacity var(--transition-fast), color var(--transition-fast);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0;
  color: var(--text-soft);
}

.btn-icon:hover {
  opacity: 1;
  transform: scale(1.15);
  color: var(--danger);
}

.delete-section-btn {
  border: 1px solid color-mix(in srgb, var(--danger) 35%, var(--border-color));
  background: color-mix(in srgb, var(--danger) 8%, transparent);
  color: var(--danger);
  border-radius: 10px;
  padding: 8px 12px;
  font-weight: 700;
  cursor: pointer;
}

.delete-section-btn:hover {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
}

.danger-text {
  color: var(--danger);
}

.add-param-row {
  margin-top: 14px;
  text-align: right;
}

.btn-link-small {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
  transition: color var(--transition-fast);
}

.btn-link-small:hover {
  color: var(--accent-hover);
}

.custom-param-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.remove-param {
  color: var(--danger);
  cursor: pointer;
  font-size: 0.9rem;
  margin-left: 5px;
}

.remove-param:hover {
  font-weight: 700;
}

.zone-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.zone-edit-btn {
  white-space: nowrap;
}

@media (max-width: 900px) {
  .zone-header,
  .section-header {
    flex-direction: column;
    align-items: stretch;
  }

  .section-title-input {
    width: 100%;
  }
}
</style>
