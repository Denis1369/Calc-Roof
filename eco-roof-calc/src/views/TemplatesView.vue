<template>
  <div class="templates-view">
    <header class="header">
      <h2>Конструктор систем (Шаблоны кровель)</h2>
      <p class="subtitle">Соберите стандартные кровельные пироги и задайте уникальные переменные.</p>
    </header>

    <div class="layout">
      <div class="templates-list">
        <button @click="addNewTemplate" class="btn-add">+ Создать шаблон</button>
        <ul>
          <li 
            v-for="tmpl in templates" 
            :key="tmpl.идентификатор"
            @click="editTemplate(tmpl)"
            :class="{ active: currentTemplate?.идентификатор === tmpl.идентификатор }"
          >
            <strong>{{ tmpl.название }}</strong>
          </li>
          <li v-if="templates.length === 0" class="empty-msg center">Шаблонов пока нет</li>
        </ul>
      </div>

      <div class="template-editor" v-if="currentTemplate">
        <div class="editor-header">
          <input v-model="currentTemplate.название" class="title-input" placeholder="Название шаблона (Напр: ТН-КРОВЛЯ Смарт)" />
        </div>

        <div class="custom-params-card">
          <h5>Уникальные переменные шаблона (для формул):</h5>
          <p class="text-muted small-text">Стандартные S (Площадь), P (Периметр), ID (Воронки), A (Аэраторы) уже есть.</p>
          
          <div v-for="(cp, idx) in currentTemplate.customParams" :key="idx" class="item-row mt-2">
            <input v-model="cp.name" placeholder="Название (напр: Длина конька)" class="flex-2 item-input" />
            <input v-model="cp.symbol" placeholder="Символ (напр: L)" class="flex-1 item-input center formula-font text-blue" />
            <button @click="currentTemplate.customParams.splice(idx, 1)" class="btn-danger-small">✕</button>
          </div>
          <button @click="currentTemplate.customParams.push({ name: '', symbol: '' })" class="btn-add-inline btn-param mt-2">
            + Добавить переменную
          </button>
        </div>

        <div class="sections-container mt-3">
          <div v-for="(section, sIdx) in currentTemplate.sections" :key="sIdx" class="section-card">
            <div class="section-header">
              <input v-model="section.title" class="section-title-input" placeholder="Название раздела (Напр: 1. Пароизоляция)" />
              <button @click="removeSection(sIdx)" class="btn-icon text-danger" title="Удалить раздел">✕</button>
            </div>

            <div class="items-group">
              <h5>Работы по умолчанию:</h5>
              <div v-for="(work, wIdx) in section.works" :key="'w'+wIdx" class="item-row">
                <input v-model="work.name" list="works-list" placeholder="Название работы..." class="flex-3 item-input" />
                <input v-model="work.unit" placeholder="ед." class="flex-1 item-input center" />
                <input v-model="work.expression" list="formulas-list" placeholder="Формула (Напр: S)" class="flex-2 item-input formula-font center" />
                <button @click="section.works.splice(wIdx, 1)" class="btn-danger-small">✕</button>
              </div>
              <button @click="addWork(section)" class="btn-add-inline btn-work">+ Добавить работу</button>
            </div>

            <div class="items-group mt-3">
              <h5>Материалы по умолчанию:</h5>
              <div v-for="(mat, mIdx) in section.materials" :key="'m'+mIdx" class="item-row">
                <input v-model="mat.name" list="materials-list" placeholder="Название материала..." class="flex-3 item-input" />
                <input v-model="mat.unit" placeholder="ед." class="flex-1 item-input center" />
                <input v-model="mat.expression" list="formulas-list" placeholder="Формула (Напр: S * 1.15)" class="flex-2 item-input formula-font center" />
                <button @click="section.materials.splice(mIdx, 1)" class="btn-danger-small">✕</button>
              </div>
              <button @click="addMaterial(section)" class="btn-add-inline btn-mat">+ Добавить материал</button>
            </div>
          </div>
        </div>

        <div class="add-section-wrap">
          <button @click="addSection" class="btn-outline-dashed">+ Добавить новый раздел в шаблон</button>
        </div>

        <div class="actions">
          <button @click="saveTemplate" class="btn-save">💾 Сохранить шаблон</button>
          <button @click="deleteTemplate" v-if="!isNew" class="btn-danger">🗑️ Удалить</button>
          <button @click="cancelEdit" class="btn-secondary">Отмена</button>
        </div>
      </div>
    </div>

    <datalist id="works-list">
      <option v-for="w in worksDb" :key="w.идентификатор" :value="w.наименование_работы"></option>
    </datalist>
    <datalist id="materials-list">
      <option v-for="m in materialsDb" :key="m.идентификатор" :value="m.полное_наименование_материала"></option>
    </datalist>
    <datalist id="formulas-list">
      <option v-for="f in formulasDb" :key="f.идентификатор" :value="f.название_формулы">{{ f.выражение }}</option>
    </datalist>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getDb } from '../database.js'

