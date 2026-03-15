<template>
  <div class="formulas-view">
    <div class="page-header">
      <h2 class="ui-title">Справочник формул расчета</h2>
    </div>

    <div class="layout">
      <div class="formulas-list">
        <button @click="addNewFormula" class="ui-btn ui-btn-primary add-btn">+ Добавить формулу</button>
        <input
          v-model="searchFormulaQuery"
          placeholder="🔍 Поиск по формулам..."
          class="ui-input mb-3"
        />
        <ul class="formula-items">
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
        <div class="variables-panel page-card">
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
            class="ui-input mb-2"
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

      <div class="formula-editor page-card" v-if="currentFormula">
        <h3 class="editor-title">{{ isNew ? 'Новая формула' : 'Редактирование формулы' }}</h3>

        <div class="form-group">
          <label class="ui-label">Название формулы (отображается в смете):</label>
          <input v-model="currentFormula.название_формулы" class="ui-input" placeholder="Например: ПВХ мембрана с нахлестом" />
        </div>

        <div class="form-group">
          <label class="ui-label">Математическое выражение:</label>
          <textarea
            v-model="currentFormula.выражение"
            placeholder="Выберите переменные из колонки слева или введите вручную"
            class="ui-textarea expression-input"
            rows="4"
          ></textarea>
        </div>

        <div class="tester-block mt-3">
          <h4>Тестовый расчет</h4>
          <div class="test-inputs">
            <label>S (м2): <input type="number" v-model="testData.S" class="ui-input mini-input" /></label>
            <label>P (м.п): <input type="number" v-model="testData.P" class="ui-input mini-input" /></label>
          </div>
          <div class="test-result">
            Результат: <strong>{{ testResult }}</strong>
          </div>
        </div>

        <div class="actions">
          <button @click="saveFormula" class="ui-btn ui-btn-success">Сохранить</button>
          <button @click="deleteFormula" v-if="!isNew" class="ui-btn ui-btn-danger">Удалить</button>
          <button @click="cancelEdit" class="ui-btn ui-btn-secondary">Отмена</button>
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
  } catch (error) {
    console.error(error)
  }
}

async function loadCoefficients() {
  try {
    const db = await getDb()
    coefficients.value = await db.select('SELECT * FROM Справочник_коэффициентов ORDER BY заголовок, название')
  } catch (error) {
    console.error(error)
  }
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

const insertToFormula = text => {
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

const addNewFormula = () => {
  isNew.value = true
  currentFormula.value = { название_формулы: '', выражение: '' }
}

const editFormula = formula => {
  isNew.value = false
  currentFormula.value = { ...formula }
}

const cancelEdit = () => {
  currentFormula.value = null
}

const saveFormula = async () => {
  try {
    const db = await getDb()
    if (isNew.value) {
      await db.execute(
        'INSERT INTO Справочник_формул (название_формулы, выражение) VALUES ($1, $2)',
        [currentFormula.value.название_формулы, currentFormula.value.выражение]
      )
    } else {
      await db.execute(
        'UPDATE Справочник_формул SET название_формулы = $1, выражение = $2 WHERE идентификатор = $3',
        [currentFormula.value.название_формулы, currentFormula.value.выражение, currentFormula.value.идентификатор]
      )
    }
    await loadFormulas()
    currentFormula.value = null
  } catch (error) {
    console.error(error)
  }
}

const deleteFormula = async () => {
  if (!confirm('Точно удалить?')) return
  try {
    const db = await getDb()
    await db.execute('DELETE FROM Справочник_формул WHERE идентификатор = $1', [currentFormula.value.идентификатор])
    await loadFormulas()
    currentFormula.value = null
  } catch (error) {
    console.error(error)
  }
}
</script>

<style scoped>
.formulas-view {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.formulas-list {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.add-btn {
  width: 100%;
  margin-bottom: 15px;
}

.formula-items {
  list-style: none;
  padding: 0;
  overflow-y: auto;
  max-height: calc(100vh - 220px);
  margin: 0;
}

.formula-items li {
  padding: 12px;
  border: 1px solid var(--border-color);
  margin-bottom: 8px;
  cursor: pointer;
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-main);
  transition: background var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
}

.formula-items li:hover,
.formula-items li.active {
  background: var(--bg-active);
  border-color: var(--accent);
}

.visual-formula {
  display: block;
  color: var(--text-soft);
  font-size: 0.85em;
  margin-top: 5px;
  font-weight: 700;
  word-break: break-word;
}

.variables-column {
  width: 400px;
  flex-shrink: 0;
}

.variables-panel {
  padding: 15px;
}

.variables-panel h3 {
  margin-top: 0;
  font-size: 1.1rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 10px;
  margin-bottom: 15px;
  color: var(--text-main);
}

.section-label {
  margin: 0 0 8px 0;
  font-size: 0.9rem;
  color: var(--text-soft);
  font-weight: 700;
}

.tags-group-base {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 15px;
}

.tag-base {
  padding: 8px;
  background: var(--bg-card-soft);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 700;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.tag-base:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}

.custom-tags-scroll {
  max-height: 55vh;
  overflow-y: auto;
  padding-right: 5px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tag-custom {
  padding: 10px 12px;
  background: var(--bg-card-soft);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
  text-align: left;
  line-height: 1.4;
  color: var(--text-main);
}

.tag-custom:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
}

.coef-category {
  display: block;
  font-size: 0.75rem;
  color: var(--accent);
  font-weight: 700;
  margin-bottom: 2px;
  text-transform: uppercase;
}

.formula-editor {
  flex: 1;
  padding: 20px;
  color: var(--text-main);
}

.editor-title {
  margin-top: 0;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 10px;
  margin-bottom: 20px;
  color: var(--text-main);
}

.form-group {
  margin-bottom: 20px;
}

.expression-input {
  font-family: 'Fira Code', monospace;
  font-size: 1.05rem;
  color: var(--accent);
  font-weight: 700;
  resize: vertical;
  line-height: 1.5;
}

.tester-block {
  background: var(--bg-card-soft);
  padding: 15px;
  border-radius: 12px;
  border: 1px solid var(--accent);
  margin-bottom: 20px;
}

.tester-block h4 {
  margin-top: 0;
  color: var(--accent);
  margin-bottom: 12px;
}

.test-inputs {
  display: flex;
  gap: 15px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.test-inputs label {
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 8px;
}

.mini-input {
  width: 90px;
}

.test-result {
  font-size: 1.1em;
  color: var(--accent);
  margin-top: 10px;
  font-weight: 700;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.mb-3 {
  margin-bottom: 1rem;
}

.mb-2 {
  margin-bottom: 0.5rem;
}

.mt-3 {
  margin-top: 1.5rem;
}

.center {
  text-align: center;
}

.empty-msg {
  font-size: 0.9rem;
  color: var(--text-soft);
  font-style: italic;
  display: block;
  padding: 10px 0;
}

@media (max-width: 1200px) {
  .layout {
    flex-direction: column;
  }

  .formulas-list,
  .variables-column,
  .formula-editor {
    width: 100%;
  }

  .formula-items {
    max-height: 320px;
  }
}

@media (max-width: 700px) {
  .formulas-view {
    padding: 16px;
  }

  .tags-group-base {
    grid-template-columns: 1fr;
  }

  .test-inputs {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>