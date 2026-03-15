<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-card page-card">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">Параметры системы</h3>
            <div class="modal-subtitle">{{ system?.название }}</div>
          </div>
          <button class="close-btn" @click="$emit('close')">✕</button>
        </div>

        <div class="modal-body">
          <div v-for="group in groupedParams" :key="group.key" class="params-group ui-card-soft">
            <div class="group-title">{{ group.title }}</div>

            <div class="params-grid">
              <div
                v-for="param in group.items"
                :key="param.key"
                class="param-field"
              >
                <label class="ui-label">{{ param.label }}</label>

                <div v-if="param.description" class="field-description">
                  {{ param.description }}
                </div>

                <template v-if="param.type === 'select'">
                  <select
                    v-model="selectModes[param.key]"
                    class="ui-select"
                  >
                    <option
                      v-for="option in normalizedOptions(param)"
                      :key="option"
                      :value="option"
                    >
                      {{ option }}
                    </option>
                    <option value="__custom__">Свой вариант</option>
                  </select>

                  <input
                    v-if="selectModes[param.key] === '__custom__'"
                    v-model="customValues[param.key]"
                    type="text"
                    class="ui-input custom-input"
                    :placeholder="param.customPlaceholder || 'Введите свой вариант'"
                  />
                </template>

                <input
                  v-else-if="param.type === 'number'"
                  v-model.number="localValues[param.key]"
                  type="number"
                  class="ui-input"
                  :placeholder="param.placeholder || param.unit || ''"
                />

                <input
                  v-else
                  v-model="localValues[param.key]"
                  type="text"
                  class="ui-input"
                  :placeholder="param.placeholder || ''"
                />

                <div v-if="param.unit" class="unit-hint">{{ param.unit }}</div>

                <div v-if="param.example" class="example-hint">
                  Например: {{ param.example }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="ui-btn ui-btn-secondary" @click="$emit('back')">Назад</button>
          <button class="ui-btn ui-btn-primary" @click="submit">Создать смету</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  system: { type: Object, default: null },
  selectedKeys: { type: Array, default: () => [] },
  initialValues: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['close', 'back', 'submit'])

const localValues = ref({})
const selectModes = ref({})
const customValues = ref({})

const effectiveParams = computed(() => {
  const baseParams = Array.isArray(props.system?.параметры) ? props.system.параметры : []
  const extraParams = []

  for (const option of props.system?.опции || []) {
    if (props.selectedKeys.includes(option.key) && Array.isArray(option.params)) {
      extraParams.push(
        ...option.params.map(param => ({
          ...param,
          group: param.group || 'additional',
          description: param.description || `Параметр для опции «${option.label}»`
        }))
      )
    }
  }

  const seen = new Set()

  return [...baseParams, ...extraParams].filter(param => {
    if (seen.has(param.key)) return false
    seen.add(param.key)
    return true
  })
})

const groupedParams = computed(() => {
  const groups = {
    basic: {
      key: 'basic',
      title: 'Основные параметры',
      items: []
    },
    layers: {
      key: 'layers',
      title: 'Слои системы',
      items: []
    },
    additional: {
      key: 'additional',
      title: 'Дополнительные элементы',
      items: []
    }
  }

  for (const param of effectiveParams.value) {
    const groupKey = param.group && groups[param.group] ? param.group : 'basic'
    groups[groupKey].items.push(param)
  }

  return Object.values(groups).filter(group => group.items.length > 0)
})

watch(
  () => [props.isOpen, props.system, props.selectedKeys, props.initialValues],
  () => {
    const nextLocalValues = {}
    const nextSelectModes = {}
    const nextCustomValues = {}

    for (const param of effectiveParams.value) {
      const initialValue = props.initialValues?.[param.key]
      const options = normalizedOptions(param)

      if (param.type === 'select') {
        if (initialValue !== undefined && initialValue !== null && initialValue !== '') {
          if (options.includes(initialValue)) {
            nextSelectModes[param.key] = initialValue
            nextCustomValues[param.key] = ''
          } else {
            nextSelectModes[param.key] = '__custom__'
            nextCustomValues[param.key] = initialValue
          }
        } else if (param.value !== undefined && param.value !== '') {
          if (options.includes(param.value)) {
            nextSelectModes[param.key] = param.value
            nextCustomValues[param.key] = ''
          } else {
            nextSelectModes[param.key] = '__custom__'
            nextCustomValues[param.key] = param.value
          }
        } else if (options.length > 0) {
          nextSelectModes[param.key] = options[0]
          nextCustomValues[param.key] = ''
        } else {
          nextSelectModes[param.key] = '__custom__'
          nextCustomValues[param.key] = ''
        }
      } else if (param.type === 'number') {
        if (initialValue !== undefined) {
          nextLocalValues[param.key] = Number(initialValue) || 0
        } else if (param.value !== undefined && param.value !== '') {
          nextLocalValues[param.key] = Number(param.value) || 0
        } else {
          nextLocalValues[param.key] = 0
        }
      } else {
        if (initialValue !== undefined) {
          nextLocalValues[param.key] = initialValue
        } else if (param.value !== undefined) {
          nextLocalValues[param.key] = param.value
        } else {
          nextLocalValues[param.key] = ''
        }
      }
    }

    localValues.value = nextLocalValues
    selectModes.value = nextSelectModes
    customValues.value = nextCustomValues
  },
  { immediate: true }
)

function normalizedOptions(param) {
  return Array.isArray(param.options) ? param.options.filter(Boolean) : []
}

function submit() {
  const payload = { ...localValues.value }

  for (const param of effectiveParams.value) {
    if (param.type === 'select') {
      payload[param.key] =
        selectModes.value[param.key] === '__custom__'
          ? customValues.value[param.key] || ''
          : selectModes.value[param.key]
    }
  }

  emit('submit', payload)
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

.custom-input {
  margin-top: 8px;
}

.unit-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-soft);
}

.example-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-soft);
}

.modal-footer {
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

@media (max-width: 800px) {
  .params-grid {
    grid-template-columns: 1fr;
  }
}
</style>