const templates = ref([])
const currentTemplate = ref(null)
const isNew = ref(false)

const worksDb = ref([])
const materialsDb = ref([])
const formulasDb = ref([])

onMounted(async () => {
  const db = await getDb()
  worksDb.value = await db.select('SELECT * FROM Справочник_видов_работ')
  materialsDb.value = await db.select('SELECT * FROM Справочник_материалов')
  formulasDb.value = await db.select('SELECT * FROM Справочник_формул')
  await loadTemplates()
})

async function loadTemplates() {
  const db = await getDb()
  templates.value = await db.select('SELECT * FROM Справочник_шаблонов')
}

const addNewTemplate = () => { 
  isNew.value = true; 
  currentTemplate.value = { название: 'Новая кровельная система', sections: [], customParams: [] } 
  addSection();
}

const editTemplate = (tmpl) => { 
  isNew.value = false; 
  try {
    const rawData = tmpl.данные_json || '{}';
    const parsedData = JSON.parse(rawData);
    
    
    let sections = [];
    let customParams = [];
    if (Array.isArray(parsedData)) {
      sections = parsedData;
    } else {
      sections = parsedData.sections || [];
      customParams = parsedData.customParams || [];
    }

    currentTemplate.value = {
      идентификатор: tmpl.идентификатор,
      название: tmpl.название,
      sections: sections,
      customParams: customParams
    };
  } catch (e) {
    currentTemplate.value = { идентификатор: tmpl.идентификатор, название: tmpl.название, sections: [], customParams: [] };
  }
}

const addSection = () => { currentTemplate.value.sections.push({ title: 'Новый этап работ', works: [], materials: [] }); }
const removeSection = (idx) => currentTemplate.value.sections.splice(idx, 1)

const addWork = (section) => section.works.push({ name: '', unit: 'м2', expression: '' })
const addMaterial = (section) => section.materials.push({ name: '', unit: 'шт', expression: '' })

const cancelEdit = () => { currentTemplate.value = null }

const saveTemplate = async () => {
  try {
    const db = await getDb()
    
    const templateData = {
      sections: currentTemplate.value.sections,
      customParams: currentTemplate.value.customParams
    };
    const jsonStr = JSON.stringify(templateData);

    if (isNew.value) {
      await db.execute('INSERT INTO Справочник_шаблонов (название, данные_json) VALUES ($1, $2)', [currentTemplate.value.название, jsonStr])
    } else {
      await db.execute('UPDATE Справочник_шаблонов SET название=$1, данные_json=$2 WHERE идентификатор=$3', [currentTemplate.value.название, jsonStr, currentTemplate.value.идентификатор])
    }
    await loadTemplates()
    currentTemplate.value = null
    alert('Шаблон успешно сохранен!');
  } catch (error) { console.error(error); alert('Ошибка сохранения!'); }
}

