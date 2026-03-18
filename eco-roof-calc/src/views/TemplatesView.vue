<template>
  <div class="templates-page">
    <div class="page-header">
      <h1 class="ui-title">Шаблоны</h1>
      <div class="header-actions">
        <button class="ui-btn ui-btn-primary" @click="createNewTemplate">Новый шаблон</button>
      </div>
    </div>

    <div class="layout">
      <aside class="sidebar ui-card">
        <div class="sidebar-title">Список шаблонов</div>

        <div v-if="loading" class="empty-state ui-card-soft">
          Загрузка...
        </div>

        <div v-else-if="templates.length === 0" class="empty-state ui-card-soft">
          Шаблонов пока нет
        </div>

        <button
          v-for="template in templates"
          :key="template.идентификатор"
          class="template-list-item"
          :class="{ active: selectedTemplateId === template.идентификатор }"
          @click="selectTemplate(template.идентификатор)"
        >
          <span>{{ template.название || 'Без названия' }}</span>
        </button>
      </aside>

      <section class="content">
        <div v-if="!selectedTemplate" class="empty-editor ui-card-soft">
          Выбери шаблон или создай новый
        </div>

        <div v-else class="editor-card page-card">
          <div class="editor-header">
            <div class="editor-header-left">
              <label class="ui-label">Название шаблона</label>
              <input
                v-model="selectedTemplate.название"
                class="ui-input"
                type="text"
                placeholder="Введите название шаблона"
              >
            </div>

            <div class="editor-header-actions">
              <button class="ui-btn ui-btn-secondary" @click="addItem">Добавить пункт</button>
              <button class="ui-btn ui-btn-success" @click="saveTemplate">Сохранить</button>
              <button class="ui-btn ui-btn-danger" @click="deleteTemplate">Удалить</button>
            </div>
          </div>

          <div class="items-section">
            <div v-if="selectedTemplate.data.items.length === 0" class="empty-state ui-card-soft">
              В шаблоне пока нет пунктов
            </div>

            <div
              v-for="(item, itemIndex) in selectedTemplate.data.items"
              :key="item.key"
              class="item-card ui-card-soft"
            >
              <div class="item-top">
                <label class="checkbox-row">
                  <input v-model="item.checked" type="checkbox">
                  <span>Показывать в смете</span>
                </label>

                <div class="item-actions">
                  <button class="ui-btn ui-btn-secondary mini-btn" @click="moveItemUp(itemIndex)" :disabled="itemIndex === 0">↑</button>
                  <button class="ui-btn ui-btn-secondary mini-btn" @click="moveItemDown(itemIndex)" :disabled="itemIndex === selectedTemplate.data.items.length - 1">↓</button>
                  <button class="ui-btn ui-btn-danger mini-btn" @click="removeItem(itemIndex)">Удалить пункт</button>
                </div>
              </div>

              <div class="grid-two">
                <div>
                  <label class="ui-label">Название пункта</label>
                  <input
                    v-model="item.label"
                    class="ui-input"
                    type="text"
                    placeholder="Например: Усиление деформационного шва"
                  >
                </div>

                <div>
                  <label class="ui-label">Ключ пункта</label>
                  <input
                    v-model="item.key"
                    class="ui-input"
                    type="text"
                    placeholder="Например: joint_reinforcement"
                  >
                </div>
              </div>

              <div v-if="item.checked" class="fields-block">
                <div class="fields-header">
                  <div class="fields-title">Поля ввода</div>
                  <button class="ui-btn ui-btn-secondary small-btn" @click="addField(item)">Добавить поле</button>
                </div>

                <div
                  v-for="(field, fieldIndex) in item.fields"
                  :key="field.key"
                  class="field-row ui-card"
                >
                  <div class="field-grid">
                    <div>
                      <label class="ui-label">Название поля</label>
                      <input
                        v-model="field.label"
                        class="ui-input"
                        type="text"
                        placeholder="Например: Длина"
                      >
                    </div>

                    <div>
                      <label class="ui-label">Ключ поля</label>
                      <input
                        v-model="field.key"
                        class="ui-input"
                        type="text"
                        placeholder="Например: length"
                      >
                    </div>

                    <div>
                      <label class="ui-label">Тип</label>
                      <select v-model="field.type" class="ui-select">
                        <option value="number">Число</option>
                        <option value="text">Текст</option>
                      </select>
                    </div>

                    <div>
                      <label class="ui-label">Ед. изм.</label>
                      <input
                        v-model="field.unit"
                        class="ui-input"
                        type="text"
                        placeholder="м², м.п., шт"
                      >
                    </div>

                    <div>
                      <label class="ui-label">Значение по умолчанию</label>
                      <input
                        v-model="field.value"
                        class="ui-input"
                        :type="field.type === 'number' ? 'number' : 'text'"
                        placeholder="0"
                      >
                    </div>
                  </div>

                  <div class="field-actions">
                    <button class="ui-btn ui-btn-danger mini-btn" @click="removeField(item, fieldIndex)">
                      Удалить поле
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getDb } from '../infrastructure/db/client'

