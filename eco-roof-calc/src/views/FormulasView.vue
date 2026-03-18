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
            <span class="tag-base" @click="insertToFormula('OD')">OD (Парапетные воронки)</span>
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
          <label class="ui-label">Код формулы:</label>
          <input v-model="currentFormula.код" class="ui-input" placeholder="Например: PVC_AREA" />
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
            <label>A: <input type="number" v-model="testData.A" class="ui-input mini-input" /></label>
            <label>ID: <input type="number" v-model="testData.ID" class="ui-input mini-input" /></label>
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
import { getDb } from '../infrastructure/db/client'
import { normalizeKey } from '../shared/utils/normalizeKey'

const formulas = ref([])
const coefficients = ref([])
const currentFormula = ref(null)
const isNew = ref(false)

const testData = ref({ S: 100, P: 40, A: 2, ID: 1, OD: 1 })

const searchFormulaQuery = ref('')
const searchCoefQuery = ref('')

onMounted(async () => {
  await ensureTables()
  await loadFormulas()
  await loadCoefficients()
})

async function ensureTables() {
  const db = await getDb()
  await db.execute(`
    CREATE TABLE IF NOT EXISTS formulas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      expression TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS coefficients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      normalize_key TEXT NOT NULL UNIQUE,
      group_name TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

async function loadFormulas() {
  try {
    const db = await getDb()
    const rows = await db.select(`
      SELECT id, code, name, expression, description
      FROM formulas
      ORDER BY name, code, id
    `)

    formulas.value = rows.map((row) => ({
      идентификатор: row.id,
      код: row.code,
      название_формулы: row.name,
      выражение: row.expression,
      описание: row.description || ''
    }))
  } catch (error) {
    console.error(error)
  }
}

async function loadCoefficients() {
  try {
    const db = await getDb()
    const rows = await db.select(`
      SELECT id, group_name, name, value
      FROM coefficients
      ORDER BY group_name, name, id
    `)

    coefficients.value = rows.map((row) => ({
      идентификатор: row.id,
      заголовок: row.group_name || '',
      название: row.name || '',
      значение: Number(row.value ?? 0)
    }))
  } catch (error) {
    console.error(error)
  }
}

const filteredFormulas = computed(() => {
  if (!searchFormulaQuery.value) return formulas.value
  const q = searchFormulaQuery.value.toLowerCase()
  return formulas.value.filter((f) =>
    (f.название_формулы || '').toLowerCase().includes(q) ||
    (f.код || '').toLowerCase().includes(q)
  )
})

const filteredCoefficients = computed(() => {
  if (!searchCoefQuery.value) return coefficients.value
  const q = searchCoefQuery.value.toLowerCase()
  return coefficients.value.filter((c) =>
    (c.название && c.название.toLowerCase().includes(q)) ||
    (c.заголовок && c.заголовок.toLowerCase().includes(q))
  )
})

function insertToFormula(text) {
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
      const coef = coefficients.value.find((c) => c.название === paramName.trim())
      return coef ? coef.значение : 1
    })

    const result = evaluate(expr, testData.value)
    return Number(Number(result || 0).toFixed(3))
  } catch {
    return 'Ошибка синтаксиса'
  }
})

function addNewFormula() {
  isNew.value = true
  currentFormula.value = { название_формулы: '', код: '', выражение: '', описание: '' }
}

function editFormula(formula) {
  isNew.value = false
  currentFormula.value = { ...formula }
}

function cancelEdit() {
  currentFormula.value = null
}

function buildFormulaCode() {
  if (!currentFormula.value?.код?.trim()) {
    return normalizeKey(currentFormula.value?.название_формулы || `formula_${Date.now()}`)
      .replace(/_/g, '_')
      .toUpperCase()
  }

  return normalizeKey(currentFormula.value.код).replace(/_/g, '_').toUpperCase()
}

async function saveFormula() {
  if (!currentFormula.value?.название_формулы?.trim()) {
    window.alert('Заполните название формулы')
    return
  }

  if (!currentFormula.value?.выражение?.trim()) {
    window.alert('Заполните выражение формулы')
    return
  }

  try {
    const db = await getDb()
    const code = buildFormulaCode()

    if (isNew.value) {
      await db.execute(
        `INSERT INTO formulas (code, name, expression, description)
         VALUES ($1, $2, $3, $4)`,
        [code, currentFormula.value.название_формулы.trim(), currentFormula.value.выражение.trim(), currentFormula.value.описание || '']
      )
    } else {
      await db.execute(
        `UPDATE formulas
         SET code = $1,
             name = $2,
             expression = $3,
             description = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [
          code,
          currentFormula.value.название_формулы.trim(),
          currentFormula.value.выражение.trim(),
          currentFormula.value.описание || '',
          currentFormula.value.идентификатор
        ]
      )
    }

    await loadFormulas()
    currentFormula.value = null
  } catch (error) {
    console.error(error)
    window.alert('Ошибка при сохранении формулы')
  }
}

async function deleteFormula() {
  if (!currentFormula.value?.идентификатор) return
  if (!window.confirm('Точно удалить?')) return

  try {
    const db = await getDb()
    await db.execute('DELETE FROM formulas WHERE id = $1', [currentFormula.value.идентификатор])
    await loadFormulas()
    currentFormula.value = null
  } catch (error) {
    console.error(error)
    window.alert('Ошибка при удалении формулы')
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
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-card);
}

.formula-items li {
  padding: 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
}

.formula-items li:last-child {
  border-bottom: none;
}

.formula-items li.active {
  background: var(--accent-soft);
}

.visual-formula {
  display: block;
  margin-top: 6px;
  color: var(--text-soft);
  white-space: pre-wrap;
}

.variables-column {
  width: 320px;
  flex-shrink: 0;
}

.variables-panel,
.formula-editor {
  padding: 18px;
}

.custom-tags-scroll {
  max-height: 420px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tags-group-base {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-base,
.tag-custom {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid var(--border-color);
  background: var(--bg-card-soft);
}

.tag-base:hover,
.tag-custom:hover {
  background: var(--bg-hover);
}

.coef-category {
  color: var(--accent);
  font-weight: 700;
}

.section-label {
  color: var(--text-soft);
  font-weight: 700;
  margin: 14px 0 10px;
}

.mt-3 {
  margin-top: 18px;
}

.mb-2 {
  margin-bottom: 10px;
}

.mb-3 {
  margin-bottom: 14px;
}

.form-group {
  margin-bottom: 14px;
}

.expression-input {
  width: 100%;
  min-height: 120px;
}

.tester-block {
  padding: 14px;
  border-radius: 12px;
  background: var(--bg-card-soft);
}

.test-inputs {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin: 10px 0;
}

.mini-input {
  width: 90px;
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 18px;
  flex-wrap: wrap;
}

.center {
  text-align: center;
}

.empty-msg {
  color: var(--text-soft);
  padding: 14px;
}

@media (max-width: 1200px) {
  .layout {
    flex-direction: column;
  }

  .formulas-list,
  .variables-column {
    width: 100%;
  }
}
</style>
