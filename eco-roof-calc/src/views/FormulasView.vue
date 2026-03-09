<template>
  <div class="formulas-view">
    <h2>Справочник формул расчета</h2>
    
    <div class="layout">
      <div class="formulas-list">
        <button @click="addNewFormula" class="btn-add">+ Добавить формулу</button>
        <input 
          v-model="searchFormulaQuery" 
          placeholder="🔍 Поиск по формулам..." 
          class="search-input mb-3" 
        />
        <ul>
          <li 
            v-for="formula in filteredFormulas" 
            :key="formula.идентификатор"
            @click="editFormula(formula)"
            :class="{ active: currentFormula?.идентификатор === formula.идентификатор }"
          >
            <strong>{{ formula.название_формулы }}</strong>
            <code class="visual-formula">{{ formula.выражение }}</code>
          </li>
          <li v-if="filteredFormulas.length === 0" class="empty-msg center">Формулы не найдены</li>
        </ul>
      </div>

      <div class="variables-column" v-if="currentFormula">
        <div class="variables-panel">
          <h3>Кликните для добавления:</h3>
          
          <p class="section-label">Базовые параметры крыши:</p>
          <div class="tags-group-base">
            <span class="tag-base" @click="insertToFormula('S')">S (Площадь)</span>
            <span class="tag-base" @click="insertToFormula('P')">P (Периметр)</span>
            <span class="tag-base" @click="insertToFormula('A')">A (Аэраторы)</span>
            <span class="tag-base" @click="insertToFormula('ID')">ID (Воронки)</span>
          </div>

          <p class="section-label mt-3">Коэффициенты из базы:</p>
          <input 
            v-model="searchCoefQuery" 
            placeholder="🔍 Поиск (напр: ПВХ, Фасад)..." 
            class="search-input mb-2" 
          />
          
          <div class="custom-tags-scroll">
            <span 
              v-for="coef in filteredCoefficients" 
              :key="coef.идентификатор" 
              class="tag-custom" 
              @click="insertToFormula(`[${coef.название}]`)"
              :title="`Текущее значение: ${coef.значение}`"
            >
              <span class="coef-category" v-if="coef.заголовок">{{ coef.заголовок }}</span>
              {{ coef.название }}
            </span>
            <span v-if="filteredCoefficients.length === 0" class="empty-msg center">Коэффициенты не найдены</span>
          </div>
        </div>
      </div>

      <div class="formula-editor" v-if="currentFormula">
        <h3 class="editor-title">{{ isNew ? 'Новая формула' : 'Редактирование формулы' }}</h3>
        
        <div class="form-group">
          <label>Название формулы (отображается в смете):</label>
          <input v-model="currentFormula.название_формулы" placeholder="Например: ПВХ мембрана с нахлестом" />
        </div>
        
        <div class="form-group">
          <label>Математическое выражение:</label>
          <textarea 
            v-model="currentFormula.выражение" 
            placeholder="Выберите переменные из колонки слева или введите вручную" 
            class="expression-input"
            rows="4"
          ></textarea>
        </div>

        <div class="tester-block mt-3">
          <h4>Тестовый расчет (проверка формулы)</h4>
          <div class="test-inputs">
            <label>S (м2): <input type="number" v-model="testData.S" /></label>
            <label>P (м.п): <input type="number" v-model="testData.P" /></label>
          </div>
          <div class="test-result">
            Результат: <strong>{{ testResult }}</strong>
          </div>
        </div>

        <div class="actions">
          <button @click="saveFormula" class="btn-save">💾 Сохранить</button>
          <button @click="deleteFormula" v-if="!isNew" class="btn-danger">🗑️ Удалить</button>
          <button @click="cancelEdit" class="btn-secondary">Отмена</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { evaluate } from 'mathjs'
import { getDb } from '../database.js'

const formulas = ref([])
const coefficients = ref([])
const currentFormula = ref(null)
const isNew = ref(false)

const testData = ref({ S: 100, P: 40, A: 2, ID: 1 })


const searchFormulaQuery = ref('')
const searchCoefQuery = ref('')

onMounted(async () => {
  await loadFormulas()
  await loadCoefficients()
})

async function loadFormulas() {
  try {
    const db = await getDb()
    formulas.value = await db.select('SELECT * FROM Справочник_формул ORDER BY название_формулы')
  } catch (error) { console.error(error) }
}

async function loadCoefficients() {
  try {
    const db = await getDb()
    coefficients.value = await db.select('SELECT * FROM Справочник_коэффициентов ORDER BY заголовок, название')
  } catch (error) { console.error(error) }
}


const filteredFormulas = computed(() => {
  if (!searchFormulaQuery.value) return formulas.value
  const q = searchFormulaQuery.value.toLowerCase()
  return formulas.value.filter(f => f.название_формулы.toLowerCase().includes(q))
})


const filteredCoefficients = computed(() => {
  if (!searchCoefQuery.value) return coefficients.value
  const q = searchCoefQuery.value.toLowerCase()
  return coefficients.value.filter(c => 
    (c.название && c.название.toLowerCase().includes(q)) || 
    (c.заголовок && c.заголовок.toLowerCase().includes(q))
  )
})

const insertToFormula = (text) => {
  if (!currentFormula.value.выражение) {
    currentFormula.value.выражение = text
  } else {
    currentFormula.value.выражение += ` * ${text}`
  }
}

