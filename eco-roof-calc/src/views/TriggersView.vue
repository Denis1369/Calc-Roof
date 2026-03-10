<template>
  <div class="triggers-view">
    <h2>Управление Макросами (Авто-триггеры)</h2>
    <p class="subtitle">Настройте правила, по которым программа будет сама подбирать названия и добавлять список материалов.</p>
    
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
              <input v-model="currentTrigger.описание" placeholder="Например: Комплект пароизоляции" />
            </div>
            <div class="form-group">
              <label>Ключевые слова (через запятую):</label>
              <input v-model="currentTrigger.условие" placeholder="Напр: пароизоляцион, пленк" />
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
            <h4>3. Список материалов (добавятся автоматически)</h4>
            
            <div v-for="(m, idx) in currentTrigger.materials" :key="idx" class="mat-item-row">
              <div class="mat-inputs">
                <input v-model="m.название_материала" placeholder="Название (из справочника)" class="flex-3" />
                <input v-model="m.ед_изм_материала" placeholder="ед" class="flex-0-5 center" />
                <input v-model="m.формула_материала" placeholder="Формула (напр: [WORK_CODE]*1.1)" class="flex-3 code-font" />
              </div>
              <button @click="currentTrigger.materials.splice(idx, 1)" class="btn-danger-small" title="Удалить материал">✕</button>
            </div>

            <button @click="addMaterialRow" class="btn-add-inline">
              + Добавить еще один материал в этот макрос
            </button>
          </div>
        </div>

        <div class="actions">
          <button @click="saveTrigger" class="btn-save">💾 Сохранить всё</button>
          <button @click="deleteTrigger" v-if="!isNew" class="btn-danger">🗑️ Удалить макрос</button>
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
  currentTrigger.value = { 
    описание: '', 
    условие: '', 
    название_работы: '', 
    формула_работы: '',
    materials: [] 
  } 
  addMaterialRow(); 
}


const editTrigger = async (trigger) => {
  isNew.value = false;
  const db = await getDb();
  
  const mats = await db.select('SELECT * FROM Материалы_макроса WHERE идентификатор_макроса = $1', [trigger.идентификатор]);
  currentTrigger.value = { ...trigger, materials: mats || [] };
}

const addMaterialRow = () => {
  if (!currentTrigger.value.materials) currentTrigger.value.materials = [];
  currentTrigger.value.materials.push({ название_материала: '', ед_изм_материала: '', формула_материала: '' });
}

const cancelEdit = () => { currentTrigger.value = null }

const saveTrigger = async () => {
  try {
    const db = await getDb()
    let macroId = currentTrigger.value.идентификатор;

    
    if (isNew.value) {
      const res = await db.execute(
        'INSERT INTO Справочник_макросов (описание, условие, название_работы, формула_работы) VALUES ($1, $2, $3, $4)', 
        [currentTrigger.value.описание, currentTrigger.value.условие, currentTrigger.value.название_работы, currentTrigger.value.формула_работы]
      )
      macroId = res.lastInsertId; 
    } else {
      await db.execute(
        'UPDATE Справочник_макросов SET описание=$1, условие=$2, название_работы=$3, формула_работы=$4 WHERE идентификатор=$5', 
        [currentTrigger.value.описание, currentTrigger.value.условие, currentTrigger.value.название_работы, currentTrigger.value.формула_работы, macroId]
      )
    }

    
    await db.execute('DELETE FROM Материалы_макроса WHERE идентификатор_макроса = $1', [macroId]);
    
    for (const mat of currentTrigger.value.materials) {
      if (!mat.название_материала) continue; 
      await db.execute(
        'INSERT INTO Материалы_макроса (идентификатор_макроса, название_материала, ед_изм_материала, формула_материала) VALUES ($1, $2, $3, $4)',
        [macroId, mat.название_материала, mat.ед_изм_материала, mat.формула_материала]
      );
    }

    await loadTriggers()
    currentTrigger.value = null
    alert('Макрос успешно сохранен!');
  } catch (error) { 
    console.error(error); 
    alert('Ошибка при сохранении. Убедитесь, что таблица Материалы_макроса создана в database.js');
  }
}

const deleteTrigger = async () => {
  if (!confirm('Удалить макрос и все его материалы?')) return
  try {
    const db = await getDb()
    
    await db.execute('DELETE FROM Материалы_макроса WHERE идентификатор_макроса = $1', [currentTrigger.value.идентификатор])
    await db.execute('DELETE FROM Справочник_макросов WHERE идентификатор = $1', [currentTrigger.value.идентификатор])
    await loadTriggers()
    currentTrigger.value = null
  } catch (error) { console.error(error) }
}
</script>

<style scoped>

.mat-item-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  padding: 8px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin-bottom: 8px;
}
.mat-inputs {
  display: flex;
  flex: 1;
  gap: 8px;
}
.flex-0-5 { flex: 0.5; }
.flex-1 { flex: 1; }
.flex-3 { flex: 3; }
.btn-danger-small {
  background: #fee2e2;
  color: #dc2626;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
}
.btn-add-inline {
  width: 100%;
  padding: 8px;
  background: #f0fdf4;
  color: #16a34a;
  border: 1px dashed #16a34a;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  margin-top: 10px;
}


.triggers-view { padding: 20px; max-width: 1400px; margin: 0 auto; }
.subtitle { color: #666; margin-bottom: 20px; }
.layout { display: flex; gap: 20px; align-items: flex-start; }
.triggers-list { width: 300px; flex-shrink: 0; }
.triggers-list ul { list-style: none; padding: 0; }
.triggers-list li { padding: 12px; border: 1px solid #e0e0e0; margin-bottom: 8px; cursor: pointer; border-radius: 6px; background: #fff; }
.triggers-list li.active { border-color: #3b82f6; background: #eff6ff; }
.visual-condition { display: block; color: #d81b60; font-size: 0.85em; margin-top: 5px; }
.trigger-editor { flex: 1; background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #dee2e6; }
.card-panel { padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0; margin-bottom: 15px; }
.condition-panel { background: #fffde7; }
.work-panel { background: #e3f2fd; }
.mat-panel { background: #e8f5e9; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-weight: bold; margin-bottom: 5px; font-size: 0.9rem; }
.form-group input { width: 100%; padding: 10px; border: 1px solid #ced4da; border-radius: 4px; box-sizing: border-box; }
.code-font { font-family: monospace; font-weight: bold; color: #1976d2; }
.actions { display: flex; gap: 10px; margin-top: 20px; }
.actions button { padding: 10px 20px; border-radius: 6px; cursor: pointer; border: none; color: #fff; font-weight: bold; }
.btn-save { background: #16a34a; }
.btn-danger { background: #dc2626; }
.btn-secondary { background: #6b7280; }
.btn-add { width: 100%; padding: 12px; margin-bottom: 15px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
.center { text-align: center; }
</style>