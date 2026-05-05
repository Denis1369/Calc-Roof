<template>
  <div class="estimate-header">
    <header class="page-header hide-on-print">
      <div class="page-step">Шаг 2</div>
      <h1 class="ui-title">Инженерная смета плоской кровли</h1>
      <p class="page-subtitle">
        Расчет ведется по участкам, формулам и вашей базе расценок на работы без привязки к типу поставщика.
      </p>
    </header>

    <section class="controls-panel page-card hide-on-print">
      <div class="db-controls-row">
        <div class="calc-group project-group">
          <label class="ui-label">Название проекта</label>
          <input
            :value="projectName"
            type="text"
            placeholder="Например: ТЦ Галактика, кровля"
            class="ui-input"
            @input="$emit('update:projectName', $event.target.value)"
          />
        </div>

        <div class="calc-group contractor-group">
          <label class="ui-label">От какой организации</label>
          <select
            :value="contractorProfile"
            class="ui-select"
            @change="$emit('update:contractorProfile', $event.target.value)"
          >
            <option
              v-for="profile in contractorProfiles"
              :key="profile.id"
              :value="profile.id"
            >
              {{ profile.label }}
            </option>
          </select>
        </div>

        <div class="calc-group vat-group">
          <label class="ui-label">НДС (%)</label>
          <input
            :value="vatRate"
            type="number"
            min="0"
            max="100"
            class="ui-input"
            @input="$emit('update:vatRate', Number($event.target.value))"
          />
        </div>

        <div class="action-buttons">
          <button @click="$emit('save')" class="ui-btn ui-btn-success">Сохранить</button>
          <button @click="$emit('load')" class="ui-btn ui-btn-primary">Загрузить из базы</button>
          <button @click="$emit('exportProject')" class="ui-btn ui-btn-secondary">Сохранить файлом</button>
          <button @click="$emit('importProject')" class="ui-btn ui-btn-secondary">Открыть файл</button>
          <button @click="$emit('report')" class="ui-btn ui-btn-primary">Создать отчет</button>
          <button @click="$emit('xlsx')" class="ui-btn ui-btn-primary">XLSX</button>
          <button @click="$emit('print')" class="ui-btn ui-btn-secondary">Печать</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { CONTRACTOR_PROFILES, DEFAULT_CONTRACTOR_PROFILE_ID } from '@/core/report/contractorProfiles'

defineProps({
  projectName: { type: String, default: '' },
  contractorProfile: { type: String, default: DEFAULT_CONTRACTOR_PROFILE_ID },
  vatRate: { type: Number, default: 22 }
})

defineEmits([
  'update:projectName',
  'update:contractorProfile',
  'update:vatRate',
  'save',
  'load',
  'exportProject',
  'importProject',
  'report',
  'xlsx',
  'print'
])

const contractorProfiles = CONTRACTOR_PROFILES
</script>

<style scoped>
.estimate-header {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.page-step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.page-subtitle {
  text-align: center;
  color: var(--text-soft);
  margin: 0;
  max-width: 780px;
  font-size: 15px;
}

.controls-panel {
  padding: 20px;
}

.db-controls-row {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 14px;
}

.project-group {
  flex: 1 1 340px;
  min-width: 300px;
}

.contractor-group {
  flex: 0 1 280px;
  min-width: 240px;
}

.vat-group {
  flex: 0 0 112px;
  min-width: 112px;
}

.calc-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  flex: 1 1 100%;
  min-width: 100%;
}

.action-buttons > * {
  min-width: max-content;
}

@media (max-width: 900px) {
  .db-controls-row {
    flex-direction: column;
    align-items: stretch;
  }

  .project-group,
  .vat-group {
    flex: none;
    max-width: none;
  }

  .action-buttons {
    width: 100%;
  }

  .action-buttons > * {
    flex: 1 1 auto;
  }
}
</style>