const testResult = computed(() => {
  if (!currentFormula.value || !currentFormula.value.выражение) return 0
  
  try {
    let expr = currentFormula.value.выражение
    expr = expr.replace(/\[(.*?)\]/g, (match, paramName) => {
      const coef = coefficients.value.find(c => c.название === paramName.trim())
      return coef ? coef.значение : 1
    })

    const result = evaluate(expr, testData.value)
    return Number(result.toFixed(3)) 
  } catch (error) {
    return 'Ошибка синтаксиса'
  }
})

const addNewFormula = () => { isNew.value = true; currentFormula.value = { название_формулы: '', выражение: '' } }
const editFormula = (formula) => { isNew.value = false; currentFormula.value = { ...formula } }
const cancelEdit = () => { currentFormula.value = null }

const saveFormula = async () => {
  try {
    const db = await getDb()
    if (isNew.value) {
      await db.execute('INSERT INTO Справочник_формул (название_формулы, выражение) VALUES ($1, $2)', [currentFormula.value.название_формулы, currentFormula.value.выражение])
    } else {
      await db.execute('UPDATE Справочник_формул SET название_формулы = $1, выражение = $2 WHERE идентификатор = $3', [currentFormula.value.название_формулы, currentFormula.value.выражение, currentFormula.value.идентификатор])
    }
    await loadFormulas()
    currentFormula.value = null
  } catch (error) { console.error(error) }
}

const deleteFormula = async () => {
  if (!confirm('Точно удалить?')) return
  try {
    const db = await getDb()
    await db.execute('DELETE FROM Справочник_формул WHERE идентификатор = $1', [currentFormula.value.идентификатор])
    await loadFormulas()
    currentFormula.value = null
  } catch (error) { console.error(error) }
}
</script>

<style scoped>
.layout { display: flex; gap: 20px; margin-top: 20px; align-items: flex-start; }


.formulas-list { width: 300px; flex-shrink: 0; display: flex; flex-direction: column; }
.formulas-list ul { list-style: none; padding: 0; overflow-y: auto; max-height: calc(100vh - 200px); margin: 0; }
.formulas-list li { padding: 12px; border: 1px solid #e0e0e0; margin-bottom: 8px; cursor: pointer; border-radius: 6px; background: #fff; }
.formulas-list li:hover, .formulas-list li.active { background-color: #e3f2fd; border-color: #90caf9; }
.visual-formula { display: block; color: #1976d2; font-size: 0.85em; margin-top: 5px; font-weight: bold; }


.variables-column { width: 400px; flex-shrink: 0; }
.variables-panel { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.variables-panel h3 { margin-top: 0; font-size: 1.1rem; border-bottom: 1px solid #dee2e6; padding-bottom: 10px; margin-bottom: 15px; color: #343a40; }
.section-label { margin: 0 0 8px 0; font-size: 0.9rem; color: #495057; font-weight: bold; }

.tags-group-base { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px; }
.tag-base { padding: 8px; background: #e0f7fa; color: #006064; border: 1px solid #b2ebf2; border-radius: 4px; cursor: pointer; text-align: center; font-size: 0.85rem; font-weight: bold; transition: 0.2s; }
.tag-base:hover { background: #b2ebf2; }


.custom-tags-scroll { max-height: 55vh; overflow-y: auto; padding-right: 5px; display: flex; flex-direction: column; gap: 6px; }
.tag-custom { padding: 10px 12px; background: #fff; border: 1px solid #ced4da; border-radius: 6px; font-size: 0.85rem; cursor: pointer; transition: 0.2s; text-align: left; line-height: 1.4; color: #212529; }
.tag-custom:hover { border-color: #d81b60; background: #fce4ec; }
.coef-category { display: block; font-size: 0.75rem; color: #880e4f; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; }


.formula-editor { flex: 1; background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #dee2e6; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.editor-title { margin-top: 0; border-bottom: 1px solid #dee2e6; padding-bottom: 10px; margin-bottom: 20px; }


.search-input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #ced4da; border-radius: 6px; font-size: 0.95rem; outline: none; }
.search-input:focus { border-color: #2196F3; box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2); }
.form-group { margin-bottom: 20px; }
.form-group label { display: block; font-weight: bold; margin-bottom: 8px; color: #495057; }
.form-group input, .form-group textarea { width: 100%; box-sizing: border-box; padding: 12px; border: 1px solid #ced4da; border-radius: 6px; font-size: 1rem; outline: none; }
.form-group input:focus, .form-group textarea:focus { border-color: #2196F3; }
.expression-input { font-family: monospace; font-size: 1.2rem !important; color: #d81b60; font-weight: bold; resize: vertical; line-height: 1.5; }


.tester-block { background: #f1f8e9; padding: 15px; border-radius: 8px; border: 1px solid #c5e1a5; margin-bottom: 20px; }
.tester-block h4 { margin-top: 0; color: #2e7d32; }
.test-inputs { display: flex; gap: 15px; margin-bottom: 10px; }
.test-inputs input { width: 80px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; }
.test-result { font-size: 1.2em; color: #2e7d32; margin-top: 10px; }


.actions { display: flex; gap: 10px; }
.actions button { padding: 10px 20px; cursor: pointer; border: none; color: white; border-radius: 6px; font-weight: bold; font-size: 0.95rem; transition: 0.2s;}
.actions button:hover { opacity: 0.9; }
.btn-save { background: #198754; }
.btn-danger { background: #dc3545; }
.btn-secondary { background: #6c757d; }
.btn-add { width: 100%; padding: 12px; margin-bottom: 15px; background: #0d6efd; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 1rem; }

.mb-3 { margin-bottom: 1rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mt-3 { margin-top: 1.5rem; }
.center { text-align: center; }
.empty-msg { font-size: 0.9rem; color: #999; font-style: italic; display: block; padding: 10px 0; }
</style>