const loading = ref(false)
const templates = ref([])
const selectedTemplateId = ref(null)

const selectedTemplate = computed(() => {
  return templates.value.find((item) => item.идентификатор === selectedTemplateId.value) || null
})

function createTemplateField(payload = {}) {
  return {
    key: payload.key || crypto.randomUUID(),
    label: payload.label || '',
    type: payload.type || 'number',
    unit: payload.unit || '',
    value: payload.value ?? ''
  }
}

function createTemplateItem(payload = {}) {
  return {
    key: payload.key || crypto.randomUUID(),
    label: payload.label || 'Новый пункт',
    checked: payload.checked ?? false,
    fields: Array.isArray(payload.fields) && payload.fields.length
      ? payload.fields.map((field) => createTemplateField(field))
      : [createTemplateField()]
  }
}

function createTemplatePayload(payload = {}) {
  return {
    version: 2,
    items: Array.isArray(payload.items)
      ? payload.items.map((item) => createTemplateItem(item))
      : []
  }
}

function normalizeTemplateData(rawValue) {
  if (!rawValue) {
    return createTemplatePayload()
  }

  try {
    const parsed = JSON.parse(rawValue)

    if (Array.isArray(parsed)) {
      return createTemplatePayload({
        items: parsed.map((item) => createTemplateItem(item))
      })
    }

    return createTemplatePayload({
      ...parsed,
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item) => createTemplateItem(item))
        : []
    })
  } catch {
    return createTemplatePayload()
  }
}

