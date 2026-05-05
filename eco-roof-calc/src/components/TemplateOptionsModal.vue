<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay">
      <div class="modal-card page-card">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">{{ title }}</h3>
            <div class="modal-subtitle">{{ systemTitle }}</div>
          </div>
          <button class="close-btn" type="button" @click="$emit('close')">✕</button>
        </div>

        <div class="modal-body">
          <div v-if="!mergedOptions.length" class="empty-block ui-card-soft">
            У этой системы нет дополнительных опций. Нажми «{{ continueLabel }}».
          </div>

          <label
            v-for="(option, index) in orderedOptions"
            :key="option.key"
            class="option-row ui-card-soft"
            :class="{
              dragging: draggedOptionKey === option.key,
              'drop-target': dragOverOptionKey === option.key && draggedOptionKey !== option.key
            }"
            draggable="true"
            @dragstart="handleOptionDragStart($event, option.key)"
            @dragover.prevent="handleOptionDragOver(option.key)"
            @drop.prevent="handleOptionDrop(option.key)"
            @dragend="handleOptionDragEnd"
          >
            <div class="option-left">
              <input
                type="checkbox"
                :value="option.key"
                v-model="localSelectedKeys"
              />
              <div>
                <div class="option-title">{{ option.label }}</div>
                <div class="option-subtitle" v-if="optionSubtitle(option)">
                  {{ optionSubtitle(option) }}
                </div>
              </div>
            </div>

            <div class="option-actions" aria-label="Переместить пункт">
              <button
                class="move-btn"
                type="button"
                title="Выше"
                :disabled="index === 0"
                @click.stop.prevent="moveOption(option.key, -1)"
              >
                ↑
              </button>
              <button
                class="move-btn"
                type="button"
                title="Ниже"
                :disabled="index === orderedOptions.length - 1"
                @click.stop.prevent="moveOption(option.key, 1)"
              >
                ↓
              </button>
            </div>
          </label>
        </div>

        <div class="modal-footer">
          <button class="ui-btn ui-btn-secondary" type="button" @click="$emit('close')">{{ cancelLabel }}</button>
          <button class="ui-btn ui-btn-primary" type="button" @click="submit">{{ continueLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getEnhancedTemplateMeta, getSystemTitle, normalizeSelectedTemplateOptionKeys } from '@/modules/templates/templateEnhancements'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  system: { type: Object, default: null },
  selectedKeys: { type: Array, default: () => [] },
  optionOrder: { type: Array, default: () => [] },
  title: { type: String, default: 'Что включить в смету' },
  continueLabel: { type: String, default: 'Вперед' },
  cancelLabel: { type: String, default: 'Назад на 1 шаг' }
})

const emit = defineEmits(['close', 'continue', 'order-change'])

const localSelectedKeys = ref([])
const localOptionOrder = ref([])
const lastSystemKey = ref('')
const draggedOptionKey = ref('')
const dragOverOptionKey = ref('')

const systemTitle = computed(() => getSystemTitle(props.system))
const mergedOptions = computed(() => getEnhancedTemplateMeta(props.system || {}).options || [])
const orderedOptions = computed(() => {
  const optionMap = new Map(mergedOptions.value.map((option) => [option.key, option]))
  const ordered = localOptionOrder.value
    .map((key) => optionMap.get(key))
    .filter(Boolean)

  const usedKeys = new Set(ordered.map((option) => option.key))
  const missing = mergedOptions.value.filter((option) => !usedKeys.has(option.key))
  return [...ordered, ...missing]
})

watch(
  () => [props.isOpen, props.system, props.selectedKeys, props.optionOrder],
  () => {
    const systemKey = `${props.system?.код || props.system?.code || props.system?.идентификатор || ''}`
    if (systemKey !== lastSystemKey.value) {
      localOptionOrder.value = []
      lastSystemKey.value = systemKey
    }

    const explicitKeys = Array.isArray(props.selectedKeys) ? [...props.selectedKeys] : []

    if (explicitKeys.length) {
      localSelectedKeys.value = normalizeSelectedTemplateOptionKeys(explicitKeys)
      localOptionOrder.value = buildOptionOrder(localSelectedKeys.value, props.optionOrder)
      return
    }

    localSelectedKeys.value = normalizeSelectedTemplateOptionKeys(
      mergedOptions.value
        .filter((option) => option.default)
        .map((option) => option.key)
    )
    localOptionOrder.value = buildOptionOrder(localSelectedKeys.value, props.optionOrder)
  },
  { immediate: true, deep: true }
)

