<template>
  <Teleport to="body">
    <div v-if="isOpen && system" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-card page-card">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">Редактировать пирог</h3>
            <div class="modal-subtitle">{{ systemTitle }}</div>
          </div>
          <button class="close-btn" type="button" @click="$emit('close')">✕</button>
        </div>

        <div class="modal-body">
          <div class="params-group ui-card-soft">
            <div class="group-title">Что включить в смету</div>

            <div v-if="!mergedOptions.length" class="empty-block">
              У этой системы нет дополнительных опций.
            </div>

            <label
              v-for="option in mergedOptions"
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

                <template v-if="isSelectParam(param)">
                  <select v-model="selectModes[param.key]" class="ui-select">
                    <option v-for="option in normalizedOptions(param)" :key="option" :value="option">{{ option }}</option>
                    <option value="__custom__">Свой вариант</option>
                  </select>

                  <input
                    v-if="selectModes[param.key] === '__custom__'"
                    v-model="customValues[param.key]"
                    type="text"
                    class="ui-input"
                    :placeholder="param.customPlaceholder || 'Введите свой вариант'"
                  />
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
import {
  getEffectiveTemplateParams,
  getEnhancedTemplateMeta,
  getSystemTitle,
  sanitizeTemplateParamValues,
  normalizeSelectedTemplateOptionKeys
} from '../shared/templateSystemEnhancements'

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
const selectModes = ref({})
const customValues = ref({})

const systemTitle = computed(() => getSystemTitle(props.system || {}))
const mergedOptions = computed(() => getEnhancedTemplateMeta(props.system || {}).options || [])
const normalizedSelectedKeys = computed(() => normalizeSelectedTemplateOptionKeys(localSelectedKeys.value || []))
const visibleParams = computed(() => getEffectiveTemplateParams(props.system || {}, normalizedSelectedKeys.value))

watch(
  () => [props.isOpen, props.system, props.initialSelectedKeys, props.initialParamValues],
  () => {
    localSelectedKeys.value = normalizeSelectedTemplateOptionKeys(Array.isArray(props.initialSelectedKeys) ? [...props.initialSelectedKeys] : [])

    if (!localSelectedKeys.value.length) {
      localSelectedKeys.value = normalizeSelectedTemplateOptionKeys(mergedOptions.value
        .filter((option) => option.default)
        .map((option) => option.key))
    }

    localParamValues.value = {}
    selectModes.value = {}
    customValues.value = {}

    syncVisibleState({
      previousTextValues: {},
      previousSelectModes: {},
      previousCustomValues: {},
      fallbackValues: props.initialParamValues || {}
    })
  },
  { immediate: true, deep: true }
)

watch(
  visibleParams,
  () => {
    syncVisibleState({
      previousTextValues: localParamValues.value,
      previousSelectModes: selectModes.value,
      previousCustomValues: customValues.value,
      fallbackValues: props.initialParamValues || {}
    })
  },
  { deep: true }
)

function syncVisibleState({ previousTextValues = {}, previousSelectModes = {}, previousCustomValues = {}, fallbackValues = {} } = {}) {
  const nextLocalValues = {}
  const nextSelectModes = {}
  const nextCustomValues = {}

  for (const param of visibleParams.value) {
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

  localParamValues.value = nextLocalValues
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
  const payload = { ...localParamValues.value }

  for (const param of visibleParams.value) {
    if (isSelectParam(param)) {
      payload[param.key] = selectModes.value[param.key] === '__custom__'
        ? customValues.value[param.key]
        : selectModes.value[param.key]
    }
  }

  emit('submit', {
    selectedKeys: normalizedSelectedKeys.value,
    paramValues: sanitizeTemplateParamValues(props.system || {}, normalizedSelectedKeys.value, payload)
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
