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
          <div v-if="!mergedOptions.length" class="empty-block ui-card-soft">
            У этой системы нет дополнительных опций. Нажми «{{ continueLabel }}».
          </div>

          <label
            v-for="option in mergedOptions"
            :key="option.key"
            class="option-row ui-card-soft"
          >
            <div class="option-left">
              <input
                type="checkbox"
                :value="option.key"
                v-model="localSelectedKeys"
              />
              <div>
                <div class="option-title">{{ option.label }}</div>
                <div class="option-subtitle" v-if="option.params?.length">
                  Появятся дополнительные параметры
                </div>
              </div>
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
  title: { type: String, default: 'Что включить в смету' },
  continueLabel: { type: String, default: 'Далее' },
  cancelLabel: { type: String, default: 'Отмена' }
})

const emit = defineEmits(['close', 'continue'])

const localSelectedKeys = ref([])

const systemTitle = computed(() => getSystemTitle(props.system))
const mergedOptions = computed(() => getEnhancedTemplateMeta(props.system || {}).options || [])

watch(
  () => [props.isOpen, props.system, props.selectedKeys],
  () => {
    const explicitKeys = Array.isArray(props.selectedKeys) ? [...props.selectedKeys] : []

    if (explicitKeys.length) {
      localSelectedKeys.value = normalizeSelectedTemplateOptionKeys(explicitKeys)
      return
    }

    localSelectedKeys.value = normalizeSelectedTemplateOptionKeys(
      mergedOptions.value
        .filter((option) => option.default)
        .map((option) => option.key)
    )
  },
  { immediate: true, deep: true }
)

function submit() {
  emit('continue', normalizeSelectedTemplateOptionKeys(localSelectedKeys.value))
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
  cursor: pointer;
}

.option-left {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.option-title {
  font-weight: 700;
  color: var(--text-main);
}

.option-subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-soft);
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
}
</style>