function buildOptionOrder(preferredKeys = [], preferredOrder = []) {
  const optionKeys = mergedOptions.value.map((option) => option.key)
  const explicitOrder = normalizeSelectedTemplateOptionKeys(preferredOrder)
    .filter((key) => optionKeys.includes(key))

  if (explicitOrder.length) {
    return [...explicitOrder, ...optionKeys.filter((key) => !explicitOrder.includes(key))]
  }

  const currentOrder = localOptionOrder.value.filter((key) => optionKeys.includes(key))

  if (currentOrder.length) {
    return [...currentOrder, ...optionKeys.filter((key) => !currentOrder.includes(key))]
  }

  const preferred = normalizeSelectedTemplateOptionKeys(preferredKeys)
    .filter((key) => optionKeys.includes(key))
  const naturalSelectedOrder = optionKeys.filter((key) => preferred.includes(key))
  const hasCustomSelectedOrder = preferred.some((key, index) => key !== naturalSelectedOrder[index])

  if (hasCustomSelectedOrder) {
    return [...preferred, ...optionKeys.filter((key) => !preferred.includes(key))]
  }

  return optionKeys
}

function moveOption(key, direction) {
  const order = normalizeCurrentOrder()
  const index = order.indexOf(key)
  const nextIndex = index + direction

  if (index < 0 || nextIndex < 0 || nextIndex >= order.length) {
    return
  }

  const [item] = order.splice(index, 1)
  order.splice(nextIndex, 0, item)
  localOptionOrder.value = order
  notifyOrderChange()
}

function normalizeCurrentOrder() {
  const optionKeys = mergedOptions.value.map((option) => option.key)
  const current = localOptionOrder.value.filter((key) => optionKeys.includes(key))
  return [...current, ...optionKeys.filter((key) => !current.includes(key))]
}

function moveOptionTo(sourceKey, targetKey) {
  if (!sourceKey || !targetKey || sourceKey === targetKey) return

  const order = normalizeCurrentOrder()
  const sourceIndex = order.indexOf(sourceKey)
  const targetIndex = order.indexOf(targetKey)

  if (sourceIndex < 0 || targetIndex < 0) return

  const [item] = order.splice(sourceIndex, 1)
  order.splice(targetIndex, 0, item)
  localOptionOrder.value = order
  notifyOrderChange()
}

function notifyOrderChange() {
  emit('order-change', normalizeCurrentOrder())
}

function handleOptionDragStart(event, key) {
  draggedOptionKey.value = key
  dragOverOptionKey.value = ''
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', key)
}

function handleOptionDragOver(key) {
  dragOverOptionKey.value = key
}

function handleOptionDrop(targetKey) {
  moveOptionTo(draggedOptionKey.value, targetKey)
  handleOptionDragEnd()
}

function handleOptionDragEnd() {
  draggedOptionKey.value = ''
  dragOverOptionKey.value = ''
}

function optionSubtitle(option) {
  if (option?.description) {
    return option.description
  }

  const descriptions = (option?.params || [])
    .map((param) => param?.description)
    .filter(Boolean)

  if (descriptions.length) {
    return descriptions.join('; ')
  }

  return option?.params?.length ? 'Появятся дополнительные параметры' : ''
}

function submit() {
  const selectedSet = new Set(normalizeSelectedTemplateOptionKeys(localSelectedKeys.value))
  const orderedSelected = orderedOptions.value
    .filter((option) => selectedSet.has(option.key))
    .map((option) => option.key)
  const unknownSelected = [...selectedSet].filter((key) => !orderedSelected.includes(key))

  const order = normalizeCurrentOrder()
  emit('order-change', order)
  emit('continue', normalizeSelectedTemplateOptionKeys([...orderedSelected, ...unknownSelected]), order)
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
  max-width: 720px;
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
  position: sticky;
  top: -20px;
  z-index: 2;
  background: var(--bg-card);
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-color);
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
  gap: 12px;
}

.option-row {
  padding: 14px 16px;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  transition: border-color var(--transition-fast), opacity var(--transition-fast), transform var(--transition-fast);
}

.option-row:active {
  cursor: grabbing;
}

.option-row.dragging {
  opacity: 0.55;
  transform: scale(0.99);
}

.option-row.drop-target {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--accent) 28%, transparent);
}

.option-left {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  min-width: 0;
}

.option-title {
  font-weight: 700;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-soft);
  line-height: 1.35;
}

.option-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.move-btn {
  width: 34px;
  height: 34px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--surface-soft);
  color: var(--text-main);
  cursor: pointer;
  font-weight: 800;
}

.move-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.move-btn:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.empty-block {
  padding: 20px;
  color: var(--text-soft);
  text-align: center;
}

.modal-footer {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  position: sticky;
  bottom: -20px;
  z-index: 2;
  background: var(--bg-card);
  padding-top: 14px;
  border-top: 1px solid var(--border-color);
}

@media (max-width: 640px) {
  .option-row {
    align-items: flex-start;
  }

  .option-actions {
    flex-direction: column;
  }
}
</style>
