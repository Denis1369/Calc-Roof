<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-card page-card small-card">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">Сохранить пресет</h3>
            <div class="modal-subtitle">Название сохранённой конфигурации</div>
          </div>
          <button class="close-btn" @click="$emit('close')">✕</button>
        </div>

        <div class="modal-body">
          <label class="ui-label">Название пресета</label>
          <input
            v-model="localTitle"
            class="ui-input"
            type="text"
            placeholder="Например: Склад 6500 м² с фахверками"
            @keyup.enter="submit"
          />
        </div>

        <div class="modal-footer">
          <button class="ui-btn ui-btn-secondary" @click="$emit('close')">Отмена</button>
          <button class="ui-btn ui-btn-primary" @click="submit">Сохранить</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  title: { type: String, default: '' }
})

const emit = defineEmits(['close', 'submit'])
const localTitle = ref('')

watch(
  () => [props.isOpen, props.title],
  () => {
    localTitle.value = props.title || ''
  },
  { immediate: true }
)

function submit() {
  emit('submit', (localTitle.value || '').trim())
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
  z-index: 2100;
}

.modal-card.small-card {
  width: 100%;
  max-width: 520px;
  padding: 20px;
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

.modal-footer {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
