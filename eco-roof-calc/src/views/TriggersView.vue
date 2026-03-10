<template>
  <div class="triggers-view">
    <h2>Управление Макросами (Авто-триггеры)</h2>
    <p class="subtitle">Настройте правила, по которым программа будет сама подбирать названия и добавлять материалы.</p>
    
    <div class="layout">
      <div class="triggers-list">
        <button @click="addNewTrigger" class="btn-add">+ Создать макрос</button>
        <ul>
          <li 
            v-for="trigger in triggers" 
            :key="trigger.идентификатор"
            @click="editTrigger(trigger)"
            :class="{ active: currentTrigger?.идентификатор === trigger.идентификатор }"
          >
            <strong>{{ trigger.описание }}</strong>
            <code class="visual-condition">Если введено: "{{ trigger.условие }}"</code>
          </li>
          <li v-if="triggers.length === 0" class="empty-msg center">Макросов пока нет</li>
        </ul>
      </div>

      <div class="trigger-editor" v-if="currentTrigger">
        <h3 class="editor-title">{{ isNew ? 'Новый макрос' : 'Редактирование макроса' }}</h3>
        
        <div class="editor-grid">
          <div class="card-panel condition-panel">
            <h4>1. Условие срабатывания</h4>
            <div class="form-group">
              <label>Название макроса (для себя):</label>
              <input v-model="currentTrigger.описание" placeholder="Например: Добавление скотча к пароизоляции" />
            </div>
            <div class="form-group">
              <label>Ключевые слова (через запятую):</label>
              <input v-model="currentTrigger.условие" placeholder="Напр: пароизоляцион, пленк" />
              <small>Если пользователь введет эти слова, макрос сработает.</small>
            </div>
          </div>

          <div class="card-panel work-panel">
            <h4>2. Что сделать с Работой?</h4>
            <div class="form-group">
              <label>Авто-исправление названия на официальное:</label>
              <input v-model="currentTrigger.название_работы" placeholder="Напр: Устройство пароизоляционного слоя из пленки" />
            </div>
            <div class="form-group">
              <label>Подставить формулу работы:</label>
              <input v-model="currentTrigger.формула_работы" placeholder="Напр: S" class="code-font" />
            </div>
          </div>

          <div class="card-panel mat-panel">
            <h4>3. Какой материал добавить автоматически?</h4>
            <div class="form-group">
              <label>Официальное название материала:</label>
              <input v-model="currentTrigger.название_материала" placeholder="Напр: Двусторонний соединительный скотч" />
            </div>
            <div class="form-row">
              <div class="form-group flex-1">
                <label>Ед. изм.:</label>
                <input v-model="currentTrigger.ед_изм_материала" placeholder="шт" />
              </div>
              <div class="form-group flex-3">
                <label>Формула материала:</label>
                <input v-model="currentTrigger.формула_материала" placeholder="Напр: (([WORK_CODE] / 3) + P) / 25" class="code-font" />
                <small>Используйте <strong>[WORK_CODE]</strong> чтобы сослаться на объем созданной работы!</small>
              </div>
            </div>
          </div>
        </div>

        <div class="actions">
          <button @click="saveTrigger" class="btn-save">💾 Сохранить макрос</button>
          <button @click="deleteTrigger" v-if="!isNew" class="btn-danger">🗑️ Удалить</button>
          <button @click="cancelEdit" class="btn-secondary">Отмена</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getDb } from '../database.js'

const triggers = ref([])
const currentTrigger = ref(null)
const isNew = ref(false)

onMounted(async () => { await loadTriggers() })

async function loadTriggers() {
  try {
    const db = await getDb()
    triggers.value = await db.select('SELECT * FROM Справочник_макросов')
  } catch (error) { console.error(error) }
}

const addNewTrigger = () => { 
  isNew.value = true; 
  currentTrigger.value = { описание: '', условие: '', название_работы: '', формула_работы: '', название_материала: '', ед_изм_материала: '', формула_материала: '' } 
}
const editTrigger = (t) => { isNew.value = false; currentTrigger.value = { ...t } }
const cancelEdit = () => { currentTrigger.value = null }