const deleteTemplate = async () => {
  if (!confirm('Точно удалить этот шаблон?')) return
  try {
    const db = await getDb()
    await db.execute('DELETE FROM Справочник_шаблонов WHERE идентификатор = $1', [currentTemplate.value.идентификатор])
    await loadTemplates()
    currentTemplate.value = null
  } catch (error) { console.error(error) }
}
</script>
<style scoped>
.templates-view { padding: 20px; max-width: 1400px; margin: 0 auto; font-family: 'Inter', sans-serif; color: #FFFFFF; }
.subtitle { color: #A0B1BA; margin-bottom: 20px; }
.layout { display: flex; gap: 20px; align-items: flex-start; }

.templates-list { width: 320px; flex-shrink: 0; }
.templates-list ul { list-style: none; padding: 0; margin: 0; }
.templates-list li { padding: 12px; border: 1px solid #4A5A63; margin-bottom: 8px; cursor: pointer; border-radius: 6px; background: #21292E; color: #FFFFFF; transition: 0.2s;}
.templates-list li:hover, .templates-list li.active { background-color: rgba(242, 154, 46, 0.1); border-color: #F29A2E; }

.template-editor { flex: 1; background: #37444B; padding: 25px; border-radius: 12px; border: 1px solid #4A5A63; box-shadow: 0 4px 15px rgba(0,0,0,0.15); }
.editor-header { display: flex; gap: 15px; margin-bottom: 20px; }
.title-input { flex: 1; font-size: 1.4rem; font-weight: bold; border: none; border-bottom: 2px solid #4A5A63; background: transparent; outline: none; padding: 5px 0; color: #FFFFFF; }
.title-input:focus { border-color: #F29A2E; }

.custom-params-card { background: #21292E; padding: 15px; border-radius: 8px; border: 1px dashed #F29A2E; }
.custom-params-card h5 { margin: 0 0 5px 0; color: #F29A2E; font-size: 0.9rem;}
.small-text { font-size: 0.8rem; margin-bottom: 10px; color: #A0B1BA; }
.btn-param { background: transparent; border: 1px dashed #F29A2E; color: #F29A2E; cursor: pointer; padding: 5px 10px; border-radius: 4px; transition: 0.2s; }
.btn-param:hover { background: rgba(242, 154, 46, 0.1); }

.sections-container { display: flex; flex-direction: column; gap: 20px; max-height: 55vh; overflow-y: auto; padding-right: 10px; margin-bottom: 20px; }
.section-card { background: #2A3439; padding: 15px; border-radius: 8px; border: 1px solid #4A5A63; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.section-header { display: flex; justify-content: space-between; border-bottom: 1px solid #4A5A63; padding-bottom: 10px; margin-bottom: 15px; }
.section-title-input { font-size: 1.1rem; font-weight: bold; border: none; background: transparent; outline: none; width: 100%; color: #FFFFFF;}

.items-group h5 { margin: 0 0 10px 0; color: #A0B1BA; text-transform: uppercase; font-size: 0.8rem; }
.item-row { display: flex; gap: 10px; margin-bottom: 8px; align-items: center; }
.item-input { padding: 8px; border: 1px solid #4A5A63; border-radius: 4px; font-size: 0.95rem; background: #21292E; color: #FFFFFF; outline: none; transition: 0.2s; }
.item-input:focus { border-color: #F29A2E; }
.flex-1 { flex: 1; } .flex-2 { flex: 2; } .flex-3 { flex: 3; }
.center { text-align: center; }
.formula-font { font-family: 'Fira Code', monospace; font-weight: bold; }
.text-blue { color: #F29A2E; }

.btn-danger-small { background: transparent; color: #ff4d4f; border: 1px solid #ff4d4f; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-weight: bold; transition: 0.2s;}
.btn-danger-small:hover { background: rgba(255, 77, 79, 0.1); }

.btn-add-inline { width: 100%; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9rem; transition: 0.2s;}
.btn-work { background: rgba(242, 154, 46, 0.05); color: #F29A2E; border: 1px dashed #F29A2E; } 
.btn-work:hover { background: rgba(242, 154, 46, 0.1); }
.btn-mat { background: transparent; color: #A0B1BA; border: 1px dashed #A0B1BA; } 
.btn-mat:hover { border-color: #F29A2E; color: #F29A2E; }

.add-section-wrap { margin-top: 15px; }
.btn-outline-dashed { width: 100%; padding: 15px; background: transparent; border: 2px dashed #A0B1BA; color: #A0B1BA; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem; transition: 0.2s; }
.btn-outline-dashed:hover { background: rgba(242, 154, 46, 0.05); border-color: #F29A2E; color: #F29A2E; }

.actions { display: flex; gap: 10px; margin-top: 25px; padding-top: 15px; border-top: 1px solid #4A5A63; }
.actions button { padding: 12px 25px; border-radius: 6px; cursor: pointer; border: none; color: #fff; font-weight: bold; font-size: 1rem; transition: 0.2s;}
.btn-save { background: #F29A2E; } .btn-save:hover { background: #D98826; }
.btn-danger { background: #dc3545; } .btn-secondary { background: #4A5A63; } .btn-secondary:hover { background: #A0B1BA; }
.btn-add { width: 100%; padding: 12px; margin-bottom: 15px; background: #F29A2E; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 1rem; transition: 0.2s; }
.btn-add:hover { background: #D98826; }
.btn-icon { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #A0B1BA; }
.text-danger { color: #ff4d4f; }
.empty-msg { color: #A0B1BA; font-style: italic; }
.mt-2 { margin-top: 10px; } .mt-3 { margin-top: 15px; }

::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #21292E; }
::-webkit-scrollbar-thumb { background: #4A5A63; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #F29A2E; }
</style>