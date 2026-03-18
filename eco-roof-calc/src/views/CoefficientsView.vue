<template>
  <div class="coefficients-view">
    <div class="page-header">
      <h2 class="ui-title">Справочник коэффициентов и норм расхода</h2>
      <p class="subtitle">Эти значения можно будет выбирать прямо по названию при создании формул.</p>
    </div>

    <div class="table-container page-card">
      <div class="toolbar">
        <button @click="addCoefficient" class="ui-btn ui-btn-primary">+ Добавить коэффициент</button>
        <input
          v-model="searchQuery"
          placeholder="🔍 Поиск по категории или названию..."
          class="ui-input search-input"
        />
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-category">Категория</th>
              <th>Понятное название (для поиска в формулах)</th>
              <th class="col-value">Значение</th>
              <th class="col-actions">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="coef in filteredCoefficients" :key="coef.идентификатор || coef.tempId">
              <td>
                <input v-model="coef.заголовок" placeholder="Напр: Кровля" class="cell-input bold accent-text" />
              </td>
              <td>
                <input v-model="coef.название" placeholder="Напр: Запас на перехлесты ПВХ" class="cell-input" />
              </td>
              <td>
                <input type="number" v-model.number="coef.значение" step="0.001" class="cell-input center bold" />
              </td>
              <td class="center">
                <button @click="saveCoefficient(coef)" class="btn-icon" title="Сохранить">💾</button>
                <button @click="deleteCoefficient(coef)" class="btn-icon danger-text" title="Удалить">🗑️</button>
              </td>
            </tr>
            <tr v-if="filteredCoefficients.length === 0">
              <td colspan="4" class="center text-muted empty-cell">Ничего не найдено</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getDb } from '../infrastructure/db/client'
import { normalizeKey } from '../shared/utils/normalizeKey'

const coefficients = ref([])
const searchQuery = ref('')

onMounted(async () => {
  await ensureTable()
  await loadCoefficients()
})

async function ensureTable() {
  const db = await getDb()
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
    console.error('Ошибка загрузки коэффициентов:', error)
  }
}

const filteredCoefficients = computed(() => {
  if (!searchQuery.value) return coefficients.value
  const q = searchQuery.value.toLowerCase()
  return coefficients.value.filter((c) =>
    (c.название && c.название.toLowerCase().includes(q)) ||
    (c.заголовок && c.заголовок.toLowerCase().includes(q))
  )
})

function addCoefficient() {
  coefficients.value.unshift({
    tempId: Date.now(),
    заголовок: '',
    название: '',
    значение: 1
  })
  searchQuery.value = ''
}

async function saveCoefficient(coef) {
  if (!coef.название?.trim()) {
    window.alert('Заполните название коэффициента')
    return
  }

  try {
    const db = await getDb()
    const keyBase = coef.название?.trim() || `coef_${Date.now()}`
    const normalize = normalizeKey(`${coef.заголовок || ''}_${keyBase}`)

    if (coef.идентификатор) {
      await db.execute(
        `UPDATE coefficients
         SET normalize_key = $1,
             group_name = $2,
             name = $3,
             value = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [normalize, coef.заголовок || '', coef.название.trim(), Number(coef.значение || 0), coef.идентификатор]
      )
    } else {
      await db.execute(
        `INSERT INTO coefficients (normalize_key, group_name, name, value)
         VALUES ($1, $2, $3, $4)`,
        [normalize, coef.заголовок || '', coef.название.trim(), Number(coef.значение || 0)]
      )
    }

    await loadCoefficients()
  } catch (error) {
    console.error('Ошибка сохранения:', error)
    window.alert('Ошибка при сохранении коэффициента')
  }
}

async function deleteCoefficient(coef) {
  const confirmed = window.confirm('Удалить коэффициент?')
  if (!confirmed) return

  if (!coef.идентификатор) {
    coefficients.value = coefficients.value.filter((c) => c.tempId !== coef.tempId)
    return
  }

  try {
    const db = await getDb()
    await db.execute('DELETE FROM coefficients WHERE id = $1', [coef.идентификатор])
    await loadCoefficients()
  } catch (error) {
    console.error('Ошибка удаления:', error)
    window.alert('Ошибка при удалении коэффициента')
  }
}
</script>

<style scoped>
.coefficients-view {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.subtitle {
  color: var(--text-soft);
  margin: 10px 0 0;
}

.table-container {
  padding: 20px;
}

.toolbar {
  display: flex;
  gap: 15px;
  margin-bottom: 16px;
  align-items: center;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 260px;
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
}

.data-table th,
.data-table td {
  border: 1px solid var(--border-color);
  padding: 8px;
  text-align: left;
  color: var(--text-main);
}

.data-table th {
  background: var(--bg-card-soft);
  color: var(--text-soft);
  font-size: 0.85rem;
  border-bottom: 2px solid var(--accent);
}

.cell-input {
  width: 100%;
  border: none;
  padding: 8px;
  outline: none;
  background: transparent;
  font-size: 1rem;
  color: var(--text-main);
  transition: background var(--transition-fast), box-shadow var(--transition-fast);
  box-sizing: border-box;
}

.cell-input:focus {
  background: var(--bg-hover);
  border-radius: 6px;
  box-shadow: inset 0 0 0 2px var(--accent);
}

.bold {
  font-weight: 700;
}

.accent-text {
  color: var(--accent);
}

.center {
  text-align: center;
}

.text-muted {
  color: var(--text-soft);
}

.empty-cell {
  padding: 20px;
}

.col-category {
  width: 220px;
}

.col-value {
  width: 140px;
}

.col-actions {
  width: 120px;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  margin: 0 4px;
}

.danger-text {
  color: var(--danger);
}
</style>