const saveTrigger = async () => {
  try {
    const db = await getDb()
    if (isNew.value) {
      await db.execute(
        'INSERT INTO Справочник_макросов (описание, условие, название_работы, формула_работы, название_материала, ед_изм_материала, формула_материала) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
        [currentTrigger.value.описание, currentTrigger.value.условие, currentTrigger.value.название_работы, currentTrigger.value.формула_работы, currentTrigger.value.название_материала, currentTrigger.value.ед_изм_материала, currentTrigger.value.формула_материала]
      )
    } else {
      await db.execute(
        'UPDATE Справочник_макросов SET описание=$1, условие=$2, название_работы=$3, формула_работы=$4, название_материала=$5, ед_изм_материала=$6, формула_материала=$7 WHERE идентификатор=$8', 
        [currentTrigger.value.описание, currentTrigger.value.условие, currentTrigger.value.название_работы, currentTrigger.value.формула_работы, currentTrigger.value.название_материала, currentTrigger.value.ед_изм_материала, currentTrigger.value.формула_материала, currentTrigger.value.идентификатор]
      )
    }
    await loadTriggers()
    currentTrigger.value = null
  } catch (error) { console.error(error) }
}

const deleteTrigger = async () => {
  if (!confirm('Удалить макрос?')) return
  try {
    const db = await getDb()
    await db.execute('DELETE FROM Справочник_макросов WHERE идентификатор = $1', [currentTrigger.value.идентификатор])
    await loadTriggers()
    currentTrigger.value = null
  } catch (error) { console.error(error) }
}
</script>

<style scoped>
.triggers-view { padding: 20px; max-width: 1400px; margin: 0 auto; }
.subtitle { color: #666; margin-bottom: 20px; }
.layout { display: flex; gap: 20px; align-items: flex-start; }

.triggers-list { width: 300px; flex-shrink: 0; display: flex; flex-direction: column; }
.triggers-list ul { list-style: none; padding: 0; overflow-y: auto; max-height: calc(100vh - 200px); margin: 0; }
.triggers-list li { padding: 12px; border: 1px solid #e0e0e0; margin-bottom: 8px; cursor: pointer; border-radius: 6px; background: #fff; transition: 0.2s;}
.triggers-list li:hover, .triggers-list li.active { background-color: #e3f2fd; border-color: #90caf9; }
.visual-condition { display: block; color: #d81b60; font-size: 0.85em; margin-top: 5px; }

.trigger-editor { flex: 1; background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #dee2e6; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.editor-title { margin-top: 0; border-bottom: 1px solid #dee2e6; padding-bottom: 10px; margin-bottom: 20px; }

.editor-grid { display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px; }
.card-panel { padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0; }
.condition-panel { background: #fffde7; border-color: #fff59d; }
.work-panel { background: #e3f2fd; border-color: #90caf9; }
.mat-panel { background: #e8f5e9; border-color: #a5d6a7; }
.card-panel h4 { margin-top: 0; margin-bottom: 15px; color: #333; }

.form-group { margin-bottom: 12px; }
.form-row { display: flex; gap: 15px; }
.flex-1 { flex: 1; } .flex-3 { flex: 3; }
.form-group label { display: block; font-weight: bold; margin-bottom: 5px; color: #555; font-size: 0.9rem; }
.form-group input { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 1rem; }
.form-group small { color: #888; font-size: 0.8rem; display: block; margin-top: 4px; }
.code-font { font-family: monospace; font-weight: bold; color: #1976d2; }

.actions { display: flex; gap: 10px; }
.actions button { padding: 10px 20px; cursor: pointer; border: none; color: white; border-radius: 6px; font-weight: bold; transition: 0.2s;}
.actions button:hover { opacity: 0.9; }
.btn-save { background: #198754; } .btn-danger { background: #dc3545; } .btn-secondary { background: #6c757d; }
.btn-add { width: 100%; padding: 12px; margin-bottom: 15px; background: #0d6efd; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
.center { text-align: center; } .empty-msg { color: #999; font-style: italic; }
</style>