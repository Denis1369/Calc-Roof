<template>
  <Teleport to="body">
    <div v-if="isOpen && system" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-card page-card">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">Редактировать пирог</h3>
            <div class="modal-subtitle">{{ system?.название }}</div>
          </div>
          <button class="close-btn" type="button" @click="$emit('close')">✕</button>
        </div>

        <div class="modal-body">
          <div class="params-group ui-card-soft">
            <div class="group-title">Опции</div>

            <div v-if="!system?.опции?.length" class="empty-block">
              У этой системы нет дополнительных опций.
            </div>

            <label
              v-for="option in system?.опции || []"
              :key="option.key"
              class="option-row"
            >
              <div class="option-left">
                <input type="checkbox" :value="option.key" v-model="localSelectedKeys" />
                <div>
                  <div class="option-title">{{ option.label }}</div>
                  <div class="option-subtitle" v-if="option.params?.length">Появятся дополнительные параметры</div>
                </div>
              </div>
            </label>
          </div>

          <div class="params-group ui-card-soft">
            <div class="group-title">Параметры</div>

            <div class="params-grid">
              <div v-for="param in visibleParams" :key="param.key" class="param-field">
                <label class="ui-label">{{ param.label }}</label>
                <div class="field-description" v-if="param.description">{{ param.description }}</div>

                <template v-if="param.type === 'select' || (Array.isArray(param.options) && param.options.length)">
                  <select v-model="localParamValues[param.key]" class="ui-select">
                    <option v-for="option in param.options" :key="option" :value="option">{{ option }}</option>
                  </select>
                </template>

                <template v-else-if="param.type === 'number'">
                  <input v-model.number="localParamValues[param.key]" type="number" step="0.01" class="ui-input" />
                </template>

                <template v-else>
                  <input v-model="localParamValues[param.key]" type="text" class="ui-input" />
                </template>

                <div class="unit-hint" v-if="param.unit">Ед.: {{ param.unit }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="ui-btn ui-btn-secondary" type="button" @click="$emit('close')">Отмена</button>
          <button class="ui-btn ui-btn-primary" type="button" @click="submit">Применить</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  isOpen: Boolean,
  system: Object,
  initialSelectedKeys: {
    type: Array,
    default: () => []
  },
  initialParamValues: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['close', 'submit'])

const localSelectedKeys = ref([])
const localParamValues = ref({})

watch(
  () => [props.isOpen, props.system, props.initialSelectedKeys, props.initialParamValues],
  () => {
    localSelectedKeys.value = Array.isArray(props.initialSelectedKeys) ? [...props.initialSelectedKeys] : []
    localParamValues.value = { ...(props.initialParamValues || {}) }

    for (const param of props.system?.параметры || []) {
      if (localParamValues.value[param.key] === undefined) {
        localParamValues.value[param.key] = param.value
      }
    }
  },
  { immediate: true, deep: true }
)

const visibleParams = computed(() => {
  const base = Array.isArray(props.system?.параметры) ? [...props.system.параметры] : []
  const selected = new Set(localSelectedKeys.value)

  for (const option of props.system?.опции || []) {
    if (!selected.has(option.key)) continue
    for (const param of option.params || []) {
      base.push(param)
      if (localParamValues.value[param.key] === undefined) {
        localParamValues.value[param.key] = param.value
      }
    }
  }

  return base
})

function submit() {
  emit('submit', {
    selectedKeys: [...localSelectedKeys.value],
    paramValues: { ...localParamValues.value }
  })
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 2000;
}

.modal-card {
  width: 100%;
  max-width: 980px;
  padding: 20px;
  max-height: calc(100vh - 40px);
  overflow: auto;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.modal-title {
  margin: 0;
  font-size: 24px;
}

.modal-subtitle {
  margin-top: 6px;
  color: var(--text-soft);
}

.close-btn {
  border: none;
  background: transparent;
  color: var(--text-soft);
  font-size: 22px;
  cursor: pointer;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.params-group {
  padding: 16px;
}

.group-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 14px;
}

.params-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.param-field {
  min-width: 0;
}

.field-description {
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--text-soft);
  line-height: 1.35;
}

.unit-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-soft);
}

.modal-footer {
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.option-row {
  display: block;
  padding: 12px;
  border-radius: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  margin-bottom: 10px;
}

.option-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.option-title {
  font-weight: 700;
}

.option-subtitle, .empty-block {
  color: var(--text-soft);
  font-size: 13px;
}

@media (max-width: 800px) {
  .params-grid {
    grid-template-columns: 1fr;
  }
}
</style>