async function ensureTemplatesTable() {
  const db = await getDb()
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      data_json TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

async function loadTemplates() {
  loading.value = true

  try {
    const db = await getDb()
    const rows = await db.select(`
      SELECT id, name, data_json
      FROM user_templates
      ORDER BY id DESC
    `)

    templates.value = rows.map((row) => ({
      идентификатор: row.id,
      название: row.name || '',
      data: normalizeTemplateData(row.data_json)
    }))

    if (!selectedTemplateId.value && templates.value.length > 0) {
      selectedTemplateId.value = templates.value[0].идентификатор
    }
  } finally {
    loading.value = false
  }
}

function selectTemplate(id) {
  selectedTemplateId.value = id
}

async function createNewTemplate() {
  const db = await getDb()
  const name = `Новый шаблон ${templates.value.length + 1}`
  const payload = createTemplatePayload({
    items: [
      createTemplateItem({
        label: 'Новый пункт',
        checked: true,
        fields: [createTemplateField({ label: 'Количество', key: 'quantity', type: 'number', unit: 'шт', value: '' })]
      })
    ]
  })

  await db.execute(
    `INSERT INTO user_templates (name, data_json) VALUES ($1, $2)`,
    [name, JSON.stringify(payload)]
  )

  await loadTemplates()

  if (templates.value.length > 0) {
    selectedTemplateId.value = templates.value[0].идентификатор
  }
}

function addItem() {
  if (!selectedTemplate.value) return

  selectedTemplate.value.data.items.push(
    createTemplateItem({
      label: 'Новый пункт',
      checked: false,
      fields: [createTemplateField({ label: 'Количество', key: 'quantity', type: 'number', unit: '', value: '' })]
    })
  )
}

function removeItem(index) {
  if (!selectedTemplate.value) return
  selectedTemplate.value.data.items.splice(index, 1)
}

function moveItemUp(index) {
  if (!selectedTemplate.value || index === 0) return
  const list = selectedTemplate.value.data.items
  const temp = list[index - 1]
  list[index - 1] = list[index]
  list[index] = temp
}

function moveItemDown(index) {
  if (!selectedTemplate.value) return
  const list = selectedTemplate.value.data.items
  if (index >= list.length - 1) return
  const temp = list[index + 1]
  list[index + 1] = list[index]
  list[index] = temp
}

function addField(item) {
  item.fields.push(
    createTemplateField({
      label: 'Новое поле',
      key: `field_${item.fields.length + 1}`,
      type: 'number',
      unit: '',
      value: ''
    })
  )
}

function removeField(item, fieldIndex) {
  item.fields.splice(fieldIndex, 1)
  if (item.fields.length === 0) {
    item.fields.push(createTemplateField())
  }
}

async function saveTemplate() {
  if (!selectedTemplate.value) return

  const currentId = selectedTemplate.value.идентификатор
  const db = await getDb()

  const payload = {
    version: 2,
    items: selectedTemplate.value.data.items.map((item) => ({
      key: item.key || crypto.randomUUID(),
      label: item.label || '',
      checked: !!item.checked,
      fields: item.fields.map((field) => ({
        key: field.key || crypto.randomUUID(),
        label: field.label || '',
        type: field.type || 'number',
        unit: field.unit || '',
        value: field.value ?? ''
      }))
    }))
  }

  await db.execute(
    `UPDATE user_templates SET name = $1, data_json = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
    [
      selectedTemplate.value.название || 'Без названия',
      JSON.stringify(payload),
      currentId
    ]
  )

  await loadTemplates()
  selectedTemplateId.value = currentId
}

async function deleteTemplate() {
  if (!selectedTemplate.value) return
  if (!window.confirm('Удалить шаблон?')) return

  const currentId = selectedTemplate.value.идентификатор
  const db = await getDb()

  await db.execute(`DELETE FROM user_templates WHERE id = $1`, [currentId])

  await loadTemplates()

  if (templates.value.length > 0) {
    selectedTemplateId.value = templates.value[0].идентификатор
  } else {
    selectedTemplateId.value = null
  }
}

onMounted(async () => {
  await ensureTemplatesTable()
  await loadTemplates()
})
</script>

<style scoped>
.templates-page {
  padding: 20px;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 20px;
  min-height: calc(100vh - 140px);
}

.sidebar {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
}

.template-list-item {
  text-align: left;
  border: 1px solid var(--border-color);
  background: var(--bg-card-soft);
  padding: 12px 14px;
  border-radius: 10px;
  cursor: pointer;
}

.template-list-item.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.content {
  min-width: 0;
}

.empty-state,
.empty-editor {
  padding: 20px;
}

.editor-card {
  padding: 20px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: end;
  margin-bottom: 20px;
}

.editor-header-left {
  flex: 1;
}

.editor-header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.items-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.item-card {
  padding: 16px;
}

.item-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.item-actions,
.field-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.grid-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.fields-block {
  margin-top: 16px;
}

.fields-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.fields-title {
  font-weight: 700;
}

.field-row {
  padding: 14px;
  margin-bottom: 12px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.mini-btn,
.small-btn {
  padding: 8px 12px;
}

@media (max-width: 1200px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .editor-header,
  .item-top,
  .fields-header {
    flex-direction: column;
    align-items: stretch;
  }

  .grid-two,
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
