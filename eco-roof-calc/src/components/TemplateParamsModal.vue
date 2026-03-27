<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-card page-card">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">{{ title }}</h3>
            <div class="modal-subtitle">{{ systemTitle }}</div>
          </div>
          <button class="close-btn" type="button" @click="$emit('close')">✕</button>
        </div>

        <div class="modal-body">
          <div v-for="group in groupedParams" :key="group.key" class="params-group ui-card-soft">
            <div class="group-title">{{ group.title }}</div>

            <div class="params-grid">
              <div v-for="param in group.items" :key="param.key" class="param-field">
                <label class="ui-label">{{ param.label }}</label>

                <div v-if="param.description" class="field-description">
                  {{ param.description }}
                </div>

                <template v-if="isSelectParam(param)">
                  <select v-model="selectModes[param.key]" class="ui-select">
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
                  step="0.01"
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
                <div v-if="param.example" class="example-hint">Например: {{ param.example }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="ui-btn ui-btn-secondary" type="button" @click="$emit('back')">{{ backLabel }}</button>
          <button class="ui-btn ui-btn-primary" type="button" @click="submit">{{ submitLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import {
  getEffectiveTemplateParams,
  getSystemTitle,
  sanitizeTemplateParamValues,
  normalizeSelectedTemplateOptionKeys
} from '@/modules/templates/templateEnhancements'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  system: { type: Object, default: null },
  selectedKeys: { type: Array, default: () => [] },
  initialValues: { type: Object, default: () => ({}) },
  title: { type: String, default: 'Параметры системы' },
  submitLabel: { type: String, default: 'Создать смету' },
  backLabel: { type: String, default: 'Назад' }
})

const emit = defineEmits(['close', 'back', 'submit'])

const GROUP_TITLES = {
  basic: 'Основные параметры',
  layers: 'Слои системы',
  drainage: 'Водоотведение и аэраторы',
  details: 'Примыкания и узлы',
  engineering: 'Инженерные узлы и проходки',
  safety: 'Ограждения и безопасность',
  additional: 'Дополнительные элементы'
}

const localValues = ref({})
const selectModes = ref({})
const customValues = ref({})

const systemTitle = computed(() => getSystemTitle(props.system))
const normalizedSelectedKeys = computed(() => normalizeSelectedTemplateOptionKeys(props.selectedKeys || []))
const effectiveParams = computed(() => getEffectiveTemplateParams(props.system || {}, normalizedSelectedKeys.value))

const groupedParams = computed(() => {
  const groups = new Map()

  for (const param of effectiveParams.value) {
    const groupKey = param.group || 'basic'
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        title: GROUP_TITLES[groupKey] || 'Дополнительные параметры',
        items: []
      })
    }

    groups.get(groupKey).items.push(param)
  }

  return [...groups.values()].filter((group) => group.items.length > 0)
})

watch(
  () => [props.isOpen, props.system, props.selectedKeys, props.initialValues, effectiveParams.value],
  () => {
    syncState({
      previousTextValues: localValues.value,
      previousSelectModes: selectModes.value,
      previousCustomValues: customValues.value,
      fallbackValues: props.initialValues || {}
    })
  },
  { immediate: true, deep: true }
)

function syncState({ previousTextValues = {}, previousSelectModes = {}, previousCustomValues = {}, fallbackValues = {} } = {}) {
  const nextLocalValues = {}
  const nextSelectModes = {}
  const nextCustomValues = {}

  for (const param of effectiveParams.value) {
    const options = normalizedOptions(param)
    const hasExplicitFallback = Object.prototype.hasOwnProperty.call(fallbackValues, param.key)
    const fallbackValue = hasExplicitFallback ? fallbackValues[param.key] : param.value

    if (isSelectParam(param)) {
      const previousMode = previousSelectModes[param.key]
      const previousCustom = previousCustomValues[param.key]
      const previousVisibleValue = previousMode === '__custom__' ? previousCustom : previousMode
      const rawValue = previousVisibleValue ?? fallbackValue ?? options[0] ?? ''
      const stringValue = `${rawValue ?? ''}`

      if (options.includes(stringValue)) {
        nextSelectModes[param.key] = stringValue
        nextCustomValues[param.key] = ''
      } else if (stringValue) {
        nextSelectModes[param.key] = '__custom__'
        nextCustomValues[param.key] = stringValue
      } else if (options.length > 0) {
        nextSelectModes[param.key] = options[0]
        nextCustomValues[param.key] = ''
      } else {
        nextSelectModes[param.key] = '__custom__'
        nextCustomValues[param.key] = ''
      }

      continue
    }

    const previousValue = previousTextValues[param.key]
    const rawValue = previousValue ?? fallbackValue ?? (param.type === 'number' ? 0 : '')

    if (param.type === 'number') {
      nextLocalValues[param.key] = Number(rawValue) || 0
    } else {
      nextLocalValues[param.key] = `${rawValue ?? ''}`
    }
  }

  localValues.value = nextLocalValues
  selectModes.value = nextSelectModes
  customValues.value = nextCustomValues
}

function isSelectParam(param) {
  return param?.type === 'select' || normalizedOptions(param).length > 0
}

function normalizedOptions(param) {
  if (Array.isArray(param?.options)) {
    return param.options.map((item) => `${item}`)
  }

  if (typeof param?.options === 'string' && param.options.trim()) {
    try {
      const parsed = JSON.parse(param.options)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => `${item}`)
      }
    } catch {
      return param.options
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }
  }

  return []
}

function submit() {
  const payload = { ...localValues.value }

  for (const param of effectiveParams.value) {
    if (isSelectParam(param)) {
      payload[param.key] = selectModes.value[param.key] === '__custom__'
        ? customValues.value[param.key]
        : selectModes.value[param.key]
    }
  }

  emit('submit', sanitizeTemplateParamValues(props.system || {}, normalizedSelectedKeys.value, payload))
